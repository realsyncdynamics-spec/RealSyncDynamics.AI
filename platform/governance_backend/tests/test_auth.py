"""Tests für Authentifizierung und Mandantentrennung im Governance-Backend.

Hier wiegt die Trennung schwerer als im Orchestrator: Was hier liegt, ist der
Prüfpfad — Risiko-Einstufungen, Gate-Entscheidungen, Compliance-Befunde. Ein
Leseweg ohne Mandantenfilter gäbe fremde Befunde heraus, und das ist genau der
Schaden, gegen den das Produkt verkauft wird.

Eine Ausnahme wird eigens geprüft: Die Wiederzustellung gescheiterter Webhooks
läuft **absichtlich** mandantenübergreifend. Sie startet aus dem Lifespan, also
ohne Request und ohne Mandantenkontext; mit Filter würde sie stillschweigend
nur die Befunde eines Mandanten wiederholen.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app
from app.schemas import ProjectRegistration
from app.services import incidents, inventory

MANDANT_A = "11111111-1111-1111-1111-111111111111"
MANDANT_B = "22222222-2222-2222-2222-222222222222"

TOKEN_A = "tok_mandant_a"
TOKEN_B = "tok_mandant_b"
SERVICE = "tok_service"


@pytest.fixture(autouse=True)
async def _auth_konfiguriert():
    await inventory.reset()
    await incidents.reset()
    auth.configure({TOKEN_A: MANDANT_A, TOKEN_B: MANDANT_B}, service_token=SERVICE)
    yield
    auth.configure({}, service_token="")
    auth.set_tenant(auth.DEFAULT_TENANT_ID)
    await inventory.reset()
    await incidents.reset()


def _registrierung(name: str = "Projekt") -> ProjectRegistration:
    return ProjectRegistration(
        project_name=name,
        description="Testprojekt",
        models=["claude"],
        data_types=["email"],
        data_subjects=["kunden"],
    )


# --- Tokenprüfung ------------------------------------------------------------


def test_gate_check_ohne_token_401():
    """Ohne Token darf das Gate nicht einmal befragt werden — sonst waere die
    Gate-Entscheidung eines fremden Builds abrufbar."""
    antwort = TestClient(app).post(
        "/api/v1/governance/gate-check",
        json={"project_id": "x", "build_hash": "sha256:a", "artifacts": {
            "tests_passed": True, "audit_logging_active": True,
            "model_card_included": True, "transparency_notice_enabled": True,
            "pii_scan_passed": True}},
    )
    assert antwort.status_code == 401


def test_projektliste_ohne_token_401():
    assert TestClient(app).get("/api/v1/governance/projects").status_code == 401


def test_health_bleibt_offen():
    antwort = TestClient(app).get("/health")
    assert antwort.status_code == 200
    assert antwort.json()["auth"] == "enabled"


def test_service_token_braucht_tenant_header():
    with pytest.raises(Exception) as fehler:
        auth.resolve_tenant(f"Bearer {SERVICE}", None)
    assert getattr(fehler.value, "status_code", None) == 400


# --- Mandantentrennung auf den Daten -----------------------------------------


@pytest.mark.asyncio
async def test_fremdes_projekt_ist_nicht_lesbar():
    auth.set_tenant(MANDANT_A)
    project_id = await inventory.create_project(_registrierung(), "limited", ["tests_passed"])

    auth.set_tenant(MANDANT_B)
    assert await inventory.get_project(project_id) is None

    auth.set_tenant(MANDANT_A)
    assert await inventory.get_project(project_id) is not None


@pytest.mark.asyncio
async def test_projektliste_zeigt_nur_eigene():
    auth.set_tenant(MANDANT_A)
    await inventory.create_project(_registrierung("A"), "minimal", [])
    auth.set_tenant(MANDANT_B)
    await inventory.create_project(_registrierung("B"), "minimal", [])

    assert [p.project_name for p in await inventory.list_projects()] == ["B"]
    auth.set_tenant(MANDANT_A)
    assert [p.project_name for p in await inventory.list_projects()] == ["A"]


@pytest.mark.asyncio
async def test_gate_check_sieht_fremdes_projekt_nicht():
    """Fail-closed bleibt erhalten: Aus Sicht des fremden Mandanten ist das
    Projekt nicht registriert, und ein unbekanntes Projekt wird blockiert."""
    from app.schemas import GateCheckArtifacts, GateCheckRequest
    from app.services import gate_engine

    auth.set_tenant(MANDANT_A)
    project_id = await inventory.create_project(_registrierung(), "minimal", [])

    auth.set_tenant(MANDANT_B)
    entscheidung = await gate_engine.evaluate(
        GateCheckRequest(
            project_id=project_id,
            build_hash="sha256:abc",
            artifacts=GateCheckArtifacts(
                tests_passed=True, audit_logging_active=True, model_card_included=True,
                transparency_notice_enabled=True, pii_scan_passed=True,
            ),
        )
    )
    assert entscheidung.status == "blocked"
    assert "nicht im Governance-Inventar" in entscheidung.reason


@pytest.mark.asyncio
async def test_fremde_befunde_sind_nicht_lesbar():
    auth.set_tenant(MANDANT_A)
    project_id = await inventory.create_project(_registrierung(), "high", [])
    await incidents.open_incident(
        project_id=project_id,
        incident_type="region_drift",
        severity="high",
        title="Regionsdrift",
        detail="Verarbeitung in us-east-1",
    )

    auth.set_tenant(MANDANT_B)
    assert await incidents.list_incidents() == []

    auth.set_tenant(MANDANT_A)
    assert len(await incidents.list_incidents()) == 1


@pytest.mark.asyncio
async def test_fremder_befund_ist_nicht_quittierbar():
    auth.set_tenant(MANDANT_A)
    project_id = await inventory.create_project(_registrierung(), "high", [])
    befund = await incidents.open_incident(
        project_id=project_id,
        incident_type="model_drift",
        severity="medium",
        title="Modelldrift",
        detail="unbewertete Modellversion",
    )

    auth.set_tenant(MANDANT_B)
    assert await incidents.acknowledge(befund.incident_id) is None

    auth.set_tenant(MANDANT_A)
    weiterhin_offen = await incidents.get_incident(befund.incident_id)
    assert weiterhin_offen.status == "open", "fremder Mandant konnte quittieren"


# --- Bewusste Ausnahme -------------------------------------------------------


@pytest.mark.asyncio
async def test_wiederzustellung_sieht_alle_mandanten():
    """Die Hintergrundschleife hat keinen Mandantenkontext. Mit Filter wuerde
    sie nur die Befunde des Default-Mandanten wiederholen und alle anderen
    liegen lassen — ein verschluckter Befund ist genau das, was die
    Wiederzustellung verhindern soll."""
    for mandant in (MANDANT_A, MANDANT_B):
        auth.set_tenant(mandant)
        project_id = await inventory.create_project(_registrierung(), "high", [])
        befund = await incidents.open_incident(
            project_id=project_id,
            incident_type="region_drift",
            severity="high",
            title="Drift",
            detail="Drift",
        )
        befund.dispatch_status = "failed"
        befund.next_dispatch_at = None

    # Ohne Mandantenkontext — wie im Lifespan.
    auth.set_tenant(auth.DEFAULT_TENANT_ID)
    faellig = await incidents._faellige_zustellungen()

    assert len(faellig) == 2, f"Wiederzustellung sieht nur {len(faellig)} von 2 Befunden"
