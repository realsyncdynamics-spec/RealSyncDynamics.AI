"""RealSyncDynamicsAI Governance Backend — FastAPI-Einstiegspunkt.

Drei Aufgaben:
  1. Registry:  Projekte registrieren + Risikoklasse bestimmen
  2. CI/CD-Gate: Builds gegen den Gate-Katalog prüfen
  3. Runtime:   Telemetrie deployter Projekte entgegennehmen
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .otel import get_tracer, setup_tracing
from .schemas import (
    GateCheckRequest,
    GateCheckResponse,
    InventoryActivate,
    ProjectListResponse,
    ProjectRegistration,
    ProjectRegistrationResponse,
    RuntimeTelemetry,
)
from .services import gate_engine, inventory, risk_evaluator, telemetry_handler

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

app = FastAPI(
    title="RealSyncDynamicsAI Governance Backend",
    version="0.1.0",
    description="EU-AI-Act-/DSGVO-Governance: Registry, CI-CD-Gate, Runtime-Telemetrie.",
)

# Frontend läuft unter eigener Origin (app.localhost) -> CORS nötig.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_tracing(app, service_name="governance_backend")
tracer = get_tracer(__name__)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "governance_backend"}


@app.post(
    "/api/v1/governance/register-project",
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
    response_model=GateCheckResponse,
    summary="Build-Artefakte gegen den Gate-Katalog prüfen",
)
async def gate_check(payload: GateCheckRequest) -> GateCheckResponse:
    with tracer.start_as_current_span("governance.gate_check") as span:
        decision = gate_engine.evaluate(payload)

        span.set_attribute("project_id", payload.project_id)
        span.set_attribute("build_hash", payload.build_hash)
        span.set_attribute("status", decision.status)
        if decision.severity:
            span.set_attribute("severity", decision.severity)

        return decision


@app.get(
    "/api/v1/governance/projects",
    response_model=ProjectListResponse,
    summary="Projektliste für das Governance-Cockpit",
)
async def list_projects() -> ProjectListResponse:
    return ProjectListResponse(projects=inventory.list_projects())


@app.post("/api/v1/inventory/activate", summary="Projekt als produktiv melden")
async def activate_inventory(payload: InventoryActivate) -> dict:
    try:
        await inventory.activate(payload)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Projekt {payload.project_id} nicht gefunden")
    return {"status": "ok"}


@app.post("/api/v1/runtime/telemetry", summary="Laufzeit-Event entgegennehmen")
async def runtime_telemetry(payload: RuntimeTelemetry) -> dict:
    with tracer.start_as_current_span("governance.runtime_telemetry") as span:
        span.set_attribute("project_id", payload.project_id)
        span.set_attribute("event_type", payload.event_type)
        if payload.region:
            span.set_attribute("region", payload.region)

        await telemetry_handler.handle(payload)
        return {"status": "accepted"}
