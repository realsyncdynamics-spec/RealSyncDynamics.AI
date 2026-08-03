"""Projekt-Inventar (Registry aller KI-Systeme).

Zwei Backends hinter einer API: prozesslokal (Default) und Postgres (sobald
`DATABASE_URL` gesetzt ist). Die Aufrufer sehen davon nichts — sie rufen
dieselben Funktionen.

Alle Zugriffe sind `async`, auch die lesenden. Das kostet im In-Memory-Fall
nichts und erspart eine zweite, synchrone API, sobald die Datenbank im Spiel
ist.
"""

from __future__ import annotations

import json
import uuid
from typing import Dict, List, Optional

from ..schemas import (
    InventoryActivate,
    ProjectRecord,
    ProjectRegistration,
    RiskTier,
)
from . import db

# --- In-Memory-Backend ------------------------------------------------------

# (tenant_id, project_id) -> Projekt. Der Mandant gehört in den Schlüssel und
# nicht in eine Prüfung daneben: So kann kein Lesepfad ihn auslassen.
_PROJECTS: Dict[tuple, ProjectRecord] = {}


def _key(project_id: str) -> tuple:
    return (db.tenant_id(), project_id)


# --- Öffentliche API --------------------------------------------------------


async def create_project(
    payload: ProjectRegistration,
    risk_tier: RiskTier,
    required_gates: List[str],
) -> str:
    """Legt ein Projekt an und gibt die project_id zurück."""
    project_id = f"prj_{uuid.uuid4().hex[:12]}"
    record = ProjectRecord(
        project_id=project_id,
        project_name=payload.project_name,
        description=payload.description,
        risk_tier=risk_tier,
        required_gates=required_gates,
        status="registered",
        jurisdiction=payload.jurisdiction,
        # Referenzstand für die Drift-Erkennung: was hier steht, wurde bewertet.
        models=list(payload.models),
    )

    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute(
                """
                insert into governance_projects (
                    project_id, tenant_id, project_name, description, risk_tier,
                    required_gates, data_types, data_subjects, models,
                    llm_provider, jurisdiction, tags, status
                ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    project_id,
                    db.tenant_id(),
                    payload.project_name,
                    payload.description,
                    risk_tier,
                    required_gates,
                    payload.data_types,
                    payload.data_subjects,
                    payload.models,
                    payload.llm_provider,
                    payload.jurisdiction or "eu",
                    json.dumps(payload.tags),
                    "registered",
                ),
            )
    else:
        _PROJECTS[_key(project_id)] = record

    return project_id


async def activate(payload: InventoryActivate) -> ProjectRecord:
    """Markiert ein Projekt als produktiv (Deployment gemeldet)."""
    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                """
                update governance_projects
                   set status = 'active',
                       endpoint = %s,
                       deployment_timestamp = %s::timestamptz,
                       updated_at = now()
                 where project_id = %s and tenant_id = %s
             returning project_id
                """,
                (payload.endpoint, payload.deployment_timestamp, payload.project_id, db.tenant_id()),
            )
            if await cursor.fetchone() is None:
                raise KeyError(payload.project_id)
        project = await get_project(payload.project_id)
        assert project is not None
        return project

    project = _PROJECTS.get(_key(payload.project_id))
    if project is None:
        raise KeyError(payload.project_id)

    project.status = "active"
    project.endpoint = payload.endpoint
    project.deployment_timestamp = payload.deployment_timestamp
    return project


async def get_project(project_id: str) -> Optional[ProjectRecord]:
    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_projects"
                " where project_id = %s and tenant_id = %s",
                (project_id, db.tenant_id()),
            )
            row = await cursor.fetchone()
        return _to_record(row) if row else None

    return _PROJECTS.get(_key(project_id))


async def record_gate_result(project_id: str, status: str) -> None:
    """Schreibt das letzte Gate-Ergebnis ans Projekt (Cockpit-Anzeige)."""
    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute(
                "update governance_projects set last_gate_status = %s, updated_at = now()"
                " where project_id = %s and tenant_id = %s",
                (status, project_id, db.tenant_id()),
            )
        return

    project = _PROJECTS.get(_key(project_id))
    if project is not None:
        project.last_gate_status = status  # type: ignore[assignment]


async def set_compliance_status(project_id: str, status: str) -> None:
    """Markiert ein Projekt nach einem Laufzeitbefund als gefährdet."""
    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute(
                "update governance_projects set compliance_status = %s, updated_at = now()"
                " where project_id = %s and tenant_id = %s",
                (status, project_id, db.tenant_id()),
            )
        return

    project = _PROJECTS.get(_key(project_id))
    if project is not None:
        project.compliance_status = status  # type: ignore[assignment]


async def list_projects() -> List[ProjectRecord]:
    if db.is_enabled():
        async with db.pool().connection() as conn:
            cursor = await conn.execute(
                f"select {_COLUMNS} from governance_projects"
                " where tenant_id = %s order by created_at desc",
                (db.tenant_id(),),
            )
            rows = await cursor.fetchall()
        return [_to_record(row) for row in rows]

    mandant = db.tenant_id()
    return [p for (tid, _), p in _PROJECTS.items() if tid == mandant]


async def reset() -> None:
    """Nur für Tests: Store leeren."""
    _PROJECTS.clear()
    if db.is_enabled():
        async with db.pool().connection() as conn:
            await conn.execute("truncate governance_projects cascade")


# --- Mapping ---------------------------------------------------------------

_COLUMNS = (
    "project_id, project_name, description, risk_tier, required_gates, status, "
    "endpoint, deployment_timestamp, jurisdiction, last_gate_status, models, "
    "compliance_status"
)


def _to_record(row) -> ProjectRecord:
    return ProjectRecord(
        project_id=row[0],
        project_name=row[1],
        description=row[2],
        risk_tier=row[3],
        required_gates=list(row[4] or []),
        status=row[5],
        endpoint=row[6],
        deployment_timestamp=row[7].isoformat() if row[7] else None,
        jurisdiction=row[8],
        last_gate_status=row[9],
        models=list(row[10] or []),
        compliance_status=row[11],
    )
