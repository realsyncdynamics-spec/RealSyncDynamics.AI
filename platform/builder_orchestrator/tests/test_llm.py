"""Tests der Modellanbindung.

Alle Tests laufen ohne API-Key und ohne Netzzugriff: Statt eines echten
Providers steht ein Fake, der vorgegebene Antworten der Reihe nach ausliefert
und mitzählt, wie oft er gefragt wurde. Genau diese Zählung ist der Punkt —
sie belegt, dass die Reparaturschleife begrenzt ist und im Normalfall gar
nicht anläuft.
"""

from __future__ import annotations

import json
from typing import List

import pytest
from pydantic import BaseModel

from app.agents import architect, coder, planner
from app.agents.contracts import ArchitectOutput, MAX_MODULES, PlannerOutput, sanitize_modules
from app.schemas import AgentTask, BuildSpec, GovernanceContext, TaskGraph
from app.services import llm, task_graph
from app.services.llm import (
    LLMContractError,
    LLMRefusalError,
    LLMResponse,
    StubProvider,
    build_schema,
    complete_json,
    parse_json_output,
)


class FakeProvider:
    """Liefert vorgegebene Texte der Reihe nach und zählt die Aufrufe."""

    name = "fake"
    model = "fake-1"

    def __init__(self, antworten: List[str]) -> None:
        self.antworten = list(antworten)
        self.aufrufe = 0
        self.prompts: List[str] = []
        self.schemas: List[dict] = []

    async def complete(self, *, system, user, schema=None, effort="medium") -> LLMResponse:
        self.aufrufe += 1
        self.prompts.append(user)
        self.schemas.append(schema or {})
        text = self.antworten.pop(0) if self.antworten else "{}"
        return LLMResponse(
            text=text, model=self.model, provider=self.name, tokens_in=11, tokens_out=22
        )


class Beispiel(BaseModel):
    titel: str
    zahl: int


@pytest.fixture(autouse=True)
def _reset():
    task_graph.reset()
    yield
    task_graph.reset()
    llm.set_provider(StubProvider())


# --- Parsing -----------------------------------------------------------------


def test_codeblock_wird_entfernt():
    """Modelle setzen gern einen Markdown-Fence — das darf nicht scheitern."""
    parsed = parse_json_output('```json\n{"titel": "a", "zahl": 1}\n```', Beispiel)
    assert parsed.titel == "a"


def test_leere_antwort_wirft():
    with pytest.raises(ValueError):
        parse_json_output("   ", Beispiel)


# --- Reparaturschleife -------------------------------------------------------


@pytest.mark.asyncio
async def test_gueltige_antwort_ohne_reparatur():
    provider = FakeProvider(['{"titel": "ok", "zahl": 3}'])

    parsed, response = await complete_json(
        system="s", user="u", model_cls=Beispiel, provider=provider
    )

    assert parsed.zahl == 3
    assert provider.aufrufe == 1, "kein Zusatzaufruf bei gültiger Antwort"
    assert response.repairs == 0


@pytest.mark.asyncio
async def test_reparatur_bekommt_fehlertext_mit():
    """Der zweite Aufruf muss den konkreten Verstoß enthalten — sonst rät das
    Modell nur neu, statt zu korrigieren."""
    provider = FakeProvider(['{"titel": "ok"}', '{"titel": "ok", "zahl": 7}'])

    parsed, response = await complete_json(
        system="s", user="u", model_cls=Beispiel, provider=provider, max_repairs=1
    )

    assert parsed.zahl == 7
    assert provider.aufrufe == 2
    assert response.repairs == 1
    assert "zahl" in provider.prompts[1], "Reparatur-Prompt nennt das fehlende Feld nicht"
    assert "u" in provider.prompts[1], "ursprüngliche Aufgabe fehlt im Reparatur-Prompt"


@pytest.mark.asyncio
async def test_reparatur_ist_begrenzt():
    """Ein Modell, das die Form nicht trifft, darf nicht endlos kosten."""
    provider = FakeProvider(["kein json", "auch kein json", "immer noch nicht"])

    with pytest.raises(LLMContractError):
        await complete_json(
            system="s", user="u", model_cls=Beispiel, provider=provider, max_repairs=1
        )

    assert provider.aufrufe == 2, f"Budget überschritten: {provider.aufrufe} Aufrufe"


