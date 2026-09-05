"""P2-4 — Die CI/CD-Gate-Engine als Enforcement-Punkt der Mandantenrichtlinien.

Ausführen:  cd platform/governance_backend && pytest tests/test_gate_pdp.py

## Was hier auf dem Spiel steht

Bis P2-4 entschied diese Engine vollständig aus eigener Logik: Risikoklasse,
Gate-Katalog, Build-Artefakte. Die Richtlinien, die ein Mandant in der
Plattform gepflegt hat, hatten an der Auslieferungsschranke **keine Wirkung**
— Risiko R10 des Enforcement-Plans („drei Stacks, divergierende Semantik").

Die wichtigste Prüfung hier ist nicht, dass der PDP sperren kann. Es ist,
dass er **nicht lockern** kann: Ein `allow` des PDP darf aus einem lokal
blockierten Build kein `approved` machen. Sonst wäre die Anbindung ein
Rückbau der vorhandenen Regeln statt einer Ergänzung.
"""

from __future__ import annotations

import pytest

from app.schemas import GateCheckArtifacts, GateCheckRequest, ProjectRegistration
from app.services import gate_engine, inventory, pdp_client, telemetry_handler
from app.services.pdp_client import PdpOutcome


@pytest.fixture(autouse=True)
async def clean_state():
    await inventory.reset()
    telemetry_handler.reset()
    yield
    await inventory.reset()
    telemetry_handler.reset()


def _registration(**overrides) -> ProjectRegistration:
    base = dict(
        project_name="Test",
        description="Ein Testprojekt",
        data_types=[],
        data_subjects=[],
        models=[],
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


async def _register(tier: str = "limited") -> str:
    """Projekt mit den beiden Gates, die die Bestandstests auch nutzen."""
    return await inventory.create_project(
        _registration(models=["claude"]), tier, ["tests_passed", "transparency_notice_enabled"]
    )


def _stub(monkeypatch, outcome: PdpOutcome) -> None:
    """Ersetzt den Netzwerkaufruf — geprüft wird die Einfaltung, nicht httpx."""
    async def _fake(**_kwargs) -> PdpOutcome:
        return outcome
    monkeypatch.setattr(pdp_client, "evaluate_build", _fake)


NICHT_DURCHSETZEND = PdpOutcome(state="not_enforcing", detail="Beobachtungsbetrieb")


@pytest.mark.asyncio
class TestRichtlinieWirkt:
    async def test_block_sperrt_einen_sonst_sauberen_build(self, monkeypatch):
        _stub(monkeypatch, PdpOutcome(
            state="consulted", verdict="block",
            reasons=["Auslieferung an Freitagen ist untersagt."],
        ))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "blocked"
        assert "Freitagen" in (result.reason or "")
        assert "Mandantenrichtlinie" in (result.reason or "")

    async def test_require_approval_haelt_an_statt_durchzuwinken(self, monkeypatch):
        # Eine Pipeline kann niemanden fragen. Wer hier durchwinkt und auf ein
        # späteres Nachholen hofft, hat die Freigabe abgeschafft.
        _stub(monkeypatch, PdpOutcome(
            state="consulted", verdict="require_approval",
            reasons=["Diese Auslieferung braucht die Freigabe der Compliance-Rolle."],
        ))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "blocked"
        assert "Freigabe" in (result.reason or "")
        # Der Weg zur Freigabe steht dabei, sonst ist die Sperre eine Sackgasse.
        assert "/app/governance/gates" in (result.remediation or "")

    async def test_warn_warnt_und_haelt_nicht_auf(self, monkeypatch):
        _stub(monkeypatch, PdpOutcome(
            state="consulted", verdict="warn", reasons=["Modellanbieter ausserhalb der EU."],
        ))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "warning"
        assert "ausserhalb der EU" in (result.reason or "")

    async def test_allow_laesst_einen_sauberen_build_durch(self, monkeypatch):
        _stub(monkeypatch, PdpOutcome(state="consulted", verdict="allow", reasons=[]))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "approved"


@pytest.mark.asyncio
class TestDerPdpKannNurVerschaerfen:
    async def test_allow_hebt_eine_lokale_sperre_nicht_auf(self, monkeypatch):
        # DIE ZENTRALE PRÜFUNG DIESER DATEI. `tests_passed` blockiert immer,
        # unabhängig von der Risikoklasse. Würde ein `allow` des PDP das
        # aufheben, wäre P2-4 ein Rückbau statt einer Ergänzung — und eine
        # Mandantenrichtlinie könnte die Produktregeln aushebeln.
        _stub(monkeypatch, PdpOutcome(state="consulted", verdict="allow", reasons=[]))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(
                project_id=pid, build_hash="abc",
                artifacts=_artifacts(tests_passed=False),
            )
        )
        assert result.status == "blocked"
        assert "Test-Suite" in (result.reason or "")

    async def test_allow_hebt_die_art5_sperre_nicht_auf(self, monkeypatch):
        # Verbotene Praktik nach Art. 5 EU AI Act. Diese Sperre steht vor allem
        # anderen und wird gar nicht erst bis zum PDP durchgereicht.
        _stub(monkeypatch, PdpOutcome(state="consulted", verdict="allow", reasons=[]))
        project_id = await _register("unacceptable")
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=project_id, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "blocked"
        assert "Art. 5" in (result.reason or "")

    async def test_ein_unbekanntes_projekt_bleibt_gesperrt(self, monkeypatch):
        _stub(monkeypatch, PdpOutcome(state="consulted", verdict="allow", reasons=[]))
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id="proj_gibtesnicht", build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "blocked"


