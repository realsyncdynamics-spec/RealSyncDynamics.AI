"""HTTP-Client zum RealSyncDynamicsAI-Governance-Backend.

Der Orchestrator baut nichts, bevor das Projekt registriert und eingestuft ist —
die Risikoklasse steuert, welche Tasks der Graph überhaupt enthält.
"""

from __future__ import annotations

import logging
import os

import httpx

from ..schemas import BuildSpec, GovernanceContext

logger = logging.getLogger(__name__)

GOVERNANCE_BASE_URL = os.getenv("GOVERNANCE_BASE_URL", "http://governance_backend:8002")
REQUEST_TIMEOUT = float(os.getenv("GOVERNANCE_TIMEOUT_SECONDS", "10"))


class GovernanceUnavailableError(RuntimeError):
    """Governance-Backend nicht erreichbar oder Antwort unbrauchbar."""


async def register_project(spec: BuildSpec) -> GovernanceContext:
    """Registriert das Projekt im Governance-Inventar."""
    payload = {
        "project_name": spec.project_name,
        "description": spec.description,
        "data_types": spec.data_types,
        "data_subjects": spec.data_subjects,
        "models": spec.models,
        "llm_provider": spec.llm_provider,
        "jurisdiction": spec.jurisdiction,
        "tags": {"target_stack": spec.target_stack, "source": "builder_orchestrator"},
    }

    url = f"{GOVERNANCE_BASE_URL}/api/v1/governance/register-project"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.error("Governance-Registrierung fehlgeschlagen: %s", exc)
        raise GovernanceUnavailableError(str(exc)) from exc

    return GovernanceContext(
        project_id=data["project_id"],
        risk_tier=data["risk_tier"],
        required_gates=data.get("required_gates", []),
    )


async def gate_check(project_id: str, build_hash: str, artifacts: dict) -> dict:
    """Ruft das CI/CD-Gate für einen konkreten Build auf.

    Wird vom DevOps-Agent vor dem Deployment aufgerufen.
    """
    url = f"{GOVERNANCE_BASE_URL}/api/v1/governance/gate-check"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(
            url,
            json={"project_id": project_id, "build_hash": build_hash, "artifacts": artifacts},
        )
        response.raise_for_status()
        return response.json()


async def activate_inventory(project_id: str, endpoint: str, deployment_timestamp: str) -> dict:
    """Meldet das Projekt als produktiv ans Governance-Inventar.

    Wird ausschließlich vom Governance-Agenten aufgerufen — und der läuft nur,
    wenn das Gate den Build nicht blockiert hat.
    """
    url = f"{GOVERNANCE_BASE_URL}/api/v1/inventory/activate"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(
            url,
            json={
                "project_id": project_id,
                "endpoint": endpoint,
                "deployment_timestamp": deployment_timestamp,
            },
        )
        response.raise_for_status()
        return response.json()


async def send_telemetry(project_id: str, event_type: str, **details: str) -> None:
    """Meldet ein Laufzeit-/Build-Event an das Governance-Backend.

    Fehler werden geschluckt: Telemetrie darf den Build nie blockieren.
    """
    url = f"{GOVERNANCE_BASE_URL}/api/v1/runtime/telemetry"

    # `region` und `model_version` sind im Schema eigene Felder — sie dort zu
    # lassen ist wichtig, weil die Drift-Erkennung des Backends auf `region`
    # schaut und nicht in `details` sucht.
    payload = {
        "project_id": project_id,
        "event_type": event_type,
        "region": details.pop("region", None),
        "model_version": details.pop("model_version", None),
        "details": details,
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        logger.warning("Telemetrie nicht zugestellt (%s): %s", event_type, exc)
