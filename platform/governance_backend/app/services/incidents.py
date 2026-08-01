"""Incident-Verwaltung und -Dispatch.

Ein erkannter Verstoß, der nur im Log landet, ist kein Governance-Feature.
Dieses Modul macht aus einem Drift-Befund einen nachverfolgbaren Vorgang:
Incident anlegen, Projekt als gefährdet markieren, Webhook feuern.

Der Dispatch ist bewusst fehlertolerant — ein nicht erreichbarer n8n-Endpunkt
darf die Telemetrie-Annahme nicht zum Scheitern bringen. Der Incident bleibt
trotzdem bestehen und ist über die API sichtbar.

TODO(Persistenz): Zieltabelle `governance_incidents` (siehe Migration).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from ..schemas import Incident, IncidentSeverity, IncidentType
from . import inventory

logger = logging.getLogger("governance.incidents")

WEBHOOK_URL = os.getenv("GOVERNANCE_WEBHOOK_URL", "")
WEBHOOK_TIMEOUT = float(os.getenv("GOVERNANCE_WEBHOOK_TIMEOUT", "5"))

# incident_id -> Incident
_INCIDENTS: Dict[str, Incident] = {}


async def open_incident(
    *,
    project_id: str,
    incident_type: IncidentType,
    severity: IncidentSeverity,
    title: str,
    detail: str,
    evidence: Optional[Dict[str, str]] = None,
) -> Incident:
    """Legt einen Incident an, markiert das Projekt und feuert den Webhook."""
    incident = Incident(
        incident_id=f"inc_{uuid.uuid4().hex[:12]}",
        project_id=project_id,
        incident_type=incident_type,
        severity=severity,
        title=title,
        detail=detail,
        evidence=evidence or {},
        status="open",
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    _INCIDENTS[incident.incident_id] = incident

    # Das Projekt trägt den Befund sichtbar im Cockpit.
    project = inventory.get_project(project_id)
    if project is not None and severity in ("high", "critical"):
        project.compliance_status = "at_risk"

    logger.warning(
        "INCIDENT %s [%s/%s] Projekt=%s: %s",
        incident.incident_id,
        incident_type,
        severity,
        project_id,
        title,
    )

    await _dispatch(incident)
    return incident


async def _dispatch(incident: Incident) -> None:
    """Meldet den Incident an die Automatisierung (n8n).

    Ohne konfigurierten Endpunkt passiert nichts — der Incident ist dann
    ausschließlich über die API sichtbar. Fehler werden geschluckt und am
    Incident vermerkt, statt den Aufrufer scheitern zu lassen.
    """
    if not WEBHOOK_URL:
        incident.dispatch_status = "not_configured"
        return

    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            response = await client.post(WEBHOOK_URL, json=incident.model_dump())
            response.raise_for_status()
        incident.dispatch_status = "delivered"
    except httpx.HTTPError as exc:
        # TODO(Zustellung): Retry mit Backoff über einen Cron, damit ein
        # kurzzeitig nicht erreichbarer n8n keinen Befund verschluckt.
        incident.dispatch_status = "failed"
        incident.dispatch_error = str(exc)
        logger.error("Incident %s nicht zugestellt: %s", incident.incident_id, exc)


def get_incident(incident_id: str) -> Optional[Incident]:
    return _INCIDENTS.get(incident_id)


def list_incidents(
    project_id: Optional[str] = None, status: Optional[str] = None
) -> List[Incident]:
    incidents = list(_INCIDENTS.values())
    if project_id:
        incidents = [i for i in incidents if i.project_id == project_id]
    if status:
        incidents = [i for i in incidents if i.status == status]
    return sorted(incidents, key=lambda i: i.created_at, reverse=True)


def acknowledge(incident_id: str) -> Optional[Incident]:
    incident = _INCIDENTS.get(incident_id)
    if incident is not None and incident.status == "open":
        incident.status = "acknowledged"
    return incident


def reset() -> None:
    """Nur für Tests."""
    _INCIDENTS.clear()
