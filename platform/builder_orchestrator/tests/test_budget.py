"""Tests des Token-Budgets.

Der wichtigste Test ist nicht „über dem Budget wirft es", sondern
`test_gerissenes_budget_verhindert_deployment`: Ein Build, der sein Budget
reißt, darf nicht trotzdem produktiv gehen. Erst das macht das Budget zu einer
Grenze statt zu einer Warnung.

Zweiter Punkt mit Absicht: Der Verbrauch wird aus dem Prüfpfad gelesen, nicht
separat gezählt. `test_verbrauch_kommt_aus_dem_pruefpfad` hält fest, dass es
nur diese eine Quelle gibt — zwei Zähler würden irgendwann abweichen, und dann
gäbe es zwei Antworten darauf, was ein Build gekostet hat.
"""

from __future__ import annotations

import pytest

from app.services import agent_runner, audit_log, budget, llm, task_graph
from app.schemas import AgentResult, AgentTask, BuildSpec, GovernanceContext, TaskGraph
from app.services.llm import LLMResponse, complete_json
from pydantic import BaseModel

PROJEKT = "prj_budget"


class Beispiel(BaseModel):
    wert: str


class ZaehlenderProvider:
    """Meldet je Aufruf einen festen Verbrauch und zählt die Aufrufe."""

    name = "fake"
    model = "fake-1"

    def __init__(self, tokens: int = 100) -> None:
        self.tokens = tokens
        self.aufrufe = 0

    async def complete(self, *, system, user, schema=None, effort="medium") -> LLMResponse:
        self.aufrufe += 1
        return LLMResponse(
            text='{"wert": "ok"}',
            model=self.model,
            provider=self.name,
            tokens_in=self.tokens // 2,
            tokens_out=self.tokens // 2,
        )


def _buche(tokens: int, project_id: str = PROJEKT) -> None:
    """Schreibt einen Lauf in den Prüfpfad — so wie es der Scheduler tut."""
    audit_log.record(
        project_id=project_id,
        task_id="task_x",
        agent_type="planner",
        attempt=1,
        status="completed",
        duration_ms=1,
        metrics={"model": "fake", "tokens_in": str(tokens // 2), "tokens_out": str(tokens // 2)},
    )


@pytest.fixture(autouse=True)
def _sauber(monkeypatch):
    audit_log.reset()
    task_graph.reset()
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 0)
    yield
    audit_log.reset()
    task_graph.reset()


# --- Verbrauch ---------------------------------------------------------------


def test_ohne_grenze_ist_das_budget_aus():
    _buche(1_000_000)
    assert budget.is_enabled() is False
    budget.ensure_within(PROJEKT)  # wirft nicht
    assert budget.remaining(PROJEKT) == -1


def test_verbrauch_kommt_aus_dem_pruefpfad(monkeypatch):
    """Kein zweiter Zähler: Was im Prüfpfad steht, ist der Verbrauch."""
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 1000)
    _buche(300)
    _buche(200)

    assert budget.used(PROJEKT) == 500
    assert budget.remaining(PROJEKT) == 500


def test_verbrauch_ist_je_build_getrennt(monkeypatch):
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 1000)
    _buche(400, PROJEKT)
    _buche(600, "prj_anderer")

    assert budget.used(PROJEKT) == 400


# --- Grenze ------------------------------------------------------------------


def test_unter_der_grenze_laeuft_es_durch(monkeypatch):
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 1000)
    _buche(500)
    budget.ensure_within(PROJEKT)


def test_ueber_der_grenze_wirft_es(monkeypatch):
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 1000)
    _buche(1000)

    with pytest.raises(budget.BudgetExceeded):
        budget.ensure_within(PROJEKT)


def test_budgetfehler_ist_nicht_wiederholbar():
    """Ein zweiter Versuch verbraucht mehr, nicht weniger — der Scheduler darf
    nicht in eine Retry-Schleife laufen, die genau das Problem verstärkt."""
    assert budget.BudgetExceeded("x").retryable is False


@pytest.mark.asyncio
async def test_aufgebrauchtes_budget_stoppt_den_modellaufruf(monkeypatch):
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 100)
    _buche(150)
    provider = ZaehlenderProvider()

    with pytest.raises(budget.BudgetExceeded):
        await complete_json(
            system="s", user="u", model_cls=Beispiel,
            provider=provider, project_id=PROJEKT,
        )

    assert provider.aufrufe == 0, "Modell wurde trotz aufgebrauchtem Budget gefragt"


@pytest.mark.asyncio
async def test_reparaturversuch_zaehlt_gegen_das_budget(monkeypatch):
    """Eine Reparatur ist ein vollwertiger Aufruf. Wuerde nur der erste Aufruf
    geprueft, koennte ein Build sein Budget ueber die Reparaturschleife
    ueberziehen."""
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 100)

    class KaputterProvider(ZaehlenderProvider):
        async def complete(self, *, system, user, schema=None, effort="medium"):
            antwort = await super().complete(system=system, user=user, schema=schema, effort=effort)
            antwort.text = "kein json"
            # Verbrauch buchen, wie es der Scheduler nach dem Lauf tut.
            _buche(200)
            return antwort

    provider = KaputterProvider()
    with pytest.raises(budget.BudgetExceeded):
        await complete_json(
            system="s", user="u", model_cls=Beispiel,
            provider=provider, project_id=PROJEKT, max_repairs=3,
        )

    assert provider.aufrufe == 1, f"Reparatur lief trotz Budget weiter: {provider.aufrufe}"


