"""Tests für Task-Graph-Aufbau und Agent-Runner-Stub.

Ausführen:  cd platform/builder_orchestrator && pytest
"""

from __future__ import annotations

import pytest

from app.schemas import BuildSpec, GovernanceContext
from app.services import agent_runner, task_graph


@pytest.fixture(autouse=True)
def clean_state():
    task_graph.reset()
    yield
    task_graph.reset()


def _spec(**overrides) -> BuildSpec:
    base = dict(
        project_name="Demo",
        description="Demo-App",
        prompt="Baue ein Kundenportal",
        target_stack="nextjs_supabase",
    )
    base.update(overrides)
    return BuildSpec(**base)


def test_graph_hat_fuenf_tasks_in_kette():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_1", risk_tier="limited", required_gates=["tests_passed"])
    )
    assert [t.agent_type for t in graph.tasks] == [
        "planner",
        "architect",
        "coder",
        "devops",
        "governance",
    ]
    assert graph.by_id("task_architect").depends_on == ["task_planner"]
    assert graph.by_id("task_governance").depends_on == ["task_devops"]


def test_risk_tier_landet_in_jedem_task_input():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_2", risk_tier="high", required_gates=["pii_scan_passed"])
    )
    assert all(t.input["risk_tier"] == "high" for t in graph.tasks)


def test_unacceptable_blockiert_produzierende_tasks():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_3", risk_tier="unacceptable", required_gates=[])
    )
    produzierend = [t for t in graph.tasks if t.agent_type != "governance"]
    assert all(t.status == "blocked" for t in produzierend)


def test_ready_tasks_nur_ohne_offene_abhaengigkeiten():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_4", risk_tier="minimal", required_gates=[])
    )
    ready = graph.ready_tasks()
    assert [t.id for t in ready] == ["task_planner"]


@pytest.mark.asyncio
async def test_enqueue_startet_planner():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_5", risk_tier="minimal", required_gates=[])
    )
    await agent_runner.enqueue_initial_tasks(graph)
    assert graph.by_id("task_planner").status == "running"
    assert graph.by_id("task_architect").status == "pending"


@pytest.mark.asyncio
async def test_enqueue_startet_nichts_bei_blockiertem_graph():
    graph = task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_6", risk_tier="unacceptable", required_gates=[])
    )
    await agent_runner.enqueue_initial_tasks(graph)
    assert all(t.status != "running" for t in graph.tasks)


@pytest.mark.asyncio
async def test_graph_wird_gespeichert_und_gefunden():
    task_graph.build_graph(
        _spec(), GovernanceContext(project_id="prj_7", risk_tier="minimal", required_gates=[])
    )
    assert (await task_graph.get_graph("prj_7")) is not None
    assert (await task_graph.get_graph("prj_unbekannt")) is None
