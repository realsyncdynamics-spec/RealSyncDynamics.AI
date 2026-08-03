"""Prüft die Form des Claude-Aufrufs — ohne API-Key und ohne Netzzugriff.

Die anderen Tests fahren gegen einen Fake-Provider und sagen deshalb nichts
darüber, ob der echte SDK-Aufruf richtig gebaut ist. Genau dort liegt aber das
Risiko: Ein falscher Parameter fällt nicht beim Testen auf, sondern als 400 im
Produktivlauf — `budget_tokens`, `temperature` und `top_p` sind auf diesem
Modell nicht erlaubt, `output_config.format` heißt nicht mehr `output_format`.

Deshalb läuft hier ein lokaler HTTP-Server, der sich als Claude ausgibt: Der
Test liest mit, was das SDK tatsächlich sendet, und prüft die Antwortauswertung
gegen einen echten SSE-Stream.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Dict, List, Tuple

import pytest

pytest.importorskip("anthropic")

from app.agents.contracts import PlannerOutput  # noqa: E402
from app.services.llm import LLMRefusalError  # noqa: E402


def _sse(*events: Tuple[str, dict]) -> bytes:
    return "".join(f"event: {name}\ndata: {json.dumps(data)}\n\n" for name, data in events).encode()


def _stream(text: str, stop_reason: str = "end_turn", stop_details: dict = None) -> bytes:
    message_delta = {
        "type": "message_delta",
        "delta": {"stop_reason": stop_reason, "stop_sequence": None},
        "usage": {"output_tokens": 17},
    }
    if stop_details is not None:
        message_delta["delta"]["stop_details"] = stop_details

    return _sse(
        (
            "message_start",
            {
                "type": "message_start",
                "message": {
                    "id": "msg_1",
                    "type": "message",
                    "role": "assistant",
                    "model": "claude-opus-5",
                    "content": [],
                    "stop_reason": None,
                    "stop_sequence": None,
                    "usage": {"input_tokens": 42, "output_tokens": 0},
                },
            },
        ),
        (
            "content_block_start",
            {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        ),
        (
            "content_block_delta",
            {
                "type": "content_block_delta",
                "index": 0,
                "delta": {"type": "text_delta", "text": text},
            },
        ),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", message_delta),
        ("message_stop", {"type": "message_stop"}),
    )


@pytest.fixture
def fake_claude(monkeypatch):
    """Startet einen lokalen Endpunkt und gibt (Provider-Fabrik, Mitschnitt) zurück."""
    aufzeichnung: Dict[str, object] = {}
    antwort: List[bytes] = [_stream('{"features": [], "open_questions": [], "compliance_notes": []}')]

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802 - von BaseHTTPRequestHandler vorgegeben
            laenge = int(self.headers.get("content-length", 0))
            aufzeichnung["pfad"] = self.path
            aufzeichnung["body"] = json.loads(self.rfile.read(laenge))
            aufzeichnung["beta"] = self.headers.get("anthropic-beta")
            body = antwort[0]
            self.send_response(200)
            self.send_header("content-type", "text/event-stream")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):  # Testausgabe ruhig halten
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    # Der SDK-Client wird beim ersten Aufruf gebaut und liest die Basis-URL
    # aus der Umgebung — deshalb hier setzen, nicht im Provider.
    monkeypatch.setenv("ANTHROPIC_BASE_URL", f"http://127.0.0.1:{server.server_address[1]}")
    for variable in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        monkeypatch.delenv(variable, raising=False)

    def provider():
        from app.services.llm import AnthropicProvider

        return AnthropicProvider(api_key="sk-test")

    try:
        yield provider, aufzeichnung, antwort
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.asyncio
async def test_anfrage_hat_die_erwartete_form(fake_claude):
    provider, aufzeichnung, _ = fake_claude

    response = await provider().complete(
        system="sys", user="usr", schema=PlannerOutput.model_json_schema(), effort="high"
    )

    body = aufzeichnung["body"]

    assert body["model"] == "claude-opus-5"
    assert body["thinking"] == {"type": "adaptive"}
    assert body["output_config"]["effort"] == "high"
    assert body["output_config"]["format"]["type"] == "json_schema"
    assert body["stream"] is True

    # Auf Opus 5 quittiert die API diese Parameter mit einem 400.
    for verboten in ("temperature", "top_p", "top_k", "budget_tokens", "output_format"):
        assert verboten not in body, f"{verboten} darf nicht gesendet werden"

    # Serverseitiger Fallback statt einer an den Aufrufer durchgereichten
    # Ablehnung — die Kategorie bestimmt das Ersatzmodell.
    assert body["fallbacks"] == "default"
    assert aufzeichnung["beta"] == "server-side-fallback-2026-07-01"

    assert response.tokens_in == 42
    assert response.tokens_out == 17
    assert response.model == "claude-opus-5"
    assert response.provider == "anthropic"


@pytest.mark.asyncio
async def test_ablehnung_wird_vor_content_erkannt(fake_claude):
    """`stop_reason: refusal` muss vor dem Lesen von `content` greifen."""
    provider, _, antwort = fake_claude
    antwort[0] = _stream("", stop_reason="refusal", stop_details={"type": "refusal", "category": "cyber"})

    with pytest.raises(LLMRefusalError):
        await provider().complete(system="sys", user="usr")
