"""App Builder Orchestrator — FastAPI-Einstiegspunkt.

Ablauf eines Builds:
  1. BuildSpec entgegennehmen
  2. Projekt beim Governance-Backend registrieren (Risikoklasse + Gates)
  3. Task-Graph aufbauen und den Scheduler anstoßen
  4. Fortschritt über task-status (Pull) oder events (SSE, Push) verfolgen
  5. Website-Audit über Playwright -> Evidence -> Gemini
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
from .middleware import ErrorSanitizationMiddleware, RateLimitMiddleware, RequestSizeLimitMiddleware, SecurityHeadersMiddleware
from .otel import get_tracer, setup_tracing
from .schemas import BuildSpec, CancelRequest, TaskGraph
from .services import agent_runner, budget, db, events, llm, repository, task_graph
from .services.audit_contracts import AuditResult, EvidenceSnapshot, PageSpec
from .services.audit_pipeline import generate_variants, run_audit
from .services.audit_log import records as audit_records
from .services.gemini import GeminiProvider

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"


class AIEditRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=160)
    prompt: str = Field(min_length=1, max_length=4000)
    section_name: str = Field(min_length=1, max_length=120)
    eyebrow: str = Field(default="", max_length=300)
    title: str = Field(default="", max_length=500)
    body: str = Field(default="", max_length=4000)


class AIEditResponse(BaseModel):
    eyebrow: str
    title: str
    body: str


class AuditRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)


class GenerateVariantsRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)
    company_context: str = Field(default="", max_length=6000)
    project_id: str = Field(default="", max_length=160)
    audit: AuditResult | None = None
    evidence: EvidenceSnapshot | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_config()
    if await db.connect():
        await db.apply_migrations(str(MIGRATION))
    repository.select_backend()
    llm.select_provider()
    if os.getenv("LLM_PROVIDER", "").lower() == "gemini" or os.getenv("GEMINI_API_KEY"):
        llm.set_provider(GeminiProvider())
    try:
        yield
    finally:
        await db.disconnect()


app = FastAPI(title="App Builder Orchestrator", version="0.5.0", description="RealSyncDynamicsAI Builder + Playwright Evidence + Gemini + SiteOS.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(ErrorSanitizationMiddleware)
setup_tracing(app, service_name="builder_orchestrator")
tracer = get_tracer(__name__)


@app.get("/health")
async def health() -> dict:
    provider = llm.get_provider()
    return {"status": "ok", "service": "builder_orchestrator", "storage": "postgres" if db.is_enabled() else "memory", "llm_provider": provider.name, "llm_model": getattr(provider, "model", "?"), "auth": "enabled" if auth.is_enabled() else "disabled"}


@app.post("/api/v1/builder/create-spec", dependencies=[Depends(auth.require_tenant)], response_model=TaskGraph)
async def create_spec(spec: BuildSpec) -> TaskGraph:
    with tracer.start_as_current_span("builder.create_spec") as span:
        span.set_attribute("project_name", spec.project_name)
        span.set_attribute("target_stack", spec.target_stack)
        try:
            project = await rsd_client.register_project(spec)
        except rsd_client.GovernanceUnavailableError as exc:
            raise HTTPException(status_code=502, detail=f"Governance-Backend nicht erreichbar: {exc}") from exc
        span.set_attribute("project_id", project.project_id)
        span.set_attribute("risk_tier", project.risk_tier)
        graph = task_graph.build_graph(spec, project)
        await agent_runner.enqueue_initial_tasks(graph)
        return graph


@app.post("/api/v1/builder/ai-edit", dependencies=[Depends(auth.require_tenant)], response_model=AIEditResponse)
async def ai_edit(payload: AIEditRequest) -> AIEditResponse:
    system = "You are the RealSyncDynamics SiteOS visual website editor. Rewrite only the requested section, preserve factual meaning, avoid invented claims, keep it premium and conversion-focused, and return only the requested JSON fields."
    user = f"Project: {payload.project_name}\nSection: {payload.section_name}\nCurrent eyebrow: {payload.eyebrow}\nCurrent title: {payload.title}\nCurrent body: {payload.body}\n\nRequested change: {payload.prompt}\nReturn an improved eyebrow, title and body."
    result, _ = await llm.complete_json(system=system, user=user, model_cls=AIEditResponse, effort="medium", project_id="")
    return result


@app.post("/api/v1/builder/audit/scan", dependencies=[Depends(auth.require_tenant)])
async def audit_scan(payload: AuditRequest) -> dict:
    """Run a real browser scan and return the normalized evidence + audit result."""
    try:
        snapshot, audit = await run_audit(payload.url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Audit konnte nicht durchgeführt werden: {exc}") from exc
    return {"evidence": snapshot.model_dump(), "audit": audit.model_dump()}


@app.post("/api/v1/builder/audit/generate", dependencies=[Depends(auth.require_tenant)])
async def audit_generate(payload: GenerateVariantsRequest) -> dict:
    """Generate four SiteOS PageSpec AST variants from audit evidence."""
    try:
        if payload.evidence is None or payload.audit is None:
            evidence, audit = await run_audit(payload.url, payload.project_id)
        else:
            evidence, audit = payload.evidence, payload.audit
        specs = await generate_variants(company_context=payload.company_context, snapshot=evidence, audit=audit, project_id=payload.project_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Landingpage-Generierung fehlgeschlagen: {exc}") from exc
    return {"evidence_hash": evidence.evidence_hash, "audit": audit.model_dump(), "variants": [s.model_dump() for s in specs]}


@app.get("/api/v1/builder/task-status", dependencies=[Depends(auth.require_tenant)], response_model=TaskGraph)
async def get_task_status(project_id: str) -> TaskGraph:
    graph = await task_graph.get_graph(project_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Kein Task-Graph für {project_id}")
    return graph


@app.post("/api/v1/builder/cancel", dependencies=[Depends(auth.require_tenant)], response_model=TaskGraph)
async def cancel(payload: CancelRequest) -> TaskGraph:
    graph = await agent_runner.cancel_graph(payload.project_id)
    if graph is None:
        raise HTTPException(status_code=404, detail=f"Kein Task-Graph für {payload.project_id}")
    return graph


@app.get("/api/v1/builder/events", dependencies=[Depends(auth.require_tenant)])
async def stream_events(project_id: str) -> StreamingResponse:
    async def event_source():
        async for event in events.subscribe(project_id):
            yield f"data: {json.dumps(event.model_dump())}\n\n"
    return StreamingResponse(event_source(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/v1/builder/audit", dependencies=[Depends(auth.require_tenant)])
async def get_audit(project_id: str) -> dict:
    return {"records": [r.model_dump() for r in audit_records(project_id)], "usage": budget.summary(project_id)}
