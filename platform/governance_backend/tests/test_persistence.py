"""Tests gegen eine echte Postgres-Instanz.

Übersprungen, wenn `TEST_DATABASE_URL` nicht gesetzt ist — die übrige Suite
läuft weiterhin ohne Datenbank.

Lokal:
    docker run -d --rm -p 5433:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres pytest

Der Kern dieser Datei: Der Compliance-Nachweis muss einen Neustart überleben.
Ein Prüfpfad, der beim Deploy verdampft, ist keiner.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.schemas import (
    GateCheckArtifacts,
    GateCheckRequest,
    InventoryActivate,
    ProjectRegistration,
    RuntimeTelemetry,
)
from app.services import db, gate_engine, incidents, inventory, telemetry_handler

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="TEST_DATABASE_URL nicht gesetzt"
)

MIGRATION = Path(__file__).resolve().parent.parent / "migrations" / "0001_init.sql"


@pytest.fixture(autouse=True)
async def postgres(monkeypatch):
    monkeypatch.setattr(db, "DATABASE_URL", TEST_DATABASE_URL)
    verbunden = await db.connect()
    assert verbunden, "Postgres nicht erreichbar"
    await db.apply_migrations(str(MIGRATION))

    await incidents.reset()
    await inventory.reset()
    telemetry_handler.reset()
    yield
    await incidents.reset()
    await inventory.reset()
    telemetry_handler.reset()
    await db.disconnect()


def _registration(**overrides) -> ProjectRegistration:
    base = dict(
        project_name="Persistenz-Test",
        description="d",
        data_types=["health"],
        data_subjects=["patients"],
        models=["claude-3-5-sonnet"],
        llm_provider="anthropic",
        tags={"domain": "healthcare"},
    )
    base.update(overrides)
    return ProjectRegistration(**base)


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


# --- Migration -------------------------------------------------------------


@pytest.mark.asyncio
async def test_migration_ist_wiederholbar():
    """Sie läuft bei jedem Start — ein zweiter Lauf darf nicht scheitern."""
    await db.apply_migrations(str(MIGRATION))
    await db.apply_migrations(str(MIGRATION))


# --- Inventar --------------------------------------------------------------


@pytest.mark.asyncio
async def test_projekt_ueberlebt_reconnect():
    """Der eigentliche Punkt der Persistenz."""
    pid = await inventory.create_project(_registration(), "high", ["model_card_included"])

    # Verbindung kappen und neu aufbauen — wie ein Neustart des Dienstes.
    await db.disconnect()
    await db.connect()

    projekt = await inventory.get_project(pid)
    assert projekt is not None
    assert projekt.risk_tier == "high"
    assert projekt.required_gates == ["model_card_included"]
    assert projekt.models == ["claude-3-5-sonnet"]


@pytest.mark.asyncio
async def test_aktivierung_wird_gespeichert():
    pid = await inventory.create_project(_registration(), "limited", ["tests_passed"])

    await inventory.activate(
        InventoryActivate(
            project_id=pid,
            endpoint="https://app.example.eu",
            deployment_timestamp="2026-08-01T10:00:00Z",
        )
    )

    projekt = await inventory.get_project(pid)
    assert projekt.status == "active"
    assert projekt.endpoint == "https://app.example.eu"
    assert projekt.deployment_timestamp.startswith("2026-08-01")


@pytest.mark.asyncio
async def test_aktivierung_unbekanntes_projekt_wirft():
    with pytest.raises(KeyError):
        await inventory.activate(
            InventoryActivate(project_id="prj_nope", endpoint="x", deployment_timestamp="2026-08-01T10:00:00Z")
        )


@pytest.mark.asyncio
async def test_gate_ergebnis_wird_gespeichert():
    pid = await inventory.create_project(
        _registration(), "high", ["tests_passed", "model_card_included"]
    )

    entscheidung = await gate_engine.evaluate(
        GateCheckRequest(
            project_id=pid,
            build_hash="sha256:abc",
            artifacts=_artifacts(model_card_included=False),
        )
    )
    assert entscheidung.status == "blocked"

    projekt = await inventory.get_project(pid)
    assert projekt.last_gate_status == "blocked"


@pytest.mark.asyncio
async def test_projektliste_kommt_aus_der_datenbank():
    await inventory.create_project(_registration(project_name="A"), "minimal", [])
    await inventory.create_project(_registration(project_name="B"), "minimal", [])

    namen = {p.project_name for p in await inventory.list_projects()}
    assert namen == {"A", "B"}


# --- Incidents -------------------------------------------------------------


@pytest.mark.asyncio
async def test_incident_ueberlebt_reconnect(monkeypatch):
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    pid = await inventory.create_project(_registration(), "high", [])

    befund = await incidents.open_incident(
        project_id=pid,
        incident_type="region_drift",
        severity="critical",
        title="Verarbeitung außerhalb der EU",
        detail="eu -> us",
        evidence={"from": "eu", "to": "us"},
    )

    await db.disconnect()
    await db.connect()

    geladen = await incidents.get_incident(befund.incident_id)
    assert geladen is not None
    assert geladen.severity == "critical"
    assert geladen.evidence == {"from": "eu", "to": "us"}
    assert geladen.dispatch_status == "not_configured"


@pytest.mark.asyncio
async def test_drift_kette_schreibt_alles_in_die_datenbank(monkeypatch):
    """Registrierung → Drift → Incident → at_risk, alles persistent."""
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    pid = await inventory.create_project(_registration(), "high", ["tests_passed"])

    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="heartbeat", region="eu")
    )
    await telemetry_handler.handle(
        RuntimeTelemetry(project_id=pid, event_type="region_change", region="us-east-1")
    )

    await db.disconnect()
    await db.connect()

    befunde = await incidents.list_incidents(pid)
    assert len(befunde) == 1
    assert befunde[0].incident_type == "region_drift"
    assert befunde[0].severity == "critical"

    projekt = await inventory.get_project(pid)
    assert projekt.compliance_status == "at_risk"


@pytest.mark.asyncio
async def test_quittieren_wird_gespeichert(monkeypatch):
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    pid = await inventory.create_project(_registration(), "high", [])
    befund = await incidents.open_incident(
        project_id=pid, incident_type="model_drift", severity="high", title="t", detail="d"
    )

    await incidents.acknowledge(befund.incident_id)
    await db.disconnect()
    await db.connect()

    assert (await incidents.get_incident(befund.incident_id)).status == "acknowledged"


@pytest.mark.asyncio
async def test_filter_arbeiten_auf_der_datenbank(monkeypatch):
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    pid_a = await inventory.create_project(_registration(project_name="A"), "high", [])
    pid_b = await inventory.create_project(_registration(project_name="B"), "high", [])

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


@pytest.mark.asyncio
async def test_incident_ohne_projekt_wird_abgelehnt(monkeypatch):
    """Fremdschlüssel: ein Befund ohne Projekt darf nicht entstehen."""
    monkeypatch.setattr(incidents, "WEBHOOK_URL", "")
    with pytest.raises(Exception):
        await incidents.open_incident(
            project_id="prj_existiert_nicht",
            incident_type="runtime_error",
            severity="low",
            title="t",
            detail="d",
        )
