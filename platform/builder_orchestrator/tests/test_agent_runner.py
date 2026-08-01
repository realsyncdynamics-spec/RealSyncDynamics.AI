"""Tests für den Scheduler: Retries, Timeout, Cancellation, Idempotenz.

Ausführen:  cd platform/builder_orchestrator && pytest
"""

from __future__ import annotations

import asyncio

import pytest

from app.agents import devops as devops_agent
from app.schemas import AgentResult, BuildSpec, GovernanceContext
from app.services import agent_runner, audit_log, events, task_graph


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    task_graph.reset()
    agent_runner.reset()
    audit_log.reset()
    events.reset()
    devops_agent.reset()
    # Backoff aus, damit Retry-Tests nicht warten.
    monkeypatch.setattr(agent_runner, "RETRY_BASE_SECONDS", 0.0)
    yield
    task_graph.reset()
    agent_runner.reset()
    audit_log.reset()
    events.reset()
    devops_agent.reset()


def _graph(risk_tier="limited", project_id="prj_run"):
    spec = BuildSpec(project_name="D", description="d", prompt="p")
    ctx = GovernanceContext(project_id=project_id, risk_tier=risk_tier, required_gates=[])
    return task_graph.build_graph(spec, ctx)


def _stub_dispatch(monkeypatch, **handlers):
    """Ersetzt die Agenten-Handler durch Testdoubles."""
    async def ok(task, graph):
        return AgentResult(output={"ok": task.id})

    dispatch = {agent: ok for agent in ("planner", "architect", "coder", "devops", "governance")}
    dispatch.update(handlers)
    monkeypatch.setattr(agent_runner, "AGENT_DISPATCH", dispatch)


# --- Durchlauf ------------------------------------------------------------


@pytest.mark.asyncio
async def test_kompletter_durchlauf_setzt_alles_auf_completed(monkeypatch):
    _stub_dispatch(monkeypatch)
    graph = _graph()
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)

    assert result is not None
    assert all(t.status == "completed" for t in result.tasks)
    assert result.overall_status() == "completed"


@pytest.mark.asyncio
async def test_spawned_tasks_werden_mitgelaufen(monkeypatch):
    """Der Scheduler muss Tasks abarbeiten, die erst zur Laufzeit entstehen."""
    async def architect(task, graph):
        from app.services.task_graph import spawn_coder_tasks

        spawn_coder_tasks(graph, task.id, ["auth", "data"])
        return AgentResult(output={"modules": "auth,data"})

    _stub_dispatch(monkeypatch, architect=architect)
    graph = _graph()
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)

    coder = [t for t in result.tasks if t.agent_type == "coder"]
    assert len(coder) == 2
    assert all(t.status == "completed" for t in coder)


# --- Fehler und Retries ---------------------------------------------------


@pytest.mark.asyncio
async def test_retry_bis_max_attempts_dann_failed(monkeypatch):
    versuche = {"n": 0}

    async def flaky(task, graph):
        versuche["n"] += 1
        raise RuntimeError("kaputt")

    _stub_dispatch(monkeypatch, planner=flaky)
    graph = _graph()
    graph.by_id("task_planner").max_attempts = 3
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)

    assert versuche["n"] == 3
    assert result.by_id("task_planner").status == "failed"
    assert result.by_id("task_planner").attempt == 3


@pytest.mark.asyncio
async def test_retry_gelingt_beim_zweiten_versuch(monkeypatch):
    versuche = {"n": 0}

    async def flaky(task, graph):
        versuche["n"] += 1
        if versuche["n"] == 1:
            raise RuntimeError("einmalig")
        return AgentResult(output={"ok": "2"})

    _stub_dispatch(monkeypatch, planner=flaky)
    graph = _graph()
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)
    assert result.by_id("task_planner").status == "completed"
    assert result.by_id("task_planner").attempt == 2


@pytest.mark.asyncio
async def test_nicht_wiederholbarer_fehler_wird_nicht_erneut_versucht(monkeypatch):
    versuche = {"n": 0}

    class Hart(RuntimeError):
        retryable = False

    async def hart(task, graph):
        versuche["n"] += 1
        raise Hart("Gate blockiert")

    _stub_dispatch(monkeypatch, planner=hart)
    graph = _graph()
    graph.by_id("task_planner").max_attempts = 5
    await task_graph.save_graph(graph)

    await agent_runner.run_graph(graph.project_id)
    assert versuche["n"] == 1


@pytest.mark.asyncio
async def test_fehler_blockiert_nachfolger(monkeypatch):
    async def kaputt(task, graph):
        raise RuntimeError("kaputt")

    _stub_dispatch(monkeypatch, planner=kaputt)
    graph = _graph()
    graph.by_id("task_planner").max_attempts = 1
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)

    assert result.by_id("task_planner").status == "failed"
    assert result.by_id("task_architect").status == "blocked"
    assert result.by_id("task_governance").status == "blocked"


