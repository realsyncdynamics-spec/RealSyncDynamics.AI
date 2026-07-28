"""Verarbeitung von Laufzeit-Telemetrie deployter Projekte.

Aufgabe: Drift zwischen registriertem Soll-Zustand und Laufzeit-Ist-Zustand
erkennen (Region, Modellversion, Vorfälle).
"""

from __future__ import annotations

import logging
from collections import deque
from typing import Deque, Dict, List, Optional

from ..schemas import RuntimeTelemetry
from . import inventory

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

    project = inventory.get_project(payload.project_id)
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
        _handle_region_change(payload, previous_region)


def _handle_region_change(payload: RuntimeTelemetry, previous_region: Optional[str]) -> None:
    """Bewertet einen Regionswechsel (Drittlandtransfer, Kap. V DSGVO)."""
    source = (previous_region or payload.details.get("from") or "").lower()
    target = (payload.region or payload.details.get("to") or "").lower()

    left_eu = source in EU_REGIONS and target not in EU_REGIONS and target != ""
    if left_eu:
        logger.warning(
            "DRIFT: Projekt %s verlässt EU-Region (%s -> %s)",
            payload.project_id,
            source,
            target,
        )
        # TODO(Alarmierung): Incident in `governance_incidents` anlegen,
        # n8n-Webhook feuern und Projekt-Status auf 'at_risk' setzen.
        # Ein Transfer eu -> us ohne Transfer Impact Assessment ist ein
        # meldepflichtiger Befund, kein reines Log-Ereignis.


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
