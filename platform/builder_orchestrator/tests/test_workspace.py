"""Tests für Workspace-Ablage und Build-Messung.

Der Schwerpunkt liegt auf den Pfaden: Sie stammen aus einer Modellantwort und
landen auf dem Dateisystem. Ein Test, der nur den Normalfall prüft, würde
genau die Fälle auslassen, wegen derer es das Modul gibt — jeder Ausbruch
unten wird deshalb einzeln nachgewiesen, inklusive des Symlinks, an dem eine
reine Textprüfung auf `..` vorbeiginge.
"""

from __future__ import annotations

import time

import pytest

from app.agents import devops
from app.clients import rsd_client
from app.schemas import AgentTask, TaskGraph
from app.services import build_checks, workspace
from app.services.workspace import UnsafePathError, WorkspaceLimitError


@pytest.fixture(autouse=True)
def _workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace, "WORKSPACE_ROOT", tmp_path / "ws")
    monkeypatch.setattr(build_checks, "TEST_COMMAND", "")
    devops.reset()
    yield
    devops.reset()


# --- Pfadsicherheit ----------------------------------------------------------


@pytest.mark.parametrize(
    "pfad",
    [
        "../ausbruch.ts",
        "../../../etc/passwd",
        "modul/../../ausbruch.ts",
        "/etc/cron.d/job",
        "a/b/../../../../ausbruch.ts",
    ],
)
def test_ausbruch_wird_abgewiesen(pfad):
    with pytest.raises(UnsafePathError):
        workspace.write_module("proj", "auth", [(pfad, "x")])


def test_symlink_fuehrt_nicht_hinaus(tmp_path):
    """Der Fall, den eine Textprüfung auf `..` nicht sieht."""
    ziel = tmp_path / "ausserhalb"
    ziel.mkdir()

    modul = workspace.project_root("proj") / "auth"
    modul.mkdir(parents=True)
    (modul / "link").symlink_to(ziel, target_is_directory=True)

    with pytest.raises(UnsafePathError):
        workspace.write_module("proj", "auth", [("link/datei.ts", "x")])

    assert not (ziel / "datei.ts").exists(), "Datei landete außerhalb des Workspace"


def test_leerer_und_nullbyte_pfad():
    with pytest.raises(UnsafePathError):
        workspace.write_module("proj", "auth", [("   ", "x")])
    with pytest.raises(UnsafePathError):
        workspace.write_module("proj", "auth", [("a\x00b.ts", "x")])


def test_unbrauchbare_project_id():
    with pytest.raises(UnsafePathError):
        workspace.project_root("../anderes")
    with pytest.raises(UnsafePathError):
        workspace.project_root("")


def test_grosse_datei_wird_abgewiesen(monkeypatch):
    monkeypatch.setattr(workspace, "MAX_FILE_BYTES", 10)
    with pytest.raises(WorkspaceLimitError):
        workspace.write_module("proj", "auth", [("a.ts", "x" * 11)])


def test_zu_viele_dateien_werden_abgewiesen(monkeypatch):
    monkeypatch.setattr(workspace, "MAX_FILES_PER_MODULE", 2)
    with pytest.raises(WorkspaceLimitError):
        workspace.write_module("proj", "auth", [(f"{i}.ts", "x") for i in range(3)])


# --- Normalfall --------------------------------------------------------------


def test_manifest_ist_projektrelativ():
    manifest = workspace.write_module(
        "proj", "auth", [("index.ts", "export const a = 1;"), ("lib/util.ts", "// x")]
    )
    assert manifest == ["auth/index.ts", "auth/lib/util.ts"]

    inhalt = (workspace.project_root("proj") / "auth" / "index.ts").read_text()
    assert inhalt == "export const a = 1;"


def test_module_stoeren_sich_nicht():
    """Coder-Tasks laufen parallel — getrennte Verzeichnisse sind die Bedingung."""
    workspace.write_module("proj", "auth", [("index.ts", "auth")])
    workspace.write_module("proj", "data", [("index.ts", "data")])

    wurzel = workspace.project_root("proj")
    assert (wurzel / "auth" / "index.ts").read_text() == "auth"
    assert (wurzel / "data" / "index.ts").read_text() == "data"


# --- Build-Hash --------------------------------------------------------------


