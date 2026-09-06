"""CI/CD-Gate-Engine: entscheidet, ob ein Build ausgeliefert werden darf.

Vertrag mit der Pipeline:
  approved -> Deployment erlaubt
  warning  -> Deployment erlaubt, Befund landet im Prüfpfad
  blocked  -> Pipeline bricht ab (Exit-Code != 0)

Die geforderten Gates kommen aus der Risiko-Einstufung des Projekts
(`risk_evaluator`), die Nachweise aus dem Build (`GateCheckArtifacts`).
"""

from __future__ import annotations

from typing import Dict, List, Literal, Tuple

from ..schemas import GateCheckRequest, GateCheckResponse
from . import inventory, pdp_client

Severity = Literal["low", "medium", "high"]

# Gate-Name -> (Klartext-Begründung, Remediation-Hinweis)
#
# Die Schlüssel werden mit Werten aus `required_gates` nachgeschlagen, und das
# ist **persistierter** Zustand: Ein Projekt, das vor einer Katalogänderung
# registriert wurde, kann einen Namen tragen, den es hier nicht mehr gibt.
# Deshalb wird über `_beschreibung` gelesen und nie direkt indiziert — ein
# KeyError wäre hier ein HTTP 500 statt einer Gate-Entscheidung.
GATE_DESCRIPTIONS: Dict[str, Tuple[str, str]] = {
    "tests_passed": (
        "Test-Suite nicht grün",
        "Fehlgeschlagene Tests beheben und Build neu anstoßen.",
    ),
    "audit_logging_active": (
        "Prüfpfad-Logging nicht aktiv",
        "Audit-Logging aktivieren (alle Modellaufrufe in ai_tool_runs schreiben).",
    ),
    "model_card_included": (
        "Model Card fehlt",
        "Model Card mit Zweck, Trainingsdaten, Limitationen und Bewertung hinterlegen.",
    ),
    "transparency_notice_enabled": (
        "Transparenzhinweis fehlt (Art. 50 EU AI Act)",
        "Sichtbaren Hinweis 'KI-generiert' im UI aktivieren.",
    ),
    "pii_scan_passed": (
        "PII-Scan fehlgeschlagen",
        "Personenbezogene Daten aus Logs/Fixtures entfernen und Scan wiederholen.",
    ),
}

def _beschreibung(gate: str) -> Tuple[str, str]:
    """Beschreibung eines Gates — auch für unbekannte Namen belastbar."""
    return GATE_DESCRIPTIONS.get(
        gate,
        (
            f"Unbekanntes Gate '{gate}' nicht erfüllt",
            f"Gate '{gate}' im Katalog nachtragen oder aus dem Projekt entfernen.",
        ),
    )


# Ab welcher Risikoklasse ein fehlendes Gate hart blockiert (statt zu warnen).
BLOCKING_TIERS = {"high", "unacceptable"}

# Gates, die unabhängig von der Risikoklasse immer hart blockieren.
ALWAYS_BLOCKING = {"tests_passed", "model_card_included"}

SEVERITY_BY_TIER: Dict[str, Severity] = {
    "minimal": "low",
    "limited": "medium",
    "high": "high",
    "unacceptable": "high",
}


