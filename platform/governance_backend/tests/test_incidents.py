"""Tests der Laufzeitüberwachung: Drift-Erkennung und Incident-Dispatch.

Der Kern: Ein erkannter Verstoß muss einen nachverfolgbaren Vorgang erzeugen,
nicht nur eine Logzeile.

Ausführen:  cd platform/governance_backend && pytest
"""

from __future__ import annotations

import pytest

from app.schemas import ProjectRegistration, RuntimeTelemetry
from app.services import incidents, inventory, telemetry_handler


@pytest.fixture(autouse=True)
def clean_state():
    inventory.reset()
    telemetry_handler.reset()
    incidents.reset()
    yield
    inventory.reset()
    telemetry_handler.reset()
    incidents.reset()


async def _projekt(risk_tier="limited", models=None) -> str:
    registration = ProjectRegistration(
        project_name="Test",
        description="d",
        data_types=["email"],
        data_subjects=["customers"],
        models=models if models is not None else ["claude-3-5-sonnet"],
    )
    return await inventory.create_project(registration, risk_tier, ["tests_passed"])


# --- Regionsdrift ----------------------------------------------------------


@pytest.mark.asyncio
async def test_eu_nach_us_erzeugt_incident():
    pid = await _projekt()

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us")
    )

    befunde = incidents.list_incidents(pid)
    assert len(befunde) == 1
    assert befunde[0].incident_type == "region_drift"
    assert befunde[0].severity == "high"
    assert befunde[0].evidence == {"from": "eu", "to": "us", "event_type": "region_change"}
    assert "Kap. V DSGVO" in befunde[0].detail


@pytest.mark.asyncio
async def test_high_risk_projekt_bekommt_critical():
    pid = await _projekt(risk_tier="high")

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us-east-1")
    )

    assert incidents.list_incidents(pid)[0].severity == "critical"


@pytest.mark.asyncio
async def test_wechsel_innerhalb_der_eu_ist_kein_befund():
    pid = await _projekt()

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu-central-1")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="eu-west-1")
    )

    assert incidents.list_incidents(pid) == []


@pytest.mark.asyncio
async def test_projekt_wird_als_gefaehrdet_markiert():
    pid = await _projekt(risk_tier="high")

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us")
    )

    assert inventory.get_project(pid).compliance_status == "at_risk"


@pytest.mark.asyncio
async def test_drift_aus_details_ohne_vorheriges_event():
    """Auch ohne Heartbeat davor: from/to stehen im Event selbst."""
    pid = await _projekt()

    await telemetry_handler.handle(
        RuntimeTelemetry(
            project_id=pid,
            event_type="region_change",
            region="us",
            details={"from": "eu"},
        )
    )

    assert len(incidents.list_incidents(pid)) == 1


# --- Modelldrift -----------------------------------------------------------


@pytest.mark.asyncio
async def test_nicht_registriertes_modell_erzeugt_incident():
    pid = await _projekt(models=["claude-3-5-sonnet"])

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
    )

    befunde = incidents.list_incidents(pid)
    assert len(befunde) == 1
    assert befunde[0].incident_type == "model_drift"
    assert befunde[0].evidence["running_model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_registriertes_modell_mit_datumssuffix_ist_kein_befund():
    """'claude-3-5-sonnet-20241022' zählt als bewertetes Modell."""
    pid = await _projekt(models=["claude-3-5-sonnet"])

    await telemetry_handler.handle(
        RuntimeTelemetry(
            project_id=pid, event_type="heartbeat", model_version="claude-3-5-sonnet-20241022"
        )
    )

    assert incidents.list_incidents(pid) == []


@pytest.mark.asyncio
async def test_modelldrift_wird_nicht_doppelt_gemeldet():
    pid = await _projekt(models=["claude-3-5-sonnet"])

    for _ in range(3):
        await telemetry_handler.handle(
            RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
        )

    assert len(incidents.list_incidents(pid)) == 1


@pytest.mark.asyncio
async def test_ohne_registrierte_modelle_keine_modelldrift():
    pid = await _projekt(models=[])

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
    )

    assert incidents.list_incidents(pid) == []


# --- Dispatch --------------------------------------------------------------


@pytest.mark.asyncio
async def test_ohne_webhook_bleibt_der_incident_trotzdem_bestehen(monkeypatch):
    """Kein konfigurierter n8n-Endpunkt darf keinen Befund verschlucken."""
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    pid = await _projekt()

    incident = await incidents.open_incident(
        project_id=pid,
        incident_type="runtime_error",
        severity="low",
        title="Test",
        detail="d",
    )

    assert incident.dispatch_status == "not_configured"
    assert incidents.get_incident(incident.incident_id) is not None


@pytest.mark.asyncio
async def test_fehlgeschlagener_dispatch_bricht_nichts_ab(monkeypatch):
    """Ein nicht erreichbarer Webhook wird vermerkt, nicht durchgereicht."""
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "http://n8n.invalid/webhook")
    pid = await _projekt()

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us")
    )

    befund = incidents.list_incidents(pid)[0]
    assert befund.dispatch_status == "failed"
    assert befund.dispatch_error


# --- Verwaltung ------------------------------------------------------------


@pytest.mark.asyncio
async def test_quittieren_setzt_status():
    pid = await _projekt()
    incident = await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )

    quittiert = incidents.acknowledge(incident.incident_id)
    assert quittiert.status == "acknowledged"

    # Zweites Quittieren ändert nichts.
    assert incidents.acknowledge(incident.incident_id).status == "acknowledged"
    assert incidents.acknowledge("inc_unbekannt") is None


@pytest.mark.asyncio
async def test_filter_nach_projekt_und_status():
    pid_a = await _projekt()
    pid_b = await _projekt()

    a = await incidents.open_incident(
        project_id=pid_a, incident_type="runtime_error", severity="low", title="a", detail=""
    )
    await incidents.open_incident(
        project_id=pid_b, incident_type="runtime_error", severity="low", title="b", detail=""
    )
    incidents.acknowledge(a.incident_id)

    assert len(incidents.list_incidents(pid_a)) == 1
    assert len(incidents.list_incidents(status="open")) == 1
    assert len(incidents.list_incidents()) == 2