@pytest.mark.asyncio
async def test_max_repairs_null_erlaubt_keinen_zweiten_versuch():
    provider = FakeProvider(["kaputt"])

    with pytest.raises(LLMContractError):
        await complete_json(
            system="s", user="u", model_cls=Beispiel, provider=provider, max_repairs=0
        )

    assert provider.aufrufe == 1


@pytest.mark.asyncio
async def test_schema_wird_mitgegeben():
    """Ohne Schema im Aufruf gibt es keine Structured-Output-Garantie."""
    provider = FakeProvider(['{"titel": "ok", "zahl": 1}'])
    await complete_json(system="s", user="u", model_cls=Beispiel, provider=provider)

    schema = provider.schemas[0]
    assert schema["type"] == "object"
    assert set(schema["properties"]) == {"titel", "zahl"}


# --- Schema-Aufbereitung -----------------------------------------------------


def test_verschachtelte_modelle_werden_aufgeloest():
    """`$ref`/`$defs` würden voraussetzen, dass der Provider Verweise kennt."""
    schema = build_schema(PlannerOutput)

    assert "$defs" not in schema
    assert "$ref" not in json.dumps(schema)
    feature = schema["properties"]["features"]["items"]
    assert set(feature["properties"]) == {"name", "description", "priority"}


def test_felder_mit_default_bleiben_pflicht():
    """Pydantic lässt sie aus `required` heraus; strikte Modi verlangen sie."""
    schema = build_schema(PlannerOutput)

    assert set(schema["required"]) == {"features", "open_questions", "compliance_notes"}
    # Auch im aufgelösten Untermodell (priority hat einen Default).
    assert "priority" in schema["properties"]["features"]["items"]["required"]


def test_rekursives_schema_wird_abgelehnt():
    """Lieber ein klarer Fehler beim Bauen als eine Endlosschleife."""

    class Knoten(BaseModel):
        name: str
        kinder: List["Knoten"] = []

    Knoten.model_rebuild()

    with pytest.raises(LLMContractError):
        build_schema(Knoten)


# --- Fehlerklassen -----------------------------------------------------------


def test_ablehnung_ist_nicht_wiederholbar():
    """Der Scheduler liest `retryable` am Exception-Objekt; eine Ablehnung
    darf keinen zweiten, gleich teuren Versuch auslösen."""
    assert LLMRefusalError("x").retryable is False
    assert LLMContractError("x").retryable is False


# --- Stub-Provider -----------------------------------------------------------


@pytest.mark.asyncio
async def test_stub_erfuellt_den_vertrag():
    """Ohne API-Key muss der Ablauf trotzdem durchlaufen — sonst ist der Stack
    ohne Zugangsdaten nicht startbar."""
    parsed, response = await complete_json(
        system="s", user="u", model_cls=PlannerOutput, provider=StubProvider()
    )

    assert parsed.features == []
    assert response.provider == "stub"
    assert response.repairs == 0


# --- Modulnamen --------------------------------------------------------------


def test_modulnamen_werden_id_tauglich():
    assert sanitize_modules(["Auth Service", "data/store", "UI"]) == ["auth_service", "datastore", "ui"]


def test_doppelte_module_fliegen_raus():
    """Zwei gleiche Namen ergäben zweimal dieselbe Task-ID — insert_spawned
    würde werfen und der ganze Build scheitern."""
    assert sanitize_modules(["auth", "Auth", "AUTH"]) == ["auth"]


def test_fan_out_ist_gedeckelt():
    assert len(sanitize_modules([f"modul{i}" for i in range(50)])) == MAX_MODULES


# --- Agenten gegen den Fake --------------------------------------------------


def _graph() -> TaskGraph:
    spec = BuildSpec(project_name="p", description="d", prompt="Baue eine Notiz-App")
    project = GovernanceContext(project_id="proj_1", risk_tier="limited", required_gates=["tests_passed"])
    return task_graph.build_graph(spec, project)