async def evaluate(payload: GateCheckRequest) -> GateCheckResponse:
    """Prüft die Build-Artefakte gegen den Gate-Katalog des Projekts."""
    project = await inventory.get_project(payload.project_id)

    # Unbekanntes Projekt: kein Nachweis über Risiko-Einstufung -> blockieren.
    if project is None:
        return GateCheckResponse(
            status="blocked",
            reason=f"Projekt {payload.project_id} ist nicht im Governance-Inventar registriert.",
            remediation="Projekt zuerst über /api/v1/governance/register-project registrieren.",
            severity="high",
        )

    tier = project.risk_tier

    # Art. 5 AI Act: verbotene Praktik -> niemals ausliefern.
    if tier == "unacceptable":
        decision = GateCheckResponse(
            status="blocked",
            reason="Projekt ist als 'unacceptable' eingestuft (verbotene Praktik nach Art. 5 EU AI Act).",
            remediation="Anwendungsfall streichen oder so umbauen, dass keine verbotene Praktik vorliegt.",
            severity="high",
        )
        await inventory.record_gate_result(payload.project_id, decision.status)
        return decision

    artifacts = payload.artifacts.model_dump()
    blocking: List[str] = []
    warnings: List[str] = []

    for gate in project.required_gates:
        if artifacts.get(gate) is True:
            continue
        # Gate nicht erfüllt — Härte hängt an Risikoklasse und Gate-Typ.
        if tier in BLOCKING_TIERS or gate in ALWAYS_BLOCKING:
            blocking.append(gate)
        else:
            warnings.append(gate)

    # ── Mandantenrichtlinien (P2-4) ────────────────────────────────────
    #
    # Bis hierher entschied diese Engine vollständig aus eigener Logik. Die
    # Richtlinien, die ein Mandant in der Plattform gepflegt hat, hatten an der
    # Auslieferungsschranke keine Wirkung — Risiko R10 des Enforcement-Plans
    # („drei Stacks, divergierende Semantik") an genau der Stelle, an der es
    # weh tut.
    #
    # Der PDP kommt HINZU und kann nur verschärfen, nie lockern: Ein `allow`
    # macht aus einem lokalen `blocked` kein `approved`. Ein lokales Nein
    # bleibt ein Nein.
    pdp = await pdp_client.evaluate_build(
        project_id=payload.project_id,
        risk_tier=tier,
        build_hash=payload.build_hash,
        # Nur die NAMEN der offenen Gates, keine Artefaktinhalte.
        unmet_gates=blocking + warnings,
    )
    if pdp.blocks:
        blocking.append("__policy__")
    elif pdp.requires_approval:
        # Eine Pipeline kann niemanden fragen. „Freigabe erforderlich" heißt
        # hier deshalb: anhalten und sagen, wer entscheiden muss — nicht
        # durchwinken und hoffen, dass es jemand nachholt.
        blocking.append("__policy_approval__")
    elif pdp.warns:
        warnings.append("__policy_warn__")
    elif pdp.state == "unavailable":
        blocking.append("__policy_unavailable__")

    def _policy_text(marker: str) -> Tuple[str, str]:
        """Klartext für die Richtlinien-Marker — sie stehen in keinem Katalog."""
        gruende = "; ".join(pdp.reasons or []) or "ohne nähere Begründung"
        if marker == "__policy__":
            return (f"Mandantenrichtlinie untersagt die Auslieferung ({gruende})",
                    "Die genannte Richtlinie erfüllen oder sie im Governance-Dashboard anpassen.")
        if marker == "__policy_approval__":
            return (f"Mandantenrichtlinie verlangt eine Freigabe ({gruende})",
                    "Freigabe unter /app/governance/gates einholen und den Build erneut anstoßen.")
        if marker == "__policy_warn__":
            return (f"Hinweis aus einer Mandantenrichtlinie ({gruende})", "Befund prüfen.")
        # Ausfall: ausdrücklich als Ausfall benennen, nicht als Verstoß —
        # sonst sucht jemand den Fehler in seinem Build.
        return (f"Die Richtlinienprüfung war nicht erreichbar ({pdp.detail})",
                "PDP-Erreichbarkeit prüfen; im Notfall GOVERNANCE_PDP_MODE=off setzen "
                "(bewusst und dokumentiert, nicht stillschweigend).")

    def _text(gate: str) -> Tuple[str, str]:
        return _policy_text(gate) if gate.startswith("__policy") else _beschreibung(gate)

    if blocking:
        decision = GateCheckResponse(
            status="blocked",
            reason="Gates nicht erfüllt: " + ", ".join(_text(g)[0] for g in blocking),
            remediation=" ".join(_text(g)[1] for g in blocking),
            severity=SEVERITY_BY_TIER[tier],
        )
    elif warnings:
        decision = GateCheckResponse(
            status="warning",
            reason="Nicht blockierende Befunde: "
            + ", ".join(_text(g)[0] for g in warnings),
            remediation=" ".join(_text(g)[1] for g in warnings),
            severity="low",
        )
    else:
        decision = GateCheckResponse(status="approved")
        if pdp.state == "not_enforcing":
            # Nicht verschweigen, dass die Mandantenrichtlinien hier gerade
            # nicht binden. Ein Gate, das strenger wirkt, als es ist, ist
            # dieselbe Unehrlichkeit wie eines, das zu wenig prüft.
            decision = GateCheckResponse(
                status="approved",
                reason=f"Mandantenrichtlinien binden hier derzeit nicht: {pdp.detail}",
            )

    await inventory.record_gate_result(payload.project_id, decision.status)

    # TODO(Evidence Vault): Gate-Entscheidung inkl. build_hash als
    # unveränderliches Evidence-Event (Hash-Chain) ablegen.
    return decision
