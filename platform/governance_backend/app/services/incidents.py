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
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

from ..schemas import Incident, IncidentSeverity, IncidentType
from . import db, inventory

logger = logging.getLogger("governance.incidents")

WEBHOOK_URL = os.getenv("GOVERNANCE_WEBHOOK_URL", "")
WEBHOOK_TIMEOUT = float(os.getenv("GOVERNANCE_WEBHOOK_TIMEOUT", "5"))

# Zustellung wird wiederholt, bis sie klappt oder das Limit erreicht ist.
# Danach bleibt der Befund als `exhausted` auffindbar — aufgeben heißt nicht
# vergessen.
DISPATCH_MAX_ATTEMPTS = int(os.getenv("GOVERNANCE_DISPATCH_MAX_ATTEMPTS", "5"))
DISPATCH_RETRY_BASE_SECONDS = float(os.getenv("GOVERNANCE_DISPATCH_RETRY_BASE", "60"))

# incident_id -> Incident (In-Memory-Backend)
# (tenant_id, incident_id) -> Befund. Der Mandant gehört in den Schlüssel und
# nicht in eine Prüfung daneben: So kann kein Lesepfad ihn auslassen.
_INCIDENTS: Dict[tuple, Incident] = {}


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
    Incident vermerkt, statt den Aufrufer scheitern zu lassen; die Wiederholung
    übernimmt `redeliver_pending`.
    """
    if not WEBHOOK_URL:
        incident.dispatch_status = "not_configured"
        return

    incident.dispatch_attempts += 1

    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT) as client:
            response = await client.post(WEBHOOK_URL, json=incident.model_dump())
            response.raise_for_status()
        incident.dispatch_status = "delivered"
        incident.dispatch_error = None
        incident.next_dispatch_at = None
        return
    except httpx.HTTPError as exc:
        incident.dispatch_error = str(exc)

    if incident.dispatch_attempts >= DISPATCH_MAX_ATTEMPTS:
        incident.dispatch_status = "exhausted"
        incident.next_dispatch_at = None
        logger.error(
            "Incident %s endgültig nicht zugestellt (%d Versuche): %s",
            incident.incident_id,
            incident.dispatch_attempts,
            incident.dispatch_error,
        )
        return

    delay = DISPATCH_RETRY_BASE_SECONDS * (2 ** (incident.dispatch_attempts - 1))
    incident.dispatch_status = "failed"
    incident.next_dispatch_at = (
        datetime.now(timezone.utc) + timedelta(seconds=delay)
    ).isoformat()
    logger.warning(
        "Incident %s nicht zugestellt (Versuch %d), nächster Versuch in %.0fs: %s",
        incident.incident_id,
        incident.dispatch_attempts,
        delay,
        incident.dispatch_error,
    )


async def _faellige_zustellungen() -> List[Incident]:
    """Alle offenen Zustellversuche — **mandantenübergreifend**.

    Das ist die eine Stelle, an der der Mandantenfilter absichtlich fehlt. Die
    Wiederzustellung läuft als Hintergrundschleife aus dem Lifespan, also ohne
    Request und damit ohne Mandantenkontext; `db.tenant_id()` lieferte dort den
    Default. Mit Filter würde die Schleife stillschweigend nur die Befunde
    *eines* Mandanten wiederholen und alle anderen liegen lassen — ein
    verschluckter Befund ist genau das, was die Zustellung verhindern soll.

    Nach außen ist das ungefährlich: Die Funktion ist privat, ihr Ergebnis
    verlässt den Prozess nur als Webhook an die konfigurierte URL.
    """
    jetzt = datetime.now(timezone.utc)

    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_incidents"
                " where dispatch_status = 'failed' order by created_at",
            )
            rows = await cursor.fetchall()
        kandidaten = [_to_incident(row) for row in rows]
    else:
        kandidaten = [i for i in _INCIDENTS.values() if i.dispatch_status == "failed"]

    return [
        incident
        for incident in kandidaten
        if incident.next_dispatch_at is None
        or datetime.fromisoformat(incident.next_dispatch_at) <= jetzt
    ]


async def redeliver_pending(limit: int = 50) -> Dict[str, int]:
    """Stellt fällige, zuvor gescheiterte Befunde erneut zu.

    Wird periodisch aus dem Lifespan aufgerufen und lässt sich über
    `POST /api/v1/governance/incidents/redeliver` von Hand anstoßen.
    """
    if not WEBHOOK_URL:
        return {"versucht": 0, "zugestellt": 0, "aufgegeben": 0}

    faellig = (await _faellige_zustellungen())[:limit]

    zugestellt = aufgegeben = 0
    for incident in faellig:
        await _dispatch(incident)
        await _update_dispatch(incident)
        if incident.dispatch_status == "delivered":
            zugestellt += 1
        elif incident.dispatch_status == "exhausted":
            aufgegeben += 1

    if faellig:
        logger.info(
            "Zustellung wiederholt: %d versucht, %d zugestellt, %d aufgegeben",
            len(faellig),
            zugestellt,
            aufgegeben,
        )

    return {"versucht": len(faellig), "zugestellt": zugestellt, "aufgegeben": aufgegeben}


async def get_incident(incident_id: str) -> Optional[Incident]:
    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_incidents"
                " where incident_id = %s and tenant_id = %s",
                (incident_id, db.tenant_id()),
            )
            row = await cursor.fetchone()
        return _to_incident(row) if row else None

    return _INCIDENTS.get((db.tenant_id(), incident_id))


async def list_incidents(
    project_id: Optional[str] = None, status: Optional[str] = None
) -> List[Incident]:
    if db.is_enabled():
        # Der Mandant ist keine optionale Bedingung, sondern die erste.
        clauses, params = ["tenant_id = %s"], [db.tenant_id()]
        if project_id:
            clauses.append("project_id = %s")
            params.append(project_id)
        if status:
            clauses.append("status = %s")
            params.append(status)
        where = f"where {' and '.join(clauses)}"
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_incidents {where} order by created_at desc",
                params,
            )
            rows = await cursor.fetchall()
        return [_to_incident(row) for row in rows]

    mandant = db.tenant_id()
    incidents = [i for (tid, _), i in _INCIDENTS.items() if tid == mandant]
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
                " where incident_id = %s and status = 'open' and tenant_id = %s",
                (incident_id, db.tenant_id()),
            )
        return await get_incident(incident_id)

    incident = _INCIDENTS.get((db.tenant_id(), incident_id))
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
    "status, dispatch_status, dispatch_error, created_at, dispatch_attempts, "
    "next_dispatch_at"
)


async def _insert(incident: Incident) -> None:
    if not db.is_enabled():
        _INCIDENTS[(db.tenant_id(), incident.incident_id)] = incident
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
            "update governance_incidents set dispatch_status = %s, dispatch_error = %s,"
            " dispatch_attempts = %s, next_dispatch_at = %s::timestamptz"
            " where incident_id = %s",
            (
                incident.dispatch_status,
                incident.dispatch_error,
                incident.dispatch_attempts,
                incident.next_dispatch_at,
                incident.incident_id,
            ),
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
        dispatch_attempts=row[11],
        next_dispatch_at=row[12].isoformat() if row[12] else None,
    )