def test_hash_ist_stabil_ueber_wiederholung():
    """Ohne Stabilität wäre der Gate-Aufruf bei jedem Retry ein neuer Build."""
    workspace.write_module("proj", "auth", [("a.ts", "inhalt")])
    assert workspace.content_hash("proj") == workspace.content_hash("proj")


def test_hash_erfasst_den_inhalt():
    """Ein Hash nur über die Pfade könnte zwei Builds nicht unterscheiden."""
    workspace.write_module("proj", "auth", [("a.ts", "erste Fassung")])
    vorher = workspace.content_hash("proj")

    workspace.write_module("proj", "auth", [("a.ts", "zweite Fassung")])
    assert workspace.content_hash("proj") != vorher


def test_leerer_workspace_hat_einen_hash():
    assert workspace.content_hash("proj").startswith("sha256:")


# --- Build-Messung -----------------------------------------------------------


@pytest.mark.asyncio
async def test_leerer_workspace_erfuellt_nichts():
    report = await build_checks.inspect("proj")
    assert not any(report.artifacts.values())


@pytest.mark.asyncio
async def test_transparenzhinweis_wird_erkannt():
    workspace.write_module(
        "proj", "ui", [("Banner.tsx", 'export const Hinweis = "KI-generiert";')]
    )
    report = await build_checks.inspect("proj")

    assert report.artifacts["transparency_notice_enabled"] is True
    assert "Banner.tsx" in report.reasons["transparency_notice_enabled"]


@pytest.mark.asyncio
async def test_fehlender_hinweis_bleibt_unerfuellt():
    workspace.write_module("proj", "ui", [("Banner.tsx", "export const x = 1;")])
    report = await build_checks.inspect("proj")

    assert report.artifacts["transparency_notice_enabled"] is False


@pytest.mark.asyncio
async def test_model_card_wird_gefunden():
    workspace.write_module("proj", "docs", [("MODEL_CARD.md", "# Model Card")])
    report = await build_checks.inspect("proj")

    assert report.artifacts["model_card_included"] is True


@pytest.mark.asyncio
async def test_pii_scan_schlaegt_an():
    workspace.write_module(
        "proj", "data", [("seed.ts", 'const nutzer = "erika.mustermann@gmx.de";')]
    )
    report = await build_checks.inspect("proj")

    assert report.artifacts["pii_scan_passed"] is False
    assert any("E-Mail" in fund for fund in report.findings)


@pytest.mark.asyncio
async def test_platzhalter_domain_ist_kein_befund():
    """Sonst schlägt der Scan bei jedem generierten Beispiel an — und ein
    Scan, der immer anschlägt, wird ignoriert."""
    workspace.write_module("proj", "data", [("seed.ts", 'const a = "jane@example.com";')])
    report = await build_checks.inspect("proj")

    assert report.artifacts["pii_scan_passed"] is True


@pytest.mark.asyncio
async def test_privater_schluessel_wird_gefunden():
    workspace.write_module(
        "proj", "config", [("key.txt", "-----BEGIN RSA PRIVATE KEY-----\nabc")]
    )
    report = await build_checks.inspect("proj")

    assert report.artifacts["pii_scan_passed"] is False


@pytest.mark.asyncio
async def test_tests_ohne_kommando_bleiben_unbelegt():
    """Vorhandene Testdateien beweisen nichts — nur ein Lauf tut das."""
    workspace.write_module("proj", "auth", [("auth.test.ts", "test('x', () => {})")])
    report = await build_checks.inspect("proj")

    assert report.artifacts["tests_passed"] is False
    assert "BUILDER_TEST_COMMAND" in report.reasons["tests_passed"]


@pytest.mark.asyncio
async def test_gruener_testlauf_belegt_tests(monkeypatch):
    monkeypatch.setattr(build_checks, "TEST_COMMAND", "exit 0")
    workspace.write_module("proj", "auth", [("a.ts", "x")])

    bestanden, grund = await build_checks.run_tests("proj")
    assert bestanden is True
    assert "grün" in grund


@pytest.mark.asyncio
async def test_roter_testlauf_blockiert(monkeypatch):
    monkeypatch.setattr(build_checks, "TEST_COMMAND", "echo 'FAIL: 2 Tests rot'; exit 1")
    workspace.write_module("proj", "auth", [("a.ts", "x")])

    bestanden, grund = await build_checks.run_tests("proj")
    assert bestanden is False
    assert "Exit-Code 1" in grund
    assert "FAIL" in grund


