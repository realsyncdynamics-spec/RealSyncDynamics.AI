"""Tests für Risiko-Einstufung und Gate-Engine.

Ausführen:  cd platform/governance_backend && pytest
"""

from __future__ import annotations

import pytest

from app.schemas import GateCheckArtifacts, GateCheckRequest, ProjectRegistration
from app.services import gate_engine, inventory, risk_evaluator, telemetry_handler


@pytest.fixture(autouse=True)
async def clean_state():
    await inventory.reset()
    telemetry_handler.reset()
    yield
    await inventory.reset()
    telemetry_handler.reset()


def _registration(**overrides) -> ProjectRegistration:
    base = dict(
        project_name="Test",
        description="Ein Testprojekt",
        data_types=[],
        data_subjects=[],
        models=[],
    )
    base.update(overrides)
    return ProjectRegistration(**base)


# --- risk_evaluator --------------------------------------------------------


def test_minimal_ohne_personenbezug():
    tier, gates = risk_evaluator.evaluate(_registration(models=["rule_engine"]))
    assert tier == "minimal"
    assert gates == ["tests_passed"]


def test_limited_bei_generativem_modell():
    tier, gates = risk_evaluator.evaluate(
        _registration(models=["claude-3-5-sonnet"], llm_provider="anthropic")
    )
    assert tier == "limited"
    assert "transparency_notice_enabled" in gates


def test_high_bei_sensiblen_daten():
    tier, gates = risk_evaluator.evaluate(
        _registration(data_types=["health"], data_subjects=["patients"], models=["gpt-4"])
    )
    assert tier == "high"
    assert "model_card_included" in gates
    assert "pii_scan_passed" in gates


def test_high_bei_annex_iii_domaene():
    tier, _ = risk_evaluator.evaluate(
        _registration(data_types=["cv_text"], models=["claude"], tags={"domain": "recruiting"})
    )
    assert tier == "high"


def test_unacceptable_bei_verbotener_praktik():
    tier, gates = risk_evaluator.evaluate(_registration(data_types=["social_scoring"]))
    assert tier == "unacceptable"
    assert gates == []


def test_drittland_ergaenzt_pii_gate():
    tier, gates = risk_evaluator.evaluate(
        _registration(models=["claude"], llm_provider="anthropic", jurisdiction="us")
    )
    assert tier == "limited"
    assert "pii_scan_passed" in gates


# --- gate_engine -----------------------------------------------------------


def _artifacts(**overrides) -> GateCheckArtifacts:
    base = dict(
        tests_passed=True,
        audit_logging_active=True,
        model_card_included=True,
        transparency_notice_enabled=True,
        pii_scan_passed=True,
    )
    base.update(overrides)
    return GateCheckArtifacts(**base)


@pytest.mark.asyncio
async def test_gate_approved_wenn_alle_nachweise_da():
    project_id = await inventory.create_project(
        _registration(models=["claude"]), "limited", ["tests_passed", "transparency_notice_enabled"]
    )
    decision = await gate_engine.evaluate(
        GateCheckRequest(project_id=project_id, build_hash="sha256:abc", artifacts=_artifacts())
    )
    assert decision.status == "approved"


@pytest.mark.asyncio
async def test_gate_blockiert_ohne_model_card_bei_high():
    project_id = await inventory.create_project(
        _registration(data_types=["health"]),
        "high",
        ["tests_passed", "model_card_included", "pii_scan_passed"],
    )
    decision = await gate_engine.evaluate(
        GateCheckRequest(
            project_id=project_id,
            build_hash="sha256:abc",
            artifacts=_artifacts(model_card_included=False),
        )
    )
    assert decision.status == "blocked"
    assert decision.severity == "high"
    assert "Model Card" in (decision.reason or "")


@pytest.mark.asyncio
async def test_gate_warnt_bei_weichem_befund():
    project_id = await inventory.create_project(
        _registration(models=["claude"]),
        "limited",
        ["tests_passed", "transparency_notice_enabled", "audit_logging_active"],
    )
    decision = await gate_engine.evaluate(
        GateCheckRequest(
            project_id=project_id,
            build_hash="sha256:abc",
            artifacts=_artifacts(audit_logging_active=False),
        )
    )
    assert decision.status == "warning"


@pytest.mark.asyncio
async def test_gate_blockiert_unbekanntes_projekt():
    decision = await gate_engine.evaluate(
        GateCheckRequest(project_id="prj_unknown", build_hash="x", artifacts=_artifacts())
    )
    assert decision.status == "blocked"
    assert decision.severity == "high"


@pytest.mark.asyncio
async def test_gate_blockiert_unacceptable_immer():
    project_id = await inventory.create_project(
        _registration(data_types=["social_scoring"]), "unacceptable", []
    )
    decision = await gate_engine.evaluate(
        GateCheckRequest(project_id=project_id, build_hash="x", artifacts=_artifacts())
    )
    assert decision.status == "blocked"


# --- telemetry -------------------------------------------------------------


@pytest.mark.asyncio
async def test_region_change_wird_erfasst():
    from app.schemas import RuntimeTelemetry

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id="prj_x", event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id="prj_x", event_type="region_change", region="us")
    )
    events = telemetry_handler.recent_events("prj_x")
    assert len(events) == 2
    assert events[-1].event_type == "region_change"