@pytest.mark.asyncio
async def test_planner_uebernimmt_modellantwort():
    graph = _graph()
    llm.set_provider(
        FakeProvider(
            [
                json.dumps(
                    {
                        "features": [{"name": "Login", "description": "Anmeldung", "priority": 1}],
                        "open_questions": ["Welche Rollen?"],
                        "compliance_notes": ["Transparenzhinweis nötig"],
                    }
                )
            ]
        )
    )

    result = await planner.run(graph.by_id("task_planner"), graph)

    assert result.output["feature_count"] == "1"
    assert "Login" in result.output["features"]
    # Die Risikoklasse wird immer angehängt, auch wenn das Modell schweigt.
    assert "limited" in result.output["compliance_notes"]
    assert result.metrics["tokens_in"] == "11"
    assert result.metrics["provider"] == "fake"


@pytest.mark.asyncio
async def test_architect_spawnt_module_aus_der_antwort():
    graph = _graph()
    llm.set_provider(
        FakeProvider(
            [
                json.dumps(
                    {
                        "schema_sql": "create table notes ();",
                        "modules": ["Auth", "notes api"],
                        "api_contract": [{"method": "GET", "path": "/notes", "description": "Liste"}],
                    }
                )
            ]
        )
    )

    result = await architect.run(graph.by_id("task_architect"), graph)

    assert result.output["modules"] == "auth,notes_api"
    assert {t.id for t in result.spawn} == {"task_coder:auth", "task_coder:notes_api"}
    # Nur gebaut, nicht eingehängt — das Einhängen ist Sache des Schedulers.
    assert graph.by_id("task_coder:auth") is None


@pytest.mark.asyncio
async def test_architect_faellt_auf_platzhalter_zurueck():
    """Eine leere Modulliste würde einen Build ohne Code erzeugen."""
    graph = _graph()
    llm.set_provider(
        FakeProvider([json.dumps({"schema_sql": "", "modules": [], "api_contract": []})])
    )

    result = await architect.run(graph.by_id("task_architect"), graph)

    assert result.output["modules"] == ",".join(architect.FALLBACK_MODULES)
    assert len(result.spawn) == len(architect.FALLBACK_MODULES)


@pytest.mark.asyncio
async def test_coder_bekommt_architekturkontext():
    """Ohne Schema und API-Vertrag im Prompt generiert der Coder ins Blaue."""
    graph = _graph()
    architect_task = graph.by_id("task_architect")
    architect_task.output = {
        "schema_sql": "create table notes (id uuid);",
        "api_contract": '[{"method":"GET","path":"/notes"}]',
    }

    provider = FakeProvider(
        [json.dumps({"files": [{"path": "a.ts", "content": "x"}], "tests": [], "notes": []})]
    )
    llm.set_provider(provider)

    task = AgentTask(id="task_coder:auth", agent_type="coder", input={"module": "auth"})
    result = await coder.run(task, graph)

    assert result.output["file_count"] == "1"
    assert "create table notes" in provider.prompts[0]
    assert "/notes" in provider.prompts[0]
    assert result.metrics["module"] == "auth"


# --- Providerauswahl ---------------------------------------------------------


def test_ohne_konfiguration_greift_der_stub(monkeypatch):
    monkeypatch.setattr(llm, "LLM_PROVIDER", "")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(llm, "OLLAMA_BASE_URL", "")
    assert llm.select_provider().name == "stub"


def test_api_key_waehlt_claude(monkeypatch):
    monkeypatch.setattr(llm, "LLM_PROVIDER", "")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "sk-test")
    assert llm.select_provider().name == "anthropic"


def test_ollama_url_waehlt_ollama(monkeypatch):
    """EU-lokaler Betrieb ohne US-Anbieter muss ohne Codeänderung gehen."""
    monkeypatch.setattr(llm, "LLM_PROVIDER", "")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(llm, "OLLAMA_BASE_URL", "http://ollama:11434")
    assert llm.select_provider().name == "ollama"


def test_explizite_vorgabe_schlaegt_erkennung(monkeypatch):
    monkeypatch.setattr(llm, "LLM_PROVIDER", "ollama")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "sk-test")
    assert llm.select_provider().name == "ollama"


def test_claude_modell_ist_opus_5():
    assert llm.ANTHROPIC_MODEL == "claude-opus-5"
    assert ArchitectOutput.model_json_schema()["additionalProperties"] is False
