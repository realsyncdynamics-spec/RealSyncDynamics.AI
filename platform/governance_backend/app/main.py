"""RealSyncDynamicsAI Governance Backend — FastAPI-Einstiegspunkt.

Drei Aufgaben:
  1. Registry:  Projekte registrieren + Risikoklasse bestimmen
  2. CI/CD-Gate: Builds gegen den Gate-Katalog prüfen
  3. Runtime:   Telemetrie deployter Projekte entgegennehmen
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import auth
from .middleware import (
    ErrorSanitizationMiddleware,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .otel import get_tracer, setup_tracing
from .schemas import (
    GateCheckRequest,
    GateCheckResponse,
    Incident,
    IncidentListResponse,
    InventoryActivate,
    ProjectListResponse,
    ProjectRegistration,
    ProjectRegistrationResponse,
    RuntimeTelemetry,
)
from .services import db, gate_engine, incidents, inventory, risk_evaluator, telemetry_handler

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"

# Wie oft fällige Zustellungen wiederholt werden.
REDELIVERY_INTERVAL = float(os.getenv("GOVERNANCE_REDELIVERY_INTERVAL", "60"))


async def _redelivery_loop() -> None:
    """Wiederholt periodisch die Zustellung gescheiterter Befunde.

    Ohne diese Schleife bliebe ein Befund, dessen Webhook einmal danebenging,
    für immer unzugestellt liegen — ein Compliance-Loch, das niemand bemerkt.
    """
    while True:
        try:
            await asyncio.sleep(REDELIVERY_INTERVAL)
            await incidents.redeliver_pending()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - die Schleife darf nie sterben
            logging.getLogger("governance.incidents").exception(
                "Wiederholte Zustellung fehlgeschlagen"
            )


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Verbindet die Datenbank, falls konfiguriert, und wendet die Migration an.

    Schlägt das fehl, läuft der Dienst im In-Memory-Modus weiter — ein
    kurzzeitig nicht erreichbarer Datenbankserver soll die Annahme von
    Telemetrie nicht verhindern. Der Modus steht im Log und unter /health.
    """
    if await db.connect():
        await db.apply_migrations(str(MIGRATION))

    # Nur sinnvoll, wenn überhaupt ein Webhook konfiguriert ist.
    redelivery = (
        asyncio.create_task(_redelivery_loop()) if incidents.WEBHOOK_URL else None
    )
    try:
        yield
    finally:
        if redelivery is not None:
            redelivery.cancel()
            try:
                await redelivery
            except asyncio.CancelledError:
                pass
        await db.disconnect()


app = FastAPI(
    title="RealSyncDynamicsAI Governance Backend",
    version="0.3.0",
    description="EU-AI-Act-/DSGVO-Governance: Registry, CI-CD-Gate, Runtime-Telemetrie.",
    lifespan=lifespan,
)

# Frontend läuft unter eigener Origin (app.localhost) -> CORS nötig.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sicherheits-Middlewares (Reihenfolge: SecurityHeaders → RateLimit → RequestSize → ErrorSanitization → App)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(ErrorSanitizationMiddleware)

setup_tracing(app, service_name="governance_backend")
tracer = get_tracer(__name__)


@app.get("/health")
async def health() -> dict:
    # `storage` macht sichtbar, ob der Prüfpfad einen Neustart überlebt.
    return {
        "status": "ok",
        "service": "governance_backend",
        "storage": "postgres" if db.is_enabled() else "memory",
        # Ein Dienst, der versehentlich ohne Auth laeuft, soll das nicht
        # verstecken — deshalb steht der Zustand hier und nicht nur im Log.
        "auth": "enabled" if auth.is_enabled() else "disabled",
    }


@app.post(
    "/api/v1/governance/register-project",
    dependencies=[Depends(auth.require_tenant)],
    response_model=ProjectRegistrationResponse,
    summary="Projekt registrieren und Risikoklasse bestimmen",
)
async def register_project(payload: ProjectRegistration) -> ProjectRegistrationResponse:
    with tracer.start_as_current_span("governance.register_project") as span:
        risk_tier, required_gates = risk_evaluator.evaluate(payload)
        project_id = await inventory.create_project(payload, risk_tier, required_gates)

        span.set_attribute("project_id", project_id)
        span.set_attribute("risk_tier", risk_tier)
        span.set_attribute("required_gates", ",".join(required_gates))
        span.set_attribute("jurisdiction", payload.jurisdiction or "eu")

        return ProjectRegistrationResponse(
            project_id=project_id,
            risk_tier=risk_tier,
            required_gates=required_gates,
        )


@app.post(
    "/api/v1/governance/gate-check",
    dependencies=[Depends(auth.require_tenant)],
    response_model=GateCheckResponse,
    summary="Build-Artefakte gegen den Gate-Katalog prüfen",
)
async def gate_check(payload: GateCheckRequest) -> GateCheckResponse:
    with tracer.start_as_current_span("governance.gate_check") as span:
        decision = await gate_engine.evaluate(payload)

        span.set_attribute("project_id", payload.project_id)
        span.set_attribute("build_hash", payload.build_hash)
        span.set_attribute("status", decision.status)
        if decision.severity:
            span.set_attribute("severity", decision.severity)

        return decision


@app.get(
    "/api/v1/governance/projects",
    dependencies=[Depends(auth.require_tenant)],
    response_model=ProjectListResponse,
    summary="Projektliste für das Governance-Cockpit",
)
async def list_projects() -> ProjectListResponse:
    return ProjectListResponse(projects=await inventory.list_projects())


@app.post(
    "/api/v1/inventory/activate",
    dependencies=[Depends(auth.require_tenant)],
    summary="Projekt als produktiv melden")
async def activate_inventory(payload: InventoryActivate) -> dict:
    try:
        await inventory.activate(payload)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Projekt {payload.project_id} nicht gefunden")
    return {"status": "ok"}


@app.post(
    "/api/v1/runtime/telemetry",
    dependencies=[Depends(auth.require_tenant)],
    summary="Laufzeit-Event entgegennehmen")
async def runtime_telemetry(payload: RuntimeTelemetry) -> dict:
    with tracer.start_as_current_span("governance.runtime_telemetry") as span:
        span.set_attribute("project_id", payload.project_id)
        span.set_attribute("event_type", payload.event_type)
        if payload.region:
            span.set_attribute("region", payload.region)

        await telemetry_handler.handle(payload)
        return {"status": "accepted"}


@app.get(
    "/api/v1/governance/incidents",
    dependencies=[Depends(auth.require_tenant)],
    response_model=IncidentListResponse,
    summary="Offene und quittierte Befunde der Laufzeitüberwachung",
)
async def list_incidents(
    project_id: Optional[str] = None, status: Optional[str] = None
) -> IncidentListResponse:
    return IncidentListResponse(incidents=await incidents.list_incidents(project_id, status))


@app.post(
    "/api/v1/governance/incidents/redeliver",
    dependencies=[Depends(auth.require_tenant)],
    summary="Fällige, zuvor gescheiterte Zustellungen jetzt wiederholen",
)
async def redeliver_incidents() -> dict:
    """Stößt an, was sonst die Hintergrundschleife erledigt (Ops-Handgriff)."""
    return await incidents.redeliver_pending()


@app.post(
    "/api/v1/governance/incidents/{incident_id}/acknowledge",
    dependencies=[Depends(auth.require_tenant)],
    response_model=Incident,
    summary="Befund quittieren",
)
async def acknowledge_incident(incident_id: str) -> Incident:
    incident = await incidents.acknowledge(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} nicht gefunden")
    return incident
