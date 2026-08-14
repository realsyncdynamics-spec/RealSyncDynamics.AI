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
from pydantic import BaseModel, Field

from . import auth
from .clients import rsd_client
from .config import get_config
from .middleware import (
    ErrorSanitizationMiddleware,
    RateLimitMiddleware,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .otel import get_tracer, setup_tracing
from .schemas import BuildSpec, CancelRequest, TaskGraph
from .services import agent_runner, budget, db, events, llm, repository, task_graph
from .services.audit_log import records as audit_records
from .services.gemini import GeminiProvider

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"


class AIEditRequest(BaseModel):
    """Context sent by the visual SiteOS editor to Gemini."""

    project_name: str = Field(min_length=1, max_length=160)
    prompt: str = Field(min_length=1, max_length=4000)
    section_name: str = Field(min_length=1, max_length=120)
    eyebrow: str = Field(default="", max_length=300)
    title: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=4000)


class AIEditResponse(BaseModel):
    """Structured section update returned by Gemini."""

    eyebrow: str
    title: str
    body: str


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Validiert Konfiguration, verbindet die Datenbank und wählt das Backend."""
    get_config()

    if await db.connect():
        await db.apply_migrations(str(MIGRATION))
    repository.select_backend()
    llm.select_provider()

    # Google AI Studio supplies the Gemini API key. The key stays server-side;
    # the browser only talks to this authenticated Builder API.
    if os.getenv("LLM_PROVIDER", "").lower() == "gemini" or os.getenv("GEMINI_API_KEY"):
        llm.set_provider(GeminiProvider())
    try:
        yield
    finally:
        await db.disconnect()


app = FastAPI(
    title="App Builder Orchestrator",
    version="0.4.0",
    description="Multi-Agent-Task-Graph für den AI-App-Builder, gekoppelt an RealSyncDynamicsAI und Gemini.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(ErrorSanitizationMiddleware)

setup_tracing(app, service_name="builder_orchestrator")
tracer = get_tracer(__name__)


@app.get("/health")
async def health() -> dict:
    provider = llm.get_provider()
    return {
        "status": "ok",
        "service": "builder_orchestrator",
        "storage": "postgres" if db.is_enabled() else "memory",
        "llm_provider": provider.name,
        "llm_model": getattr(provider, "model", "?"),
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
            raise HTTPException(
                status_code=502,
                detail=f"Governance-Backend nicht erreichbar: {exc}",
            ) from exc

        span.set_attribute("project_id", project.project_id)
        span.set_attribute("risk_tier", project.risk_tier)

        graph = task_graph.build_graph(spec, project)
        await agent_runner.enqueue_initial_tasks(graph)
        return graph


@app.post(
    "/api/v1/builder/ai-edit",
    dependencies=[Depends(auth.require_tenant)],
    response_model=AIEditResponse,
    summary="Gemini AI Studio Editor: Abschnitt anhand eines Prompts umschreiben",
)
async def ai_edit(payload: AIEditRequest) -> AIEditResponse:
    """Apply an AI Studio-style natural-language edit to one visual section.

    The same structured-output and budget enforcement used by the agent graph
    is reused here. No Gemini key or raw provider call is exposed to the client.
    """
    system = (
        "You are the RealSyncDynamics SiteOS visual website editor. "
        "Rewrite only the requested website section. Preserve factual meaning, "
        "avoid invented claims, keep language conversion-focused and premium, "
        "and return only the requested JSON fields. Consider EU privacy, "
        "accessibility, SEO and AI-governance implications."
    )
    user = (
        f"Project: {payload.project_name}\n"
        f"Section: {payload.section_name}\n"
        f"Current eyebrow: {payload.eyebrow}\n"
        f"Current title: {payload.title}\n"
        f"Current body: {payload.body}\n\n"
        f"Requested change: {payload.prompt}\n\n"
        "Return an improved eyebrow, title and body for this section."
    )

    result, _ = await llm.complete_json(
        system=system,
        user=user,
        model_cls=AIEditResponse,
        effort="medium",
        project_id="",
    )
    return result


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
    return {
        "records": [r.model_dump() for r in audit_records(project_id)],
        "usage": budget.summary(project_id),
    }