@pytest.mark.asyncio
async def test_timeout_wird_als_fehler_gewertet(monkeypatch):
    async def langsam(task, graph):
        await asyncio.sleep(5)
        return AgentResult()

    _stub_dispatch(monkeypatch, planner=langsam)
    graph = _graph()
    graph.by_id("task_planner").timeout_seconds = 0.05
    graph.by_id("task_planner").max_attempts = 1
    await task_graph.save_graph(graph)

    result = await agent_runner.run_graph(graph.project_id)

    assert result.by_id("task_planner").status == "failed"
    assert "Zeitgrenze" in result.by_id("task_planner").output["error"]


# --- Nebenläufigkeit und Abbruch ------------------------------------------


@pytest.mark.asyncio
async def test_kein_doppel_dispatch(monkeypatch):
    """Zwei parallel gestartete Scheduler dürfen eine Task nicht doppelt laufen lassen."""
    laeufe = {"planner": 0}

    async def zaehlend(task, graph):
        laeufe["planner"] += 1
        await asyncio.sleep(0.02)
        return AgentResult(output={"ok": "1"})

    _stub_dispatch(monkeypatch, planner=zaehlend)
    graph = _graph()
    await task_graph.save_graph(graph)

    await asyncio.gather(
        agent_runner.run_graph(graph.project_id),
        agent_runner.run_graph(graph.project_id),
    )

    assert laeufe["planner"] == 1


@pytest.mark.asyncio
async def test_cancel_plant_nichts_neues_mehr_ein(monkeypatch):
    """Cancel ist graceful: der laufende Task endet regulär, der Rest wird abgebrochen."""
    gestartet = asyncio.Event()

    async def langsam(task, graph):
        gestartet.set()
        await asyncio.sleep(0.05)
        return AgentResult(output={"ok": "1"})

    _stub_dispatch(monkeypatch, planner=langsam)
    graph = _graph()
    await task_graph.save_graph(graph)

    runner = asyncio.create_task(agent_runner.run_graph(graph.project_id))
    await gestartet.wait()
    await agent_runner.cancel_graph(graph.project_id)
    await runner

    result = await task_graph.get_graph(graph.project_id)
    assert result.cancelled is True
    assert all(t.is_terminal() for t in result.tasks)

    # Der laufende Task lief zu Ende; die noch nicht gestarteten sind abgebrochen.
    assert result.by_id("task_planner").status == "completed"
    assert result.by_id("task_governance").output["reason"] == "cancelled"
    assert result.by_id("task_architect").output["reason"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_verhindert_weitere_retries(monkeypatch):
    """Ein Abbruch während der Backoff-Phase beendet die Retry-Schleife."""
    versuche = {"n": 0}

    async def flaky(task, graph):
        versuche["n"] += 1
        await agent_runner.cancel_graph(graph.project_id)
        raise RuntimeError("kaputt")

    _stub_dispatch(monkeypatch, planner=flaky)
    graph = _graph()
    graph.by_id("task_planner").max_attempts = 5
    await task_graph.save_graph(graph)

    await agent_runner.run_graph(graph.project_id)
    assert versuche["n"] == 1


@pytest.mark.asyncio
async def test_cancel_ohne_laufenden_scheduler():
    graph = _graph()
    await task_graph.save_graph(graph)

    result = await agent_runner.cancel_graph(graph.project_id)
    assert all(t.is_terminal() for t in result.tasks)


# --- Prüfpfad und Events --------------------------------------------------


@pytest.mark.asyncio
async def test_jeder_agentenlauf_landet_im_pruefpfad(monkeypatch):
    _stub_dispatch(monkeypatch)
    graph = _graph(project_id="prj_audit")
    await task_graph.save_graph(graph)

    await agent_runner.run_graph(graph.project_id)

    eintraege = audit_log.records("prj_audit")
    assert len(eintraege) == 4  # planner, architect, devops, governance
    assert {e.status for e in eintraege} == {"completed"}
    assert all(e.attempt == 1 for e in eintraege)


@pytest.mark.asyncio
async def test_fehlversuche_stehen_einzeln_im_pruefpfad(monkeypatch):
    async def flaky(task, graph):
        if task.attempt < 2:
            raise RuntimeError("erst mal nicht")
        return AgentResult()

    _stub_dispatch(monkeypatch, planner=flaky)
    graph = _graph(project_id="prj_audit2")
    await task_graph.save_graph(graph)

    await agent_runner.run_graph(graph.project_id)

    planner_eintraege = [e for e in audit_log.records("prj_audit2") if e.task_id == "task_planner"]
    assert [e.status for e in planner_eintraege] == ["failed", "completed"]


@pytest.mark.asyncio
async def test_statuswechsel_werden_als_events_gemeldet(monkeypatch):
    _stub_dispatch(monkeypatch)
    graph = _graph(project_id="prj_events")
    await task_graph.save_graph(graph)

    empfangen = []

    async def sammeln():
        async for event in events.subscribe("prj_events"):
            empfangen.append(event)

    consumer = asyncio.create_task(sammeln())
    await asyncio.sleep(0)  # Abonnent registrieren lassen

    await agent_runner.run_graph(graph.project_id)
    await asyncio.sleep(0.01)
    consumer.cancel()

    stati = {(e.task_id, e.status) for e in empfangen}
    assert ("task_planner", "running") in stati
    assert ("task_planner", "completed") in stati
