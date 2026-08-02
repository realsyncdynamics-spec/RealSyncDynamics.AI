"""App Builder Orchestrator — FastAPI-Einstiegspunkt.

Ablauf eines Builds:
  1. BuildSpec entgegennehmen
  2. Projekt beim Governance-Backend registrieren (Risikoklasse + Gates)
  3. Task-Graph aufbauen und den Scheduler anstoßen
  4. Fortschritt über task-status (Pull) oder events (SSE, Push) verfolgen
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import auth
from .clients import rsd_client
from .otel import get_tracer, setup_tracing
from .schemas import BuildSpec, CancelRequest, TaskGraph
from .services import agent_runner, db, events, llm, repository, task_graph
from .services.audit_log import records as audit_records

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Verbindet die Datenbank, falls konfiguriert, und wählt das Backend.

    Ohne erreichbare Datenbank läuft der Orchestrator prozesslokal weiter —
    Builds gehen dann bei einem Neustart verloren, aber der Dienst nimmt
    weiterhin Aufträge an. Welcher Modus aktiv ist, steht unter /health.
    """
    if await db.connect():
        await db.apply_migrations(str(MIGRATION))
    repository.select_backend()
    llm.select_provider()
    try:
        yield
    finally:
        await db.disconnect()


app = FastAPI(
    title="App Builder Orchestrator",
    version="0.3.0",
    description="Multi-Agent-Task-Graph für den AI-App-Builder, gekoppelt an RealSyncDynamicsAI.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_tracing(app, service_name="builder_orchestrator")
tracer = get_tracer(__name__)


@app.get("/health")
async def health() -> dict:
    # `storage` macht sichtbar, ob laufende Builds einen Neustart überleben,
    # `llm_provider`, ob wirklich ein Modell antwortet oder der Stub — beides
    # sind Betriebszustände, die man von außen sehen können muss.
    provider = llm.get_provider()
    return {
        "status": "ok",
        "service": "builder_orchestrator",
        "storage": "postgres" if db.is_enabled() else "memory",
        "llm_provider": provider.name,
        "llm_model": getattr(provider, "model", "?"),
        # Ein Dienst, der versehentlich ohne Auth laeuft, soll das nicht
        # verstecken — deshalb steht der Zustand hier und nicht nur im Log.
        "auth": "enabled" if auth.is_enabled() else "disabled",
    }


@app.post(
    "/api/v1/builder/create-spec",
    dependencies=[Depends(auth.require_tenant)],
    response_model=TaskGraph,
    summary="BuildSpec registrieren, Task-Graph erzeugen und starten",
)
async def create_spec(spec: BuildSpec) -> TaskGraph:
    with tracer.start_as_current_span("builder.create_spec") as span:
        span.set_attribute("project_name", spec.project_name)
        span.set_attribute("target_stack", spec.target_stack)

        try:
            project = await rsd_client.register_project(spec)
        except rsd_client.GovernanceUnavailableError as exc:
            # Ohne Governance-Einstufung wird nicht gebaut (Fail-Closed).
            raise HTTPException(
                status_code=502,
                detail=f"Governance-Backend nicht erreichbar: {exc}",
            ) from exc

        span.set_attribute("project_id", project.project_id)
        span.set_attribute("risk_tier", project.risk_tier)

        graph = task_graph.build_graph(spec, project)
        await agent_runner.enqueue_initial_tasks(graph)
        return graph


@app.get(
    "/api/v1/builder/task-status",
    dependencies=[Depends(auth.require_tenant)],
    response_model=TaskGraph,
    summary="Status des Task-Graphen abfragen",
)
async def get_task_status(project_id: str) -> TaskGraph:
    graph = await task_graph.get_graph(project_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Kein Task-Graph für {project_id}")
    return graph


@app.post(
    "/api/v1/builder/cancel",
    dependencies=[Depends(auth.require_tenant)],
    response_model=TaskGraph,
    summary="Laufenden Build abbrechen",
)
async def cancel(payload: CancelRequest) -> TaskGraph:
    graph = await agent_runner.cancel_graph(payload.project_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Kein Task-Graph für {payload.project_id}")
    return graph


@app.get(
    "/api/v1/builder/events",
    dependencies=[Depends(auth.require_tenant)],
    summary="Task-Übergänge als Server-Sent-Events",
)
async def stream_events(project_id: str) -> StreamingResponse:
    """Live-Stream der Statuswechsel — das Frontend muss nicht pollen.

    Den Ausgangszustand holt der Client über `task-status`; hier kommen nur
    die Übergänge ab dem Verbindungszeitpunkt.
    """

    async def event_source():
        async for event in events.subscribe(project_id):
            yield f"data: {json.dumps(event.model_dump())}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get(
    "/api/v1/builder/audit",
    dependencies=[Depends(auth.require_tenant)],
    summary="Prüfpfad der Agentenläufe eines Projekts",
)
async def get_audit(project_id: str) -> dict:
    return {"records": [r.model_dump() for r in audit_records(project_id)]}
