"""Tests der Providerwahl.

Der Punkt dieser Datei ist nicht „Gemini funktioniert", sondern:
`select_provider()` ist die **einzige** Stelle, an der die Wahl faellt.

Vorher stand die Gemini-Entscheidung im FastAPI-Lifespan und ueberschrieb das
Ergebnis von `select_provider()` nachtraeglich. Fuer den laufenden Dienst war
das unauffaellig — jeder Einstiegspunkt ohne Lifespan (Worker, CLI, Test) bekam
jedoch still einen anderen Provider. Bei einer Transformation, die auf
Gemini-Preise kalkuliert ist, faellt so ein Wechsel erst auf der Rechnung auf.

`test_lifespan_braucht_keinen_override` haelt genau das fest: Die Umgebung
allein muss reichen.

Die Konfiguration wird ueber `monkeypatch.setattr` auf dem Modul gesetzt, nicht
ueber `importlib.reload` — ein Reload wuerde die Modulkonstanten dauerhaft
ueberschreiben und nachfolgende Tests verfaelschen.
"""

from __future__ import annotations

import pytest

from app.services import llm


@pytest.fixture(autouse=True)
def _leere_provider_konfiguration(monkeypatch: pytest.MonkeyPatch):
    """Jeder Test startet ohne Key, ohne URL, ohne Vorgabe."""
    monkeypatch.setattr(llm, "LLM_PROVIDER", "")
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "")
    monkeypatch.setattr(llm, "OLLAMA_BASE_URL", "")


def test_ohne_key_bleibt_der_stub() -> None:
    assert llm.select_provider().name == "stub"


def test_gemini_key_allein_genuegt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "k-gemini")
    provider = llm.select_provider()
    assert provider.name == "gemini"
    assert provider.model.startswith("gemini")


def test_gemini_hat_vorrang_vor_claude(monkeypatch: pytest.MonkeyPatch) -> None:
    """Beide Keys gesetzt → Gemini.

    Das ist die Reihenfolge, die der fruehere Lifespan-Override faktisch
    hergestellt hat. Sie wird hier bewusst festgeschrieben, damit die
    Umstellung auf select_provider() das Verhalten nicht still aendert.
    """
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "k-gemini")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "k-claude")
    assert llm.select_provider().name == "gemini"


def test_ohne_gemini_key_bleibt_claude(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "k-claude")
    assert llm.select_provider().name == "anthropic"


def test_explizite_vorgabe_schlaegt_autoerkennung(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "LLM_PROVIDER", "anthropic")
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "k-gemini")
    assert llm.select_provider().name == "anthropic"


def test_llm_provider_gemini_wird_verstanden(monkeypatch: pytest.MonkeyPatch) -> None:
    """`LLM_PROVIDER=gemini` ohne Key.

    Vorher kannte der Router diesen Wert nicht und fiel auf den naechsten
    Zweig zurueck — eine ausdrueckliche Vorgabe wurde also ignoriert.
    """
    monkeypatch.setattr(llm, "LLM_PROVIDER", "gemini")
    assert llm.select_provider().name == "gemini"


def test_ollama_bleibt_erreichbar(monkeypatch: pytest.MonkeyPatch) -> None:
    """EU-lokaler Weg darf durch Gemini nicht verdeckt werden."""
    monkeypatch.setattr(llm, "OLLAMA_BASE_URL", "http://ollama.local")
    assert llm.select_provider().name == "ollama"

    monkeypatch.setattr(llm, "LLM_PROVIDER", "ollama")
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "k-gemini")
    assert llm.select_provider().name == "ollama"


def test_lifespan_braucht_keinen_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """Die Umgebung allein bestimmt den Provider — ohne FastAPI-Startup.

    Genau diese Zusicherung fehlte: `main.py` musste nach select_provider()
    ein `set_provider(GeminiProvider())` nachschieben. Wer das Modul ohne
    FastAPI benutzt, landete deshalb bei einem anderen Anbieter.
    """
    monkeypatch.setattr(llm, "GEMINI_API_KEY", "k-gemini")
    monkeypatch.setattr(llm, "ANTHROPIC_API_KEY", "k-claude")

    llm.select_provider()
    # Kein Lifespan, kein set_provider — nur der Router selbst.
    assert llm.get_provider().name == "gemini"