@pytest.mark.asyncio
async def test_ohne_project_id_greift_das_budget_nicht(monkeypatch):
    """Aufrufer ausserhalb eines Builds (Skripte, Tests) sollen nicht gegen
    ein fremdes Budget laufen."""
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 1)
    _buche(999)
    provider = ZaehlenderProvider()

    parsed, _ = await complete_json(
        system="s", user="u", model_cls=Beispiel, provider=provider
    )
    assert parsed.wert == "ok"


# --- Fail-closed --------------------------------------------------------------


@pytest.mark.asyncio
async def test_gerissenes_budget_verhindert_deployment(monkeypatch):
    """Der eigentliche Punkt: Ein Build, der sein Budget reisst, geht nicht
    produktiv.

    Bewusst mit den **echten** Agenten-Handlern und nur einem gefaelschten
    Provider — sonst pruefte der Test nur die Verdrahtung des Tests selbst.
    Die Grenze muss aus `complete_json` kommen.
    """
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 150)
    monkeypatch.setattr(agent_runner, "RETRY_BASE_SECONDS", 0.0)
    agent_runner.reset()

    class SchemaProviderMitVerbrauch(llm.StubProvider):
        """Liefert schema-konformes JSON und meldet 100 Tokens je Aufruf."""

        name = "fake"

        def __init__(self) -> None:
            self.aufrufe = 0

        async def complete(self, *, system, user, schema=None, effort="medium"):
            self.aufrufe += 1
            antwort = await super().complete(
                system=system, user=user, schema=schema, effort=effort
            )
            antwort.provider = self.name
            antwort.tokens_in = 50
            antwort.tokens_out = 50
            return antwort

    provider = SchemaProviderMitVerbrauch()
    llm.set_provider(provider)

    spec = BuildSpec(project_name="p", description="d", prompt="x")
    projekt = GovernanceContext(project_id=PROJEKT, risk_tier="minimal")
    graph = task_graph.build_graph(spec, projekt)
    await task_graph.save_graph(graph)

    aktiviert = []

    async def governance_agent(task: AgentTask, g: TaskGraph) -> AgentResult:
        aktiviert.append(task.id)
        return AgentResult(output={"status": "activated"})

    async def devops_agent(task: AgentTask, g: TaskGraph) -> AgentResult:
        return AgentResult(output={"status": "deployed"})

    monkeypatch.setitem(agent_runner.AGENT_DISPATCH, "governance", governance_agent)
    monkeypatch.setitem(agent_runner.AGENT_DISPATCH, "devops", devops_agent)
    monkeypatch.setattr(llm, "LLM_MAX_REPAIRS", 0)

    await agent_runner.run_graph(PROJEKT)

    danach = await task_graph.get_graph(PROJEKT)
    coder = [t for t in danach.tasks if t.agent_type == "coder"]

    assert danach.by_id("task_planner").status == "completed"
    assert danach.by_id("task_architect").status == "completed"
    assert coder, "keine Coder-Tasks entstanden — Test prueft nichts"
    assert all(t.status == "failed" for t in coder), [t.status for t in coder]
    assert danach.by_id("task_devops").status == "blocked"
    assert danach.by_id("task_governance").status == "blocked"
    assert aktiviert == [], "Governance-Agent lief trotz gerissenem Budget"

    llm.set_provider(llm.StubProvider())


@pytest.mark.asyncio
async def test_budgetfehler_loest_keine_retries_aus(monkeypatch):
    """`retryable = False` muss beim Scheduler ankommen — sonst laeuft der
    Task bis `max_attempts` und verbrennt genau das, was fehlt."""
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 10)
    monkeypatch.setattr(agent_runner, "RETRY_BASE_SECONDS", 0.0)
    agent_runner.reset()
    _buche(100)

    spec = BuildSpec(project_name="p", description="d", prompt="x")
    projekt = GovernanceContext(project_id=PROJEKT, risk_tier="minimal")
    graph = task_graph.build_graph(spec, projekt)
    await task_graph.save_graph(graph)

    versuche = []

    async def planner(task: AgentTask, g: TaskGraph) -> AgentResult:
        versuche.append(task.attempt)
        budget.ensure_within(task.input.get("project_id", ""))
        return AgentResult()

    monkeypatch.setitem(agent_runner.AGENT_DISPATCH, "planner", planner)
    await agent_runner.run_graph(PROJEKT)

    assert versuche == [1], f"Task wurde trotz Budgetfehler wiederholt: {versuche}"


# --- Übersicht ---------------------------------------------------------------


def test_summary_ohne_grenze(monkeypatch):
    _buche(120)
    assert budget.summary(PROJEKT) == {
        "tokens_used": 120,
        "token_budget": None,
        "tokens_remaining": None,
    }


def test_summary_mit_grenze(monkeypatch):
    monkeypatch.setattr(budget, "TOKEN_BUDGET", 500)
    _buche(120)
    assert budget.summary(PROJEKT) == {
        "tokens_used": 120,
        "token_budget": 500,
        "tokens_remaining": 380,
    }
