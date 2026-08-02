"""Tests der Laufzeitüberwachung: Drift-Erkennung und Incident-Dispatch.

Der Kern: Ein erkannter Verstoß muss einen nachverfolgbaren Vorgang erzeugen,
nicht nur eine Logzeile.

Ausführen:  cd platform/governance_backend && pytest
"""

from __future__ import annotations

import httpx
import pytest

from app.schemas import ProjectRegistration, RuntimeTelemetry
from app.services import incidents, inventory, telemetry_handler


@pytest.fixture(autouse=True)
async def clean_state():
    await inventory.reset()
    telemetry_handler.reset()
    await incidents.reset()
    yield
    await inventory.reset()
    telemetry_handler.reset()
    await incidents.reset()


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

    befunde = await incidents.list_incidents(pid)
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

    assert (await incidents.list_incidents(pid))[0].severity == "critical"


@pytest.mark.asyncio
async def test_wechsel_innerhalb_der_eu_ist_kein_befund():
    pid = await _projekt()

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu-central-1")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="eu-west-1")
    )

    assert await incidents.list_incidents(pid) == []


@pytest.mark.asyncio
async def test_projekt_wird_als_gefaehrdet_markiert():
    pid = await _projekt(risk_tier="high")

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us")
    )

    assert (await inventory.get_project(pid)).compliance_status == "at_risk"


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

    assert len(await incidents.list_incidents(pid)) == 1


# --- Modelldrift -----------------------------------------------------------


@pytest.mark.asyncio
async def test_nicht_registriertes_modell_erzeugt_incident():
    pid = await _projekt(models=["claude-3-5-sonnet"])

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
    )

    befunde = await incidents.list_incidents(pid)
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

    assert await incidents.list_incidents(pid) == []


@pytest.mark.asyncio
async def test_modelldrift_wird_nicht_doppelt_gemeldet():
    pid = await _projekt(models=["claude-3-5-sonnet"])

    for _ in range(3):
        await telemetry_handler.handle(
            RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
        )

    assert len(await incidents.list_incidents(pid)) == 1


@pytest.mark.asyncio
async def test_ohne_registrierte_modelle_keine_modelldrift():
    pid = await _projekt(models=[])

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", model_version="gpt-4o")
    )

    assert await incidents.list_incidents(pid) == []


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
    assert await incidents.get_incident(incident.incident_id) is not None


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

    befund = (await incidents.list_incidents(pid))[0]
    assert befund.dispatch_status == "failed"
    assert befund.dispatch_error


# --- Verwaltung ------------------------------------------------------------


@pytest.mark.asyncio
async def test_quittieren_setzt_status():
    pid = await _projekt()
    incident = await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )

    quittiert = await incidents.acknowledge(incident.incident_id)
    assert quittiert.status == "acknowledged"

    # Zweites Quittieren ändert nichts.
    assert (await incidents.acknowledge(incident.incident_id)).status == "acknowledged"
    assert await incidents.acknowledge("inc_unbekannt") is None


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
    await incidents.acknowledge(a.incident_id)

    assert len(await incidents.list_incidents(pid_a)) == 1
    assert len(await incidents.list_incidents(status="open")) == 1
    assert len(await incidents.list_incidents()) == 2


# --- Wiederholte Zustellung ------------------------------------------------


class WebhookSpy:
    """Zählt Zustellversuche und lässt sich auf Erfolg umschalten."""

    def __init__(self, erfolg_ab: int = 999):
        self.versuche = 0
        self.erfolg_ab = erfolg_ab

    def install(self, monkeypatch):
        spy = self

        class FakeResponse:
            def raise_for_status(self):
                return None

        class FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, json=None):
                spy.versuche += 1
                if spy.versuche >= spy.erfolg_ab:
                    return FakeResponse()
                raise httpx.ConnectError("n8n nicht erreichbar")

        monkeypatch.setattr(incidents, "WEBHOOK_URL", "http://n8n.local/webhook")
        monkeypatch.setattr(incidents.httpx, "AsyncClient", FakeClient)


@pytest.mark.asyncio
async def test_fehlgeschlagene_zustellung_wird_wiederholt(monkeypatch):
    """Der zweite Anlauf klappt — der Befund ist danach zugestellt."""
    spy = WebhookSpy(erfolg_ab=2)
    spy.install(monkeypatch)
    monkeypatch.setattr(incidents, "DISPATCH_RETRY_BASE_SECONDS", 0.0)
    pid = await _projekt()

    befund = await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )
    assert befund.dispatch_status == "failed"
    assert befund.dispatch_attempts == 1

    ergebnis = await incidents.redeliver_pending()

    assert ergebnis == {"versucht": 1, "zugestellt": 1, "aufgegeben": 0}
    geladen = await incidents.get_incident(befund.incident_id)
    assert geladen.dispatch_status == "delivered"
    assert geladen.dispatch_error is None
    assert geladen.next_dispatch_at is None


@pytest.mark.asyncio
async def test_nach_max_versuchen_wird_aufgegeben_aber_nicht_vergessen(monkeypatch):
    spy = WebhookSpy()  # klappt nie
    spy.install(monkeypatch)
    monkeypatch.setattr(incidents, "DISPATCH_RETRY_BASE_SECONDS", 0.0)
    monkeypatch.setattr(incidents, "DISPATCH_MAX_ATTEMPTS", 3)
    pid = await _projekt()

    befund = await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )

    await incidents.redeliver_pending()
    ergebnis = await incidents.redeliver_pending()

    assert ergebnis["aufgegeben"] == 1
    assert spy.versuche == 3

    geladen = await incidents.get_incident(befund.incident_id)
    assert geladen.dispatch_status == "exhausted"
    assert geladen.dispatch_attempts == 3
    # Aufgeben heißt nicht vergessen: der Befund bleibt auffindbar.
    assert geladen.dispatch_error
    assert len(await incidents.list_incidents(pid)) == 1

    # Und wird nicht endlos weiter versucht.
    assert (await incidents.redeliver_pending())["versucht"] == 0
    assert spy.versuche == 3


@pytest.mark.asyncio
async def test_noch_nicht_faellige_befunde_werden_uebersprungen(monkeypatch):
    """Das Backoff muss eingehalten werden, sonst hämmert die Schleife."""
    spy = WebhookSpy()
    spy.install(monkeypatch)
    monkeypatch.setattr(incidents, "DISPATCH_RETRY_BASE_SECONDS", 3600.0)
    pid = await _projekt()

    await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )
    assert spy.versuche == 1

    ergebnis = await incidents.redeliver_pending()
    assert ergebnis["versucht"] == 0
    assert spy.versuche == 1


@pytest.mark.asyncio
async def test_zugestellte_befunde_werden_nicht_erneut_versucht(monkeypatch):
    spy = WebhookSpy(erfolg_ab=1)
    spy.install(monkeypatch)
    pid = await _projekt()

    await incidents.open_incident(
        project_id=pid, incident_type="runtime_error", severity="low", title="t", detail="d"
    )
    assert spy.versuche == 1

    assert (await incidents.redeliver_pending())["versucht"] == 0
    assert spy.versuche == 1


@pytest.mark.asyncio
async def test_ohne_webhook_laeuft_die_wiederholung_leer(monkeypatch):
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    assert await incidents.redeliver_pending() == {
        "versucht": 0,
        "zugestellt": 0,
        "aufgegeben": 0,
    }
