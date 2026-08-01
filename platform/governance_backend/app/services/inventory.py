"""Projekt-Inventar (Registry aller KI-Systeme).

Persistenz ist bewusst als In-Memory-Store implementiert, damit der Stack ohne
Datenbank startet. Der Zugriff läuft ausschließlich über die Funktionen dieses
Moduls — dadurch bleibt der Austausch gegen Supabase ein lokaler Eingriff.

TODO(Persistenz): `_PROJECTS` durch Supabase-Tabelle `ai_systems` ersetzen
(siehe governance_backend/migrations/0001_init.sql). RLS: tenant_id-Filter.
"""

from __future__ import annotations

import uuid
from typing import Dict, List, Optional

from ..schemas import (
    InventoryActivate,
    ProjectRecord,
    ProjectRegistration,
    RiskTier,
)

# project_id -> ProjectRecord
_PROJECTS: Dict[str, ProjectRecord] = {}


async def create_project(
    payload: ProjectRegistration,
    risk_tier: RiskTier,
    required_gates: List[str],
) -> str:
    """Legt ein Projekt an und gibt die project_id zurück."""
    project_id = f"prj_{uuid.uuid4().hex[:12]}"
    _PROJECTS[project_id] = ProjectRecord(
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
    return project_id


async def activate(payload: InventoryActivate) -> ProjectRecord:
    """Markiert ein Projekt als produktiv (Deployment gemeldet)."""
    project = _PROJECTS.get(payload.project_id)
    if project is None:
        raise KeyError(payload.project_id)

    project.status = "active"
    project.endpoint = payload.endpoint
    project.deployment_timestamp = payload.deployment_timestamp
    return project


def get_project(project_id: str) -> Optional[ProjectRecord]:
    """Synchroner Lookup — wird vom Gate-Engine im Request-Pfad genutzt."""
    return _PROJECTS.get(project_id)


def record_gate_result(project_id: str, status: str) -> None:
    """Schreibt das letzte Gate-Ergebnis ans Projekt (Cockpit-Anzeige)."""
    project = _PROJECTS.get(project_id)
    if project is not None:
        project.last_gate_status = status  # type: ignore[assignment]


def list_projects() -> List[ProjectRecord]:
    return list(_PROJECTS.values())


def reset() -> None:
    """Nur für Tests: Store leeren."""
    _PROJECTS.clear()
