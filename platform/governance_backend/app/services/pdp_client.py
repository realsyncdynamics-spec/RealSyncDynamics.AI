"""Anbindung an den Policy Decision Point (P2-4).

## Wozu

Risiko R10 des Enforcement-Plans: Dieses Repository betreibt drei Laufzeiten —
TypeScript-Edge, dieser Python-Stack und die Node-Services. Wenn jede ihre
eigenen Regeln führt, driftet die Semantik, und ein Kunde bekommt je nach
Weg eine andere Antwort auf dieselbe Frage. Die Gegenmaßnahme steht im Plan:
**Der PDP ist der einzige Entscheider; Python ruft ihn auf.**

Die CI/CD-Gate-Engine entschied bis hierher vollständig aus eigener Logik —
Risikoklasse, Gate-Katalog, Build-Artefakte. Die Richtlinien, die ein Mandant
in der Plattform gepflegt hat, hatten an der Auslieferungsschranke **keine
Wirkung**. Genau derselbe Befund wie beim SiteOS Publish Gate (P2-3).

## Was dieses Modul ausdrücklich NICHT tut

Es ersetzt die vorhandene Gate-Logik nicht. Der Plan formuliert P2-4 als
„`gate_engine.py` ruft den PDP, statt eigene Logik zu führen" — das wäre
wörtlich genommen ein Rückbau funktionierender und guter Regeln (Art. 5 AI
Act: verbotene Praktik liefert nie aus; fehlende Tests blockieren immer).
Bewusste Abweichung vom Planwortlaut: Der PDP kommt **hinzu** und kann nur
verschärfen, nie lockern. Ein lokales Nein bleibt ein Nein. Dieselbe Regel
wie beim Agent-PEP (P1-5).

## Sicherheitsrelevanz

Der `rsd_gov_`-Schlüssel bestimmt den Mandanten; er wird nie aus der Anfrage
übernommen. An den PDP gehen ausschließlich Merkmale des Builds — Projekt,
Risikoklasse, Gate-Namen, Build-Hash. Niemals Quellcode, Logs oder
Artefaktinhalte (DSGVO Art. 5 Abs. 1 lit. c).

EU AI Act Art. 14 (menschliche Aufsicht am Freigabepunkt), Art. 12
(Aufzeichnung der Entscheidung).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import List, Literal, Optional

import httpx

logger = logging.getLogger("governance.pdp")

PDP_TIMEOUT = float(os.getenv("GOVERNANCE_PDP_TIMEOUT", "5.0"))

Verdict = Literal["allow", "log_only", "warn", "block", "require_approval"]
_KNOWN_VERDICTS = {"allow", "log_only", "warn", "block", "require_approval"}


@dataclass(frozen=True)
class PdpOutcome:
    """Ergebnis der Richtlinienprüfung — oder der ehrliche Grund, warum keines vorliegt.

    Drei Zustände statt eines Optional, aus demselben Grund wie in
    `PolicyEngineState` auf der TypeScript-Seite: „nicht befragt" muss sich von
    „vergeblich befragt" unterscheiden lassen. Wer beides zu `None`
    zusammenzieht, kann eine still nicht greifende Regel nicht mehr von einem
    Ausfall trennen — die gefährlichste Fehlerklasse dieses Plans.
    """

    state: Literal["consulted", "not_enforcing", "unavailable"]
    verdict: Optional[Verdict] = None
    reasons: Optional[List[str]] = None
    detail: str = ""

    @property
    def blocks(self) -> bool:
        return self.state == "consulted" and self.verdict == "block"

    @property
    def requires_approval(self) -> bool:
        return self.state == "consulted" and self.verdict == "require_approval"

    @property
    def warns(self) -> bool:
        return self.state == "consulted" and self.verdict == "warn"


def mode() -> str:
    """off | shadow | enforce — Default `shadow`.

    Wie bei jedem anderen Enforcement-Punkt dieses Plans: Ein Deploy ändert
    das Verhalten nicht von selbst. Umgestellt wird bewusst, nachdem die
    Abweichungen gemessen sind.
    """
    return (os.getenv("GOVERNANCE_PDP_MODE") or "shadow").strip().lower()


async def evaluate_build(
    *,
    project_id: str,
    risk_tier: str,
    build_hash: str,
    unmet_gates: List[str],
) -> PdpOutcome:
    """Fragt den PDP, ob dieser Build ausgeliefert werden darf."""
    current = mode()
    if current == "off":
        return PdpOutcome(
            state="not_enforcing",
            detail="Richtlinienprüfung ist abgeschaltet (GOVERNANCE_PDP_MODE=off).",
        )

    url = os.getenv("GOVERNANCE_PDP_URL", "").strip()
    key = os.getenv("GOVERNANCE_PDP_KEY", "").strip()
    if not url or not key:
        # Nicht konfiguriert ist nicht dasselbe wie ausgefallen. Wer das
        # gleichsetzt, blockiert jede Pipeline in jeder Umgebung, in der der
        # PDP schlicht nicht vorgesehen ist.
        return PdpOutcome(
            state="not_enforcing",
            detail="Kein PDP konfiguriert (GOVERNANCE_PDP_URL/-KEY fehlen).",
        )

    request = {
        "contract": "v1",
        # tenant_id bleibt absichtlich weg: Der Mandant kommt aus dem
        # Schlüssel, nicht aus dem Rumpf. Ein mitgeschickter wäre eine
        # Einladung, fremde Richtlinien zu erfragen.
        "action": {"verb": "deploy", "channel": "cicd_gate"},
        "target": {"system_id": project_id},
        "data": {"risk_level": risk_tier},
        "payload": {
            "build_hash": build_hash,
            "unmet_gates": unmet_gates,
            "unmet_gate_count": len(unmet_gates),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=PDP_TIMEOUT) as client:
            response = await client.post(
                url,
                json=request,
                headers={"Authorization": f"Bearer {key}"},
            )
            response.raise_for_status()
            body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        detail = str(exc)
        logger.error("PDP nicht erreichbar: %s", detail)
        if current != "enforce":
            # Im Beobachtungsbetrieb darf ein Ausfall nichts blockieren —
            # sonst ändert der Shadow-Mode doch das Verhalten, was seinen
            # ganzen Zweck ausschließt.
            return PdpOutcome(
                state="not_enforcing",
                detail=f"Beobachtungsbetrieb; die Prüfung schlug fehl ({detail}).",
            )
        return PdpOutcome(state="unavailable", detail=detail)

    verdict = body.get("decision")
    if verdict not in _KNOWN_VERDICTS:
        # Ein unbekanntes Verdikt ist ein Vertragsbruch. Raten wäre hier
        # schlimmer als sperren.
        logger.error("PDP lieferte unbekanntes Verdikt: %r", verdict)
        if current != "enforce":
            return PdpOutcome(
                state="not_enforcing",
                detail=f"Beobachtungsbetrieb; unbekanntes Verdikt {verdict!r}.",
            )
        return PdpOutcome(state="unavailable", detail=f"unbekanntes Verdikt {verdict!r}")

    reasons = body.get("reasons")
    reasons = [str(r) for r in reasons] if isinstance(reasons, list) else []

    if current != "enforce":
        return PdpOutcome(
            state="not_enforcing",
            detail=(
                f"Beobachtungsbetrieb (GOVERNANCE_PDP_MODE={current}); "
                f'der PDP hätte "{verdict}" entschieden.'
            ),
            verdict=verdict,  # zur Protokollierung, nicht zur Anwendung
            reasons=reasons,
        )

    return PdpOutcome(state="consulted", verdict=verdict, reasons=reasons)
