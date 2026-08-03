"""Tests der Governance-Kopplung.

Der wichtigste Nachweis dieser Datei: ein blockiertes Gate darf **nie** zu einer
Aktivierung im Inventar führen. Das ist die Eigenschaft, wegen der das ganze
System existiert — sie muss durch einen Test abgesichert sein, nicht durch
Sorgfalt beim Lesen.

Ausführen:  cd platform/builder_orchestrator && pytest
"""

from __future__ import annotations

import pytest

from app.agents import devops as devops_agent
from app.agents import governance as governance_agent
from app.clients import rsd_client
from app.schemas import BuildSpec, GovernanceContext
from app.services import agent_runner, audit_log, events, task_graph


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    task_graph.reset()
    agent_runner.reset()
    audit_log.reset()
    events.reset()
    devops_agent.reset()
    monkeypatch.setattr(agent_runner, "RETRY_BASE_SECONDS", 0.0)
    yield
    task_graph.reset()
    agent_runner.reset()
    audit_log.reset()
    events.reset()
    devops_agent.reset()


class GovernanceSpy:
    """Zeichnet die Aufrufe ans Governance-Backend auf."""

    def __init__(self, gate_status="approved"):
        self.gate_status = gate_status
        self.gate_calls = []
        self.activate_calls = []
        self.telemetry_calls = []

    async def gate_check(self, project_id, build_hash, artifacts):
        self.gate_calls.append({"project_id": project_id, "build_hash": build_hash})
        if self.gate_status == "blocked":
            return {"status": "blocked", "reason": "Model Card fehlt", "severity": "high"}
        return {"status": self.gate_status}

    async def activate_inventory(self, project_id, endpoint, timestamp):
        self.activate_calls.append({"project_id": project_id, "endpoint": endpoint})
        return {"status": "ok"}

    async def send_telemetry(self, project_id, event_type, **details):
        self.telemetry_calls.append({"event_type": event_type, **details})


def _install(monkeypatch, spy: GovernanceSpy) -> None:
    monkeypatch.setattr(rsd_client, "gate_check", spy.gate_check)
    monkeypatch.setattr(rsd_client, "activate_inventory", spy.activate_inventory)
    monkeypatch.setattr(rsd_client, "send_telemetry", spy.send_telemetry)


async def _run(project_id="prj_gate", risk_tier="high"):
    spec = BuildSpec(project_name="D", description="d", prompt="p")
    ctx = GovernanceContext(
        project_id=project_id, risk_tier=risk_tier, required_gates=["model_card_included"]
    )
    graph = task_graph.build_graph(spec, ctx)
    await task_graph.save_graph(graph)
    return await agent_runner.run_graph(project_id)


# --- Der entscheidende Test ------------------------------------------------


@pytest.mark.asyncio
async def test_blockiertes_gate_loest_keine_aktivierung_aus(monkeypatch):
    spy = GovernanceSpy(gate_status="blocked")
    _install(monkeypatch, spy)

    result = await _run()

    assert result.by_id("task_devops").status == "failed"
    assert result.by_id("task_governance").status == "blocked"

    # Kein Deployment im Inventar, keine Telemetrie über ein Deployment.
    assert spy.activate_calls == []
    assert spy.telemetry_calls == []


@pytest.mark.asyncio
async def test_approved_gate_aktiviert_und_meldet_telemetrie(monkeypatch):
    spy = GovernanceSpy(gate_status="approved")
    _install(monkeypatch, spy)

    result = await _run(project_id="prj_ok")

    assert result.by_id("task_governance").status == "completed"
    assert len(spy.activate_calls) == 1
    assert spy.activate_calls[0]["project_id"] == "prj_ok"
    assert spy.telemetry_calls[0]["event_type"] == "deployment_completed"
    assert spy.telemetry_calls[0]["region"] == "eu"


@pytest.mark.asyncio
async def test_warning_gate_deployt_trotzdem(monkeypatch):
    """`warning` ist ein Befund für den Prüfpfad, kein Stopp."""
    spy = GovernanceSpy(gate_status="warning")
    _install(monkeypatch, spy)

    result = await _run(project_id="prj_warn")

    assert result.by_id("task_devops").status == "completed"
    assert len(spy.activate_calls) == 1


# --- Idempotenz ------------------------------------------------------------


@pytest.mark.asyncio
async def test_blockiertes_gate_wird_nicht_wiederholt_angefragt(monkeypatch):
    """Ein Retry darf keinen zweiten Gate-Eintrag im Prüfpfad erzeugen."""
    spy = GovernanceSpy(gate_status="blocked")
    _install(monkeypatch, spy)

    await _run(project_id="prj_idem")

    # max_attempts ist 2 für DevOps — der Gate-Aufruf darf trotzdem nur einmal
    # passieren, weil GateBlocked als nicht wiederholbar markiert ist.
    assert len(spy.gate_calls) == 1


@pytest.mark.asyncio
async def test_build_hash_ist_deterministisch(monkeypatch):
    """Derselbe Graph muss denselben Hash erzeugen — Grundlage der Idempotenz."""
    spy = GovernanceSpy(gate_status="approved")
    _install(monkeypatch, spy)

    await _run(project_id="prj_hash_a")
    erster = spy.gate_calls[0]["build_hash"]

    task_graph.reset()
    devops_agent.reset()
    spy.gate_calls.clear()

    await _run(project_id="prj_hash_a")
    zweiter = spy.gate_calls[0]["build_hash"]

    assert erster == zweiter


@pytest.mark.asyncio
async def test_unacceptable_erreicht_das_gate_gar_nicht(monkeypatch):
    """Art. 5: Der Build läuft nicht an, also wird auch nichts geprüft."""
    spy = GovernanceSpy(gate_status="approved")
    _install(monkeypatch, spy)

    result = await _run(project_id="prj_verboten", risk_tier="unacceptable")

    assert spy.gate_calls == []
    assert spy.activate_calls == []
    assert result.by_id("task_devops").status == "blocked"
