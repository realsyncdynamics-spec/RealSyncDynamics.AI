"""Verarbeitung von Laufzeit-Telemetrie deployter Projekte.

Aufgabe: Drift zwischen registriertem Soll-Zustand und Laufzeit-Ist-Zustand
erkennen und daraus einen nachverfolgbaren Vorgang machen — nicht nur eine
Logzeile.

Zwei Regeln greifen heute:

  * **Regionsdrift** — die Verarbeitung verlässt die EU. Ohne Transfer Impact
    Assessment ist das ein meldepflichtiger Befund (Kap. V DSGVO), kein
    Betriebsdetail.
  * **Modelldrift** — in Produktion läuft eine Modellversion, die bei der
    Registrierung nie bewertet wurde. Die Risikoklasse des Projekts wurde auf
    Basis der gemeldeten Modelle bestimmt; ein anderes Modell entwertet sie.
"""

from __future__ import annotations

import logging
from collections import deque
from typing import Deque, Dict, List, Optional

from ..schemas import RuntimeTelemetry
from . import incidents, inventory

logger = logging.getLogger("governance.telemetry")

# Ringpuffer der letzten Events (Ersatz für runtime_events-Tabelle).
_EVENTS: Deque[RuntimeTelemetry] = deque(maxlen=1000)

# project_id -> zuletzt gemeldete Region (für Drift-Erkennung).
_LAST_REGION: Dict[str, str] = {}

# Regionen, die als EU-souverän gelten.
EU_REGIONS = {"eu", "eu-central-1", "eu-west-1", "de", "at", "fra1"}


async def handle(payload: RuntimeTelemetry) -> None:
    """Nimmt ein Telemetrie-Event entgegen und wertet es aus."""
    _EVENTS.append(payload)

    project = await inventory.get_project(payload.project_id)
    project_name = project.project_name if project else "<unbekannt>"

    logger.info(
        "telemetry project=%s (%s) event=%s model=%s region=%s",
        payload.project_id,
        project_name,
        payload.event_type,
        payload.model_version,
        payload.region,
    )

    previous_region = _LAST_REGION.get(payload.project_id)
    if payload.region:
        _LAST_REGION[payload.project_id] = payload.region

    if payload.event_type == "region_change":
        await _handle_region_change(payload, previous_region)

    # Modelldrift wird bei jedem Event geprüft, nicht nur bei einem
    # dedizierten Event-Typ — ein stillschweigend getauschtes Modell meldet
    # sich nicht selbst an.
    if payload.model_version:
        await _check_model_drift(payload)


async def _handle_region_change(
    payload: RuntimeTelemetry, previous_region: Optional[str]
) -> None:
    """Bewertet einen Regionswechsel (Drittlandtransfer, Kap. V DSGVO)."""
    source = (previous_region or payload.details.get("from") or "").lower()
    target = (payload.region or payload.details.get("to") or "").lower()

    if not target or target in EU_REGIONS:
        return
    if source and source not in EU_REGIONS:
        # Bereits außerhalb der EU — der Befund steht schon.
        return

    logger.warning(
        "DRIFT: Projekt %s verlässt EU-Region (%s -> %s)",
        payload.project_id,
        source or "unbekannt",
        target,
    )

    project = await inventory.get_project(payload.project_id)
    # Ein high-risk-System außerhalb der EU wiegt schwerer als ein minimales.
    severity = "critical" if project and project.risk_tier == "high" else "high"

    await incidents.open_incident(
        project_id=payload.project_id,
        incident_type="region_drift",
        severity=severity,
        title="Verarbeitung außerhalb der EU",
        detail=(
            f"Die Verarbeitung wechselte von '{source or 'unbekannt'}' nach '{target}'. "
            "Ohne Transfer Impact Assessment liegt ein Drittlandtransfer nach "
            "Kap. V DSGVO vor."
        ),
        evidence={
            "from": source or "unbekannt",
            "to": target,
            "event_type": payload.event_type,
        },
    )


async def _check_model_drift(payload: RuntimeTelemetry) -> None:
    """Meldet Modellversionen, die nie bewertet wurden."""
    project = await inventory.get_project(payload.project_id)
    if project is None or not project.models:
        return

    running = (payload.model_version or "").lower()
    # Präfix-Vergleich: 'claude-3-5-sonnet-20241022' zählt als registriert,
    # wenn 'claude-3-5-sonnet' gemeldet wurde. Ein anderer Modellstamm nicht.
    registered = [m.lower() for m in project.models]
    if any(running.startswith(m) or m.startswith(running) for m in registered):
        return

    # Doppelmeldungen für dasselbe Modell vermeiden.
    for existing in await incidents.list_incidents(payload.project_id):
        if (
            existing.incident_type == "model_drift"
            and existing.evidence.get("running_model") == running
            and existing.status != "resolved"
        ):
            return

    logger.warning(
        "DRIFT: Projekt %s nutzt nicht registriertes Modell %s (registriert: %s)",
        payload.project_id,
        running,
        ", ".join(registered),
    )

    await incidents.open_incident(
        project_id=payload.project_id,
        incident_type="model_drift",
        severity="high" if project.risk_tier in ("high", "limited") else "medium",
        title="Nicht registrierte Modellversion in Produktion",
        detail=(
            f"In Produktion läuft '{payload.model_version}', registriert und bewertet "
            f"wurden: {', '.join(project.models)}. Die Risikoklasse "
            f"'{project.risk_tier}' beruht auf den registrierten Modellen."
        ),
        evidence={
            "running_model": running,
            "registered_models": ",".join(registered),
            "risk_tier": project.risk_tier,
        },
    )


def recent_events(project_id: Optional[str] = None, limit: int = 50) -> List[RuntimeTelemetry]:
    """Liefert die jüngsten Events (optional nach Projekt gefiltert)."""
    events = list(_EVENTS)
    if project_id:
        events = [e for e in events if e.project_id == project_id]
    return events[-limit:]


def reset() -> None:
    """Nur für Tests."""
    _EVENTS.clear()
    _LAST_REGION.clear()