@pytest.mark.asyncio
class TestAusfall:
    async def test_ausfall_sperrt(self, monkeypatch):
        _stub(monkeypatch, PdpOutcome(state="unavailable", detail="Zeitüberschreitung"))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "blocked"

    async def test_die_begruendung_nennt_den_ausfall_und_den_ausweg(self, monkeypatch):
        # Eine Sperre wegen Ausfall, die wie ein Richtlinienverstoss klingt,
        # schickt jemanden in seinen Build statt zur Infrastruktur. Und weil
        # ein blockierender PDP jede Auslieferung anhält — auch die des
        # Fixes — muss der Ausweg dastehen, statt versteckt zu sein.
        _stub(monkeypatch, PdpOutcome(state="unavailable", detail="Zeitüberschreitung"))
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert "nicht erreichbar" in (result.reason or "")
        assert "Zeitüberschreitung" in (result.reason or "")
        assert "GOVERNANCE_PDP_MODE=off" in (result.remediation or "")


@pytest.mark.asyncio
class TestBeobachtungsbetrieb:
    async def test_aendert_das_ergebnis_nicht(self, monkeypatch):
        _stub(monkeypatch, NICHT_DURCHSETZEND)
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert result.status == "approved"

    async def test_sagt_aber_dass_die_richtlinien_nicht_binden(self, monkeypatch):
        _stub(monkeypatch, NICHT_DURCHSETZEND)
        pid = await _register()
        result = await gate_engine.evaluate(
            GateCheckRequest(project_id=pid, build_hash="abc", artifacts=_artifacts())
        )
        assert "binden hier derzeit nicht" in (result.reason or "")


class TestModus:
    def test_default_ist_shadow(self, monkeypatch):
        # Ein Deploy darf das Verhalten nicht von selbst ändern.
        monkeypatch.delenv("GOVERNANCE_PDP_MODE", raising=False)
        assert pdp_client.mode() == "shadow"

    def test_modus_wird_normalisiert(self, monkeypatch):
        monkeypatch.setenv("GOVERNANCE_PDP_MODE", "  ENFORCE ")
        assert pdp_client.mode() == "enforce"


@pytest.mark.asyncio
class TestOhneKonfiguration:
    async def test_fehlende_konfiguration_ist_kein_ausfall(self, monkeypatch):
        # Wichtig für jede Umgebung, in der der PDP schlicht nicht vorgesehen
        # ist: „nicht konfiguriert" darf nicht wie „ausgefallen" wirken, sonst
        # blockiert die Anbindung dort jede Pipeline.
        monkeypatch.setenv("GOVERNANCE_PDP_MODE", "enforce")
        monkeypatch.delenv("GOVERNANCE_PDP_URL", raising=False)
        monkeypatch.delenv("GOVERNANCE_PDP_KEY", raising=False)
        outcome = await pdp_client.evaluate_build(
            project_id="p", risk_tier="limited", build_hash="abc", unmet_gates=[],
        )
        assert outcome.state == "not_enforcing"
        assert "Kein PDP konfiguriert" in outcome.detail
