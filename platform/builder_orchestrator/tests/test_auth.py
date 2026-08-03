"""Tests für Authentifizierung und Mandantentrennung.

Der wichtigste Teil sind nicht die 401er, sondern die Isolationstests weiter
unten: Vorher wurde `tenant_id` zwar in jede Zeile geschrieben, aber nie
abgefragt — ein fremdes `project_id` lieferte den fremden Graphen aus. Ein
Test, der nur „ohne Token kommt 401" prüft, hätte genau das nicht gesehen.

Ebenfalls eigens nachgewiesen: dass der Mandant in den Hintergrund-Scheduler
mitreist. Er hängt an einem `ContextVar` und damit an einer Eigenschaft von
`asyncio.create_task` — ohne Test wäre das eine Annahme.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.main import app
from app.schemas import BuildSpec, GovernanceContext
from app.services import repository, task_graph

MANDANT_A = "11111111-1111-1111-1111-111111111111"
MANDANT_B = "22222222-2222-2222-2222-222222222222"

TOKEN_A = "tok_mandant_a"
TOKEN_B = "tok_mandant_b"
SERVICE = "tok_service"


@pytest.fixture(autouse=True)
def _auth_konfiguriert():
    repository.set_repository(repository.InMemoryGraphRepository())
    auth.configure({TOKEN_A: MANDANT_A, TOKEN_B: MANDANT_B}, service_token=SERVICE)
    yield
    auth.configure({}, service_token="")
    auth.set_tenant(auth.DEFAULT_TENANT_ID)
    repository.set_repository(repository.InMemoryGraphRepository())


def _client() -> TestClient:
    return TestClient(app)


# --- Tokenprüfung ------------------------------------------------------------


def test_ohne_token_401():
    antwort = _client().get("/api/v1/builder/task-status", params={"project_id": "x"})
    assert antwort.status_code == 401


def test_unbekannter_token_401():
    antwort = _client().get(
        "/api/v1/builder/task-status",
        params={"project_id": "x"},
        headers={"Authorization": "Bearer falsch"},
    )
    assert antwort.status_code == 401


def test_falsches_schema_401():
    antwort = _client().get(
        "/api/v1/builder/task-status",
        params={"project_id": "x"},
        headers={"Authorization": f"Basic {TOKEN_A}"},
    )
    assert antwort.status_code == 401


def test_gueltiger_token_kommt_durch():
    """404 statt 401: Der Token wurde akzeptiert, das Projekt gibt es nur nicht."""
    antwort = _client().get(
        "/api/v1/builder/task-status",
        params={"project_id": "gibtsnicht"},
        headers={"Authorization": f"Bearer {TOKEN_A}"},
    )
    assert antwort.status_code == 404


def test_health_bleibt_offen():
    """Ein Healthcheck darf keine Zugangsdaten brauchen."""
    antwort = _client().get("/health")
    assert antwort.status_code == 200
    assert antwort.json()["auth"] == "enabled"


# --- Mandant aus dem Token ---------------------------------------------------


def test_token_bestimmt_den_mandanten():
    """Ein Client kann seinen Mandanten beweisen, nicht wählen."""
    assert auth.resolve_tenant(f"Bearer {TOKEN_A}", None) == MANDANT_A
    assert auth.resolve_tenant(f"Bearer {TOKEN_B}", None) == MANDANT_B


def test_nutzer_token_ignoriert_gefaelschten_tenant_header():
    """Der Header darf einen Nutzer-Token nicht überstimmen."""
    assert auth.resolve_tenant(f"Bearer {TOKEN_A}", MANDANT_B) == MANDANT_A


def test_service_token_darf_mandanten_behaupten():
    assert auth.resolve_tenant(f"Bearer {SERVICE}", MANDANT_B) == MANDANT_B


def test_service_token_ohne_tenant_header_wird_abgelehnt():
    """Stillschweigend auf den Default zu fallen, würde Dienstaufrufe unbemerkt
    in den falschen Mandanten schreiben."""
    with pytest.raises(Exception) as fehler:
        auth.resolve_tenant(f"Bearer {SERVICE}", None)
    assert getattr(fehler.value, "status_code", None) == 400


def test_ohne_konfiguration_ist_auth_aus():
    auth.configure({}, service_token="")
    assert auth.is_enabled() is False
    assert auth.resolve_tenant(None, None) == auth.DEFAULT_TENANT_ID


# --- Mandantentrennung auf den Daten -----------------------------------------


def _graph(project_id: str):
    spec = BuildSpec(project_name="p", description="d", prompt="x")
    projekt = GovernanceContext(project_id=project_id, risk_tier="minimal")
    return task_graph.build_graph(spec, projekt)


@pytest.mark.asyncio
async def test_fremder_graph_ist_nicht_lesbar():
    """Der eigentliche Befund: Vorher lieferte ein fremdes project_id den
    fremden Graphen aus, weil tenant_id nur geschrieben und nie gelesen wurde."""
    auth.set_tenant(MANDANT_A)
    await task_graph.save_graph(_graph("prj_geheim"))

    auth.set_tenant(MANDANT_B)
    assert await task_graph.get_graph("prj_geheim") is None

    auth.set_tenant(MANDANT_A)
    assert await task_graph.get_graph("prj_geheim") is not None


@pytest.mark.asyncio
async def test_liste_zeigt_nur_eigene_projekte():
    auth.set_tenant(MANDANT_A)
    await task_graph.save_graph(_graph("prj_a"))
    auth.set_tenant(MANDANT_B)
    await task_graph.save_graph(_graph("prj_b"))

    assert await repository.get_repository().list_ids() == ["prj_b"]
    auth.set_tenant(MANDANT_A)
    assert await repository.get_repository().list_ids() == ["prj_a"]


@pytest.mark.asyncio
async def test_fremder_build_ist_nicht_abbrechbar():
    auth.set_tenant(MANDANT_A)
    await task_graph.save_graph(_graph("prj_a"))

    auth.set_tenant(MANDANT_B)
    await task_graph.set_cancelled("prj_a", True)

    auth.set_tenant(MANDANT_A)
    graph = await task_graph.get_graph("prj_a")
    assert graph.cancelled is False, "fremder Mandant konnte den Build abbrechen"


def test_status_endpoint_trennt_mandanten():
    """Dieselbe Trennung über HTTP, nicht nur auf der Speicherschicht."""
    client = _client()

    auth.set_tenant(MANDANT_A)
    asyncio.run(task_graph.save_graph(_graph("prj_a")))

    fremd = client.get(
        "/api/v1/builder/task-status",
        params={"project_id": "prj_a"},
        headers={"Authorization": f"Bearer {TOKEN_B}"},
    )
    assert fremd.status_code == 404

    eigen = client.get(
        "/api/v1/builder/task-status",
        params={"project_id": "prj_a"},
        headers={"Authorization": f"Bearer {TOKEN_A}"},
    )
    assert eigen.status_code == 200


# --- Kontext im Hintergrund --------------------------------------------------


@pytest.mark.asyncio
async def test_mandant_reist_in_den_hintergrundtask():
    """Der Scheduler laeuft als `asyncio.create_task` lange nach der Anfrage.
    Dass er trotzdem den richtigen Mandanten hat, haengt daran, dass
    create_task den Kontext kopiert — ohne diesen Test eine Annahme."""
    auth.set_tenant(MANDANT_B)
    gesehen = []

    async def hintergrund():
        # Bewusst erst nach einem Await-Punkt lesen: Der Kontext muss den
        # Scheduler-Wechsel überleben, nicht nur den Aufruf.
        await asyncio.sleep(0)
        gesehen.append(auth.current_tenant())

    await asyncio.create_task(hintergrund())
    assert gesehen == [MANDANT_B]
