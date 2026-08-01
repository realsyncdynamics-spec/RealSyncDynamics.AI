"""Tests für Graph-Aufbau, Expansion und Propagierung.

Ausführen:  cd platform/builder_orchestrator && pytest
"""

from __future__ import annotations

import pytest

from app.schemas import AgentTask, BuildSpec, GovernanceContext, GraphCycleError
from app.services import task_graph


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


def _ctx(project_id="prj_1", risk_tier="limited", gates=None) -> GovernanceContext:
    return GovernanceContext(
        project_id=project_id, risk_tier=risk_tier, required_gates=gates or ["tests_passed"]
    )


# --- Aufbau ---------------------------------------------------------------


def test_graph_startet_ohne_coder_tasks():
    """Der Modulschnitt steht erst nach dem Architect fest."""
    graph = task_graph.build_graph(_spec(), _ctx())
    assert [t.agent_type for t in graph.tasks] == [
        "planner",
        "architect",
        "devops",
        "governance",
    ]
    assert graph.by_id("task_devops").depends_on == ["task_architect"]


def test_risk_tier_landet_in_jedem_task_input():
    graph = task_graph.build_graph(_spec(), _ctx(risk_tier="high"))
    assert all(t.input["risk_tier"] == "high" for t in graph.tasks)


def test_unacceptable_blockiert_produzierende_tasks():
    graph = task_graph.build_graph(_spec(), _ctx(risk_tier="unacceptable"))
    produzierend = [t for t in graph.tasks if t.agent_type != "governance"]
    assert all(t.status == "blocked" for t in produzierend)


def test_devops_hat_idempotenzschluessel():
    """Tasks mit Außenwirkung brauchen einen stabilen Schlüssel."""
    graph = task_graph.build_graph(_spec(), _ctx(project_id="prj_x"))
    assert graph.by_id("task_devops").idempotency_key == "prj_x:deploy"


def test_ready_tasks_nur_ohne_offene_abhaengigkeiten():
    graph = task_graph.build_graph(_spec(), _ctx(risk_tier="minimal"))
    assert [t.id for t in graph.ready_tasks()] == ["task_planner"]


# --- Dynamische Expansion -------------------------------------------------


def test_spawn_haengt_coder_tasks_zwischen_architect_und_devops():
    graph = task_graph.build_graph(_spec(), _ctx())
    task_graph.spawn_coder_tasks(graph, "task_architect", ["auth", "data", "ui"])

    coder_ids = {t.id for t in graph.tasks if t.agent_type == "coder"}
    assert coder_ids == {"task_coder:auth", "task_coder:data", "task_coder:ui"}

    # Fan-in: DevOps hängt jetzt an allen Coder-Tasks.
    devops_deps = set(graph.by_id("task_devops").depends_on)
    assert coder_ids.issubset(devops_deps)

    # Jede Coder-Task hängt am Architect.
    for cid in coder_ids:
        assert graph.by_id(cid).depends_on == ["task_architect"]


def test_coder_tasks_laufen_parallel():
    """Nach dem Architect sind alle Coder-Tasks gleichzeitig bereit."""
    graph = task_graph.build_graph(_spec(), _ctx())
    graph.by_id("task_planner").status = "completed"
    graph.by_id("task_architect").status = "completed"
    task_graph.spawn_coder_tasks(graph, "task_architect", ["auth", "data"])

    ready = {t.id for t in graph.ready_tasks()}
    assert ready == {"task_coder:auth", "task_coder:data"}
    # DevOps wartet noch auf beide.
    assert "task_devops" not in ready


def test_spawn_mit_doppelter_id_wirft():
    graph = task_graph.build_graph(_spec(), _ctx())
    task_graph.spawn_coder_tasks(graph, "task_architect", ["auth"])
    with pytest.raises(ValueError):
        task_graph.spawn_coder_tasks(graph, "task_architect", ["auth"])


def test_zyklus_wird_erkannt_und_zurueckgebaut():
    graph = task_graph.build_graph(_spec(), _ctx())
    vorher = len(graph.tasks)

    # Eine Task, die von ihrem eigenen Nachfolger abhängt -> Zyklus.
    zyklisch = AgentTask(id="task_zyklus", agent_type="coder", depends_on=["task_governance"])
    with pytest.raises(GraphCycleError):
        graph.insert_spawned("task_devops", [zyklisch])

    # Rückbau: der Graph ist unverändert.
    assert len(graph.tasks) == vorher
    assert graph.by_id("task_zyklus") is None


# --- Fehler-Propagierung --------------------------------------------------


def test_failed_task_blockiert_alle_nachfolger():
    graph = task_graph.build_graph(_spec(), _ctx())
    task_graph.spawn_coder_tasks(graph, "task_architect", ["auth", "data"])

    graph.by_id("task_architect").status = "failed"
    blocked = graph.propagate_block("task_architect", "Architect fehlgeschlagen")

    blocked_ids = {t.id for t in blocked}
    # Direkte und indirekte Nachfolger.
    assert blocked_ids == {
        "task_coder:auth",
        "task_coder:data",
        "task_devops",
        "task_governance",
    }
    assert graph.by_id("task_governance").output["blocked_by"] == "task_devops"


def test_propagierung_laesst_terminale_tasks_unberuehrt():
    graph = task_graph.build_graph(_spec(), _ctx())
    graph.by_id("task_devops").status = "completed"

    graph.propagate_block("task_architect", "x")
    assert graph.by_id("task_devops").status == "completed"


def test_graph_gilt_als_terminal_wenn_nichts_mehr_laufen_kann():
    graph = task_graph.build_graph(_spec(), _ctx())
    graph.by_id("task_planner").status = "failed"
    graph.propagate_block("task_planner", "x")

    assert graph.is_terminal()
    assert graph.overall_status() == "failed"


# --- Persistenz -----------------------------------------------------------


@pytest.mark.asyncio
async def test_graph_wird_gespeichert_und_gefunden():
    graph = task_graph.build_graph(_spec(), _ctx(project_id="prj_7"))
    await task_graph.save_graph(graph)

    assert (await task_graph.get_graph("prj_7")) is not None
    assert (await task_graph.get_graph("prj_unbekannt")) is None
