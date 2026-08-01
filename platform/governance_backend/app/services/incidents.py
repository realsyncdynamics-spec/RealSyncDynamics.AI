"""Incident-Verwaltung und -Dispatch.

Ein erkannter Verstoß, der nur im Log landet, ist kein Governance-Feature.
Dieses Modul macht aus einem Drift-Befund einen nachverfolgbaren Vorgang:
Incident anlegen, Projekt als gefährdet markieren, Webhook feuern.

Der Dispatch ist bewusst fehlertolerant — ein nicht erreichbarer n8n-Endpunkt
darf die Telemetrie-Annahme nicht zum Scheitern bringen. Der Incident bleibt
trotzdem bestehen und ist über die API sichtbar.

Speicher: prozesslokal oder Postgres, je nach `DATABASE_URL` (siehe db.py).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from ..schemas import Incident, IncidentSeverity, IncidentType
from . import db, inventory

logger = logging.getLogger("governance.incidents")

WEBHOOK_URL = os.getenv("GOVERNANCE_WEBHOOK_URL", "")
WEBHOOK_TIMEOUT = float(os.getenv("GOVERNANCE_WEBHOOK_TIMEOUT", "5"))

# incident_id -> Incident (In-Memory-Backend)
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

    await _insert(incident)

    # Das Projekt trägt den Befund sichtbar im Cockpit.
    if severity in ("high", "critical"):
        await inventory.set_compliance_status(project_id, "at_risk")

    logger.warning(
        "INCIDENT %s [%s/%s] Projekt=%s: %s",
        incident.incident_id,
        incident_type,
        severity,
        project_id,
        title,
    )

    await _dispatch(incident)
    await _update_dispatch(incident)
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
        # kurzzeitig nicht erreichbarer n8n keinen Befund verschluckt. Die
        # offenen Fälle sind über dispatch_status='failed' auffindbar.
        incident.dispatch_status = "failed"
        incident.dispatch_error = str(exc)
        logger.error("Incident %s nicht zugestellt: %s", incident.incident_id, exc)


async def get_incident(incident_id: str) -> Optional[Incident]:
    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_incidents where incident_id = %s",
                (incident_id,),
            )
            row = await cursor.fetchone()
        return _to_incident(row) if row else None

    return _INCIDENTS.get(incident_id)


async def list_incidents(
    project_id: Optional[str] = None, status: Optional[str] = None
) -> List[Incident]:
    if db.is_enabled():
        clauses, params = [], []
        if project_id:
            clauses.append("project_id = %s")
            params.append(project_id)
        if status:
            clauses.append("status = %s")
            params.append(status)
        where = f"where {' and '.join(clauses)}" if clauses else ""
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_incidents {where} order by created_at desc",
                params,
            )
            rows = await cursor.fetchall()
        return [_to_incident(row) for row in rows]

    incidents = list(_INCIDENTS.values())
    if project_id:
        incidents = [i for i in incidents if i.project_id == project_id]
    if status:
        incidents = [i for i in incidents if i.status == status]
    return sorted(incidents, key=lambda i: i.created_at, reverse=True)


async def acknowledge(incident_id: str) -> Optional[Incident]:
    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute(
                "update governance_incidents set status = 'acknowledged'"
                " where incident_id = %s and status = 'open'",
                (incident_id,),
            )
        return await get_incident(incident_id)

    incident = _INCIDENTS.get(incident_id)
    if incident is not None and incident.status == "open":
        incident.status = "acknowledged"
    return incident


async def reset() -> None:
    """Nur für Tests."""
    _INCIDENTS.clear()
    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute("truncate governance_incidents")


# --- Speicher --------------------------------------------------------------

_COLUMNS = (
    "incident_id, project_id, incident_type, severity, title, detail, evidence, "
    "status, dispatch_status, dispatch_error, created_at"
)


async def _insert(incident: Incident) -> None:
    if not db.is_enabled():
        _INCIDENTS[incident.incident_id] = incident
        return

    async with db.pool().connection() as conn:
        await conn.execute(
            """
            insert into governance_incidents (
                incident_id, project_id, tenant_id, incident_type, severity,
                title, detail, evidence, status, dispatch_status, created_at
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::timestamptz)
            """,
            (
                incident.incident_id,
                incident.project_id,
                db.tenant_id(),
                incident.incident_type,
                incident.severity,
                incident.title,
                incident.detail,
                json.dumps(incident.evidence),
                incident.status,
                incident.dispatch_status,
                incident.created_at,
            ),
        )


async def _update_dispatch(incident: Incident) -> None:
    """Schreibt das Zustellungsergebnis nach — der Webhook läuft nach dem Insert."""
    if not db.is_enabled():
        return

    async with db.pool().connection() as conn:
        await conn.execute(
            "update governance_incidents set dispatch_status = %s, dispatch_error = %s"
            " where incident_id = %s",
            (incident.dispatch_status, incident.dispatch_error, incident.incident_id),
        )


def _to_incident(row) -> Incident:
    evidence = row[6]
    if isinstance(evidence, str):
        evidence = json.loads(evidence)
    return Incident(
        incident_id=row[0],
        project_id=row[1],
        incident_type=row[2],
        severity=row[3],
        title=row[4],
        detail=row[5],
        evidence=evidence or {},
        status=row[7],
        dispatch_status=row[8],
        dispatch_error=row[9],
        created_at=row[10].isoformat(),
    )