@pytest.mark.asyncio
async def test_haengender_testlauf_wird_abgebrochen(monkeypatch):
    """Ein hängender Testlauf darf den Build nicht ewig blockieren.

    Die Zeitmessung ist der eigentliche Test: Ein `kill()` auf den Prozess
    allein reicht nicht — ein überlebendes Kind hält die Pipe offen, und dann
    wartet das Aufräumen die volle Laufzeit ab. Ohne diese Schranke lief der
    Test 30s statt 0,5s durch und meldete trotzdem 'abgebrochen'.
    """
    monkeypatch.setattr(build_checks, "TEST_COMMAND", "sleep 30")
    monkeypatch.setattr(build_checks, "TEST_TIMEOUT_SECONDS", 0.5)
    workspace.write_module("proj", "auth", [("a.ts", "x")])

    start = time.monotonic()
    bestanden, grund = await build_checks.run_tests("proj")
    dauer = time.monotonic() - start

    assert bestanden is False
    assert "abgebrochen" in grund
    assert dauer < 5, f"Abbruch dauerte {dauer:.1f}s — der Prozessbaum lebt weiter"


@pytest.mark.asyncio
async def test_abbruch_erwischt_auch_kindprozesse(monkeypatch):
    """Ein Testrunner startet Worker — die müssen mit sterben."""
    monkeypatch.setattr(build_checks, "TEST_COMMAND", "sleep 30 & sleep 30")
    monkeypatch.setattr(build_checks, "TEST_TIMEOUT_SECONDS", 0.5)
    workspace.write_module("proj", "auth", [("a.ts", "x")])

    start = time.monotonic()
    bestanden, _ = await build_checks.run_tests("proj")

    assert bestanden is False
    assert time.monotonic() - start < 5


# --- DevOps-Agent ------------------------------------------------------------


def _devops_task() -> AgentTask:
    return AgentTask(
        id="task_devops",
        agent_type="devops",
        input={"project_id": "proj", "risk_tier": "limited"},
        idempotency_key="proj:deploy",
    )


@pytest.mark.asyncio
async def test_devops_meldet_gemessene_artefakte(monkeypatch):
    """Der Kern der Änderung: Was ans Gate geht, ist gemessen — nicht fest."""
    gesehen = {}

    async def fake_gate(project_id, build_hash, artifacts):
        gesehen.update(artifacts)
        return {"status": "approved"}

    monkeypatch.setattr(rsd_client, "gate_check", fake_gate)
    workspace.write_module("proj", "ui", [("Banner.tsx", '// KI-generiert\nconst x = 1;')])

    graph = TaskGraph(project_id="proj", tasks=[])
    result = await devops.run(_devops_task(), graph)

    assert gesehen["transparency_notice_enabled"] is True
    assert gesehen["model_card_included"] is False
    assert result.output["gate_status"] == "approved"
    assert "transparency_notice_enabled" in result.output["check_reasons"]


@pytest.mark.asyncio
async def test_devops_fragt_das_gate_nur_einmal(monkeypatch):
    """Ein Retry darf keinen zweiten Eintrag im Prüfpfad erzeugen."""
    aufrufe = []

    async def fake_gate(project_id, build_hash, artifacts):
        aufrufe.append(build_hash)
        return {"status": "approved"}

    monkeypatch.setattr(rsd_client, "gate_check", fake_gate)
    workspace.write_module("proj", "ui", [("a.ts", "x")])

    graph = TaskGraph(project_id="proj", tasks=[])
    erst = await devops.run(_devops_task(), graph)
    zweit = await devops.run(_devops_task(), graph)

    assert len(aufrufe) == 1, f"Gate mehrfach gefragt: {aufrufe}"
    assert erst.output["build_hash"] == zweit.output["build_hash"]


@pytest.mark.asyncio
async def test_blockiertes_gate_ist_nicht_wiederholbar(monkeypatch):
    async def fake_gate(project_id, build_hash, artifacts):
        return {"status": "blocked", "reason": "Model Card fehlt"}

    monkeypatch.setattr(rsd_client, "gate_check", fake_gate)
    workspace.write_module("proj", "ui", [("a.ts", "x")])

    graph = TaskGraph(project_id="proj", tasks=[])
    with pytest.raises(devops.GateBlocked) as fehler:
        await devops.run(_devops_task(), graph)

    assert fehler.value.retryable is False
