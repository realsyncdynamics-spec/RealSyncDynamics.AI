"""Tests der Task-Graph-Persistenz gegen eine echte Postgres-Instanz.

Übersprungen, wenn `TEST_DATABASE_URL` nicht gesetzt ist.

Der wichtigste Test hier ist `test_nebenlaeufige_tasks_verlieren_keine_status`:
Er deckt genau den Fehler ab, den ein naives „Graph als JSONB-Blob" erzeugt
hätte — zwei gleichzeitig fertig werdende Tasks überschreiben sich gegenseitig.
In-Memory fällt das nie auf, weil dort alle dieselbe Objektreferenz teilen.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest

from app.schemas import AgentResult, AgentTask, BuildSpec, GovernanceContext
from app.services import agent_runner, db, repository, task_graph

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="TEST_DATABASE_URL nicht gesetzt"
)

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"


@pytest.fixture(autouse=True)
async def postgres(monkeypatch):
    monkeypatch.setattr(db, "DATABASE_URL", TEST_DATABASE_URL)
    assert await db.connect(), "Postgres nicht erreichbar"
    await db.apply_migrations(str(MIGRATION))
    repository.select_backend()

    async with db.pool().connection() as conn:
        await conn.execute("truncate builder_task_graphs cascade")

    agent_runner.reset()
    monkeypatch.setattr(agent_runner, "RETRY_BASE_SECONDS", 0.0)
    yield
    async with db.pool().connection() as conn:
        await conn.execute("truncate builder_task_graphs cascade")
    await db.disconnect()
    repository.select_backend()
    agent_runner.reset()


def _graph(project_id="prj_pg", risk_tier="limited"):
    spec = BuildSpec(project_name="D", description="d", prompt="p")
    ctx = GovernanceContext(project_id=project_id, risk_tier=risk_tier, required_gates=["x"])
    return task_graph.build_graph(spec, ctx)


def _stub_dispatch(monkeypatch, **handlers):
    async def ok(task, graph):
        return AgentResult(output={"ok": task.id})

    dispatch = {a: ok for a in ("planner", "architect", "coder", "devops", "governance")}
    dispatch.update(handlers)
    monkeypatch.setattr(agent_runner, "AGENT_DISPATCH", dispatch)


# --- Grundlagen ------------------------------------------------------------


@pytest.mark.asyncio
async def test_backend_ist_postgres():
    assert repository.get_repository().__class__.__name__ == "PostgresGraphRepository"


@pytest.mark.asyncio
async def test_migration_ist_wiederholbar():
    await db.apply_migrations(str(MIGRATION))
    await db.apply_migrations(str(MIGRATION))


@pytest.mark.asyncio
async def test_graph_ueberlebt_reconnect():
    graph = _graph()
    await task_graph.save_graph(graph)

    await db.disconnect()
    await db.connect()

    geladen = await task_graph.get_graph("prj_pg")
    assert geladen is not None
    assert [t.id for t in geladen.tasks] == [
        "task_planner",
        "task_architect",
        "task_devops",
        "task_governance",
    ]
    assert geladen.by_id("task_devops").depends_on == ["task_architect"]
    assert geladen.by_id("task_devops").idempotency_key == "prj_pg:deploy"
    assert geladen.by_id("task_planner").input["risk_tier"] == "limited"


@pytest.mark.asyncio
async def test_unbekannter_graph_ist_none():
    assert await task_graph.get_graph("prj_gibtsnicht") is None


@pytest.mark.asyncio
async def test_reihenfolge_bleibt_stabil():
    graph = _graph()
    await task_graph.save_graph(graph)
    task_graph.spawn_coder_tasks(graph, "task_architect", ["auth", "data", "ui"])
    await task_graph.save_graph(graph)

    geladen = await task_graph.get_graph("prj_pg")
    assert [t.id for t in geladen.tasks] == [t.id for t in graph.tasks]


# --- Der eigentliche Punkt -------------------------------------------------


@pytest.mark.asyncio
async def test_nebenlaeufige_tasks_verlieren_keine_status(monkeypatch):
    """Drei parallel laufende Coder-Tasks — jede darf genau einmal laufen.

    Das ist der Test, wegen dem Tasks in eigenen Zeilen liegen. Würde jede Task
    den **ganzen** Graphen zurückschreiben, überschriebe die zuletzt fertige die
    `completed`-Zustände der anderen. Der Scheduler fände sie danach wieder als
    `pending` vor und würde sie **ein zweites Mal ausführen** — bei einem
    LLM-Aufruf bare Kosten, bei einem Deployment schlimmer.

    Der Endzustand allein verrät das nicht: Nach dem zweiten Lauf steht wieder
    überall `completed`. Deshalb zählt der Test die Aufrufe.
    """

    async def architect(task, graph):
        return AgentResult(
            output={"modules": "auth,data,ui"},
            spawn=task_graph.build_coder_tasks(graph, task.id, ["auth", "data", "ui"]),
        )

    laeufe: dict[str, int] = {}

    async def coder(task, graph):
        modul = task.input.get("module", "")
        laeufe[modul] = laeufe.get(modul, 0) + 1
        # Alle drei laufen wirklich gleichzeitig los.
        await asyncio.sleep(0.05)
        return AgentResult(output={"module": modul})

    _stub_dispatch(monkeypatch, architect=architect, coder=coder)

    graph = _graph()
    await task_graph.save_graph(graph)
    await agent_runner.run_graph("prj_pg")

    assert laeufe == {"auth": 1, "data": 1, "ui": 1}, f"Doppelausführung: {laeufe}"

    geladen = await task_graph.get_graph("prj_pg")
    coder_tasks = [t for t in geladen.tasks if t.agent_type == "coder"]
    assert len(coder_tasks) == 3
    assert all(t.status == "completed" for t in coder_tasks)
    assert {t.output["module"] for t in coder_tasks} == {"auth", "data", "ui"}
    assert all(t.status == "completed" for t in geladen.tasks)


@pytest.mark.asyncio
async def test_gespawnte_tasks_landen_in_der_datenbank(monkeypatch):
    async def architect(task, graph):
        return AgentResult(spawn=task_graph.build_coder_tasks(graph, task.id, ["auth", "data"]))

    _stub_dispatch(monkeypatch, architect=architect)

    graph = _graph()
    await task_graph.save_graph(graph)
    await agent_runner.run_graph("prj_pg")

    await db.disconnect()
    await db.connect()

    geladen = await task_graph.get_graph("prj_pg")
    coder_ids = {t.id for t in geladen.tasks if t.agent_type == "coder"}
    assert coder_ids == {"task_coder:auth", "task_coder:data"}
    # Der Fan-in muss ebenfalls persistiert sein.
    assert coder_ids.issubset(set(geladen.by_id("task_devops").depends_on))


# --- Fehlerpfade -----------------------------------------------------------


@pytest.mark.asyncio
async def test_blockierte_nachfolger_werden_gespeichert(monkeypatch):
    async def kaputt(task, graph):
        raise RuntimeError("kaputt")

    _stub_dispatch(monkeypatch, planner=kaputt)

    graph = _graph()
    graph.by_id("task_planner").max_attempts = 1
    await task_graph.save_graph(graph)
    await agent_runner.run_graph("prj_pg")

    await db.disconnect()
    await db.connect()

    geladen = await task_graph.get_graph("prj_pg")
    assert geladen.by_id("task_planner").status == "failed"
    assert geladen.by_id("task_architect").status == "blocked"
    assert geladen.by_id("task_governance").status == "blocked"
    assert geladen.by_id("task_governance").output["blocked_by"] == "task_devops"


@pytest.mark.asyncio
async def test_versuchszaehler_wird_gespeichert(monkeypatch):
    async def flaky(task, graph):
        if task.attempt < 2:
            raise RuntimeError("noch nicht")
        return AgentResult()

    _stub_dispatch(monkeypatch, planner=flaky)

    graph = _graph()
    await task_graph.save_graph(graph)
    await agent_runner.run_graph("prj_pg")

    geladen = await task_graph.get_graph("prj_pg")
    assert geladen.by_id("task_planner").attempt == 2
    assert geladen.by_id("task_planner").status == "completed"


@pytest.mark.asyncio
async def test_abbruch_wird_gespeichert(monkeypatch):
    gestartet = asyncio.Event()

    async def langsam(task, graph):
        gestartet.set()
        await asyncio.sleep(0.05)
        return AgentResult()

    _stub_dispatch(monkeypatch, planner=langsam)

    graph = _graph()
    await task_graph.save_graph(graph)

    runner = asyncio.create_task(agent_runner.run_graph("prj_pg"))
    await gestartet.wait()
    await agent_runner.cancel_graph("prj_pg")
    await runner

    await db.disconnect()
    await db.connect()

    geladen = await task_graph.get_graph("prj_pg")
    assert geladen.cancelled is True
    assert geladen.by_id("task_governance").output["reason"] == "cancelled"


@pytest.mark.asyncio
async def test_unacceptable_graph_wird_blockiert_gespeichert():
    graph = _graph(risk_tier="unacceptable")
    await task_graph.save_graph(graph)

    geladen = await task_graph.get_graph("prj_pg")
    produzierend = [t for t in geladen.tasks if t.agent_type != "governance"]
    assert all(t.status == "blocked" for t in produzierend)
    assert "Art. 5" in geladen.by_id("task_planner").output["reason"]


@pytest.mark.asyncio
async def test_task_upsert_ist_idempotent():
    """Zweimal dieselbe Task schreiben darf keine zweite Zeile erzeugen."""
    graph = _graph()
    await task_graph.save_graph(graph)

    task = graph.by_id("task_planner")
    task.status = "running"
    await task_graph.save_task("prj_pg", task)
    task.status = "completed"
    await task_graph.save_task("prj_pg", task)

    geladen = await task_graph.get_graph("prj_pg")
    assert len([t for t in geladen.tasks if t.id == "task_planner"]) == 1
    assert geladen.by_id("task_planner").status == "completed"


# --- Mandantentrennung gegen echtes Postgres ---------------------------------
#
# Die Isolationstests in test_auth.py laufen gegen den In-Memory-Speicher. Die
# WHERE-Klauseln der SQL-Abfragen sind dort nicht beteiligt — genau sie sind
# aber die Stelle, an der Mandantentrennung mit Datenbank steht oder fällt.


@pytest.mark.asyncio
async def test_fremder_graph_ist_in_postgres_nicht_lesbar():
    from app import auth

    auth.set_tenant("11111111-1111-1111-1111-111111111111")
    await task_graph.save_graph(_graph("prj_isoliert"))

    auth.set_tenant("22222222-2222-2222-2222-222222222222")
    assert await task_graph.get_graph("prj_isoliert") is None
    assert await repository.get_repository().list_ids() == []

    auth.set_tenant("11111111-1111-1111-1111-111111111111")
    graph = await task_graph.get_graph("prj_isoliert")
    assert graph is not None and len(graph.tasks) == 4
    auth.set_tenant(auth.DEFAULT_TENANT_ID)


@pytest.mark.asyncio
async def test_fremder_upsert_ueberschreibt_keine_daten():
    """`on conflict do update` ohne Mandantenbedingung waere ein Schreibweg in
    fremde Zeilen: Dieselbe project_id genuegt, um Status und Ausgabe eines
    fremden Builds zu ueberschreiben.

    Auf `tenant_id` zu pruefen reicht dafuer nicht — die Spalte steht nicht in
    der SET-Liste und bleibt so oder so stehen. Geprueft wird deshalb, was
    tatsaechlich Schaden anrichtet: die Nutzdaten.
    """
    from app import auth

    MANDANT_A = "11111111-1111-1111-1111-111111111111"
    MANDANT_B = "22222222-2222-2222-2222-222222222222"

    auth.set_tenant(MANDANT_A)
    graph_a = _graph("prj_kollision")
    graph_a.by_id("task_planner").status = "completed"
    graph_a.by_id("task_planner").output = {"gehoert": "mandant_a"}
    await task_graph.save_graph(graph_a)

    # Mandant B schreibt unter derselben project_id — mit anderem Zustand.
    auth.set_tenant(MANDANT_B)
    graph_b = _graph("prj_kollision")
    graph_b.cancelled = True
    graph_b.by_id("task_planner").status = "failed"
    graph_b.by_id("task_planner").output = {"gehoert": "mandant_b"}
    await task_graph.save_graph(graph_b)

    auth.set_tenant(MANDANT_A)
    danach = await task_graph.get_graph("prj_kollision")
    planer = danach.by_id("task_planner")

    assert danach.cancelled is False, "fremder Mandant hat den Build abgebrochen"
    assert planer.status == "completed", f"Status ueberschrieben: {planer.status}"
    assert planer.output == {"gehoert": "mandant_a"}, f"Ausgabe ueberschrieben: {planer.output}"
    auth.set_tenant(auth.DEFAULT_TENANT_ID)
