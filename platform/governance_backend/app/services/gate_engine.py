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
from . import inventory

Severity = Literal["low", "medium", "high"]

# Gate-Name -> (Klartext-Begründung, Remediation-Hinweis)
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

    if blocking:
        decision = GateCheckResponse(
            status="blocked",
            reason="Gates nicht erfüllt: " + ", ".join(GATE_DESCRIPTIONS[g][0] for g in blocking),
            remediation=" ".join(GATE_DESCRIPTIONS[g][1] for g in blocking),
            severity=SEVERITY_BY_TIER[tier],
        )
    elif warnings:
        decision = GateCheckResponse(
            status="warning",
            reason="Nicht blockierende Befunde: "
            + ", ".join(GATE_DESCRIPTIONS[g][0] for g in warnings),
            remediation=" ".join(GATE_DESCRIPTIONS[g][1] for g in warnings),
            severity="low",
        )
    else:
        decision = GateCheckResponse(status="approved")

    await inventory.record_gate_result(payload.project_id, decision.status)

    # TODO(Evidence Vault): Gate-Entscheidung inkl. build_hash als
    # unveränderliches Evidence-Event (Hash-Chain) ablegen.
    return decision
