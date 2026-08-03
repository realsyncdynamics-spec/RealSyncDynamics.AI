"""Modellanbindung der Agenten.

Bis hierher waren die Agenten Stubs mit fertigen System-Prompts. Diese Schicht
hängt sie an ein echtes Modell — ohne dass ein Agent wissen muss, welches.

**Drei Provider hinter einem Vertrag:**

  * `anthropic` — Claude (Standard, sobald `ANTHROPIC_API_KEY` gesetzt ist).
  * `ollama`    — EU-lokales Modell auf eigener Hardware. Für Kunden, die
                  keine Daten an einen US-Anbieter geben dürfen; die Plattform
                  verkauft EU-Souveränität, also muss dieser Weg existieren.
  * `stub`      — deterministische Antwort ohne Netzzugriff. **Das ist der
                  Default ohne API-Key**, damit `docker compose up` und die
                  Testsuite ohne Zugangsdaten durchlaufen.

**Warum das JSON zweimal abgesichert wird.** Die Agenten verarbeiten die
Antwort strukturiert weiter — der Architect-Modulschnitt wird direkt zu
Coder-Tasks. Ein halb geparster Modelloutput würde also den Graphen bauen.
Deshalb:

  1. Structured Outputs (`output_config.format`), wo der Provider sie kennt.
     Claude liefert dann garantiert schema-konformes JSON.
  2. Eine **begrenzte** Reparaturschleife für Provider ohne diese Garantie
     (Ollama). Begrenzt, weil ein Modell, das die Form beim zweiten Versuch
     nicht trifft, sie auch beim zehnten nicht trifft — jede weitere Runde
     kostet nur Geld und Latenz.

Vor jedem Modellaufruf greift das Token-Budget des Builds (`budget.py`) —
auch vor jedem Reparaturversuch, denn eine Reparatur ist ein vollwertiger
Aufruf und darf ein aufgebrauchtes Budget nicht weiter überziehen.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, Optional, Tuple, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from . import budget

logger = logging.getLogger("builder.llm")

T = TypeVar("T", bound=BaseModel)

# --- Konfiguration -----------------------------------------------------------

# Vorgabe der Plattform: das jeweils fähigste Claude-Modell. Bewusst nicht aus
# Kostengründen heruntergestuft — der Modulschnitt eines Architect-Laufs
# bestimmt alles Folgende, ein schwaches Ergebnis kostet mehr als das Modell.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3")

# Erzwingt einen Provider. Leer = Auto-Erkennung (siehe `select_provider`).
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")

LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "16000"))
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))

# Reparaturversuche *zusätzlich* zum ersten Aufruf.
LLM_MAX_REPAIRS = int(os.getenv("LLM_MAX_REPAIRS", "1"))


# --- Fehlerbilder ------------------------------------------------------------
#
# Das Attribut `retryable` entscheidet im Scheduler, ob ein weiterer Versuch
# stattfindet (siehe agent_runner._run_task). Ein Netzfehler lohnt einen
# Retry, eine Ablehnung durch das Modell nicht.


class LLMError(RuntimeError):
    retryable = True


class LLMUnavailableError(LLMError):
    """Provider nicht erreichbar oder Antwort unbrauchbar."""


class LLMRefusalError(LLMError):
    """Das Modell hat die Anfrage abgelehnt (`stop_reason == "refusal"`).

    Nicht wiederholbar: Dieselbe Anfrage wird beim zweiten Mal genauso
    abgelehnt. Fachlich ist das ein Befund und keine Panne — ein Build-Prompt,
    den das Modell ablehnt, gehört in den Prüfpfad.
    """

    retryable = False


class LLMContractError(LLMError):
    """Die Antwort passte auch nach der Reparaturschleife nicht zum Schema."""

    retryable = False


class LLMResponse(BaseModel):
    """Rohantwort eines Providers samt Verbrauch."""

    text: str
    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0

    # Anzahl der Reparaturrunden, die nötig waren. > 0 heißt: Der Provider
    # hält das Schema nicht von selbst ein — im Prüfpfad sichtbar.
    repairs: int = 0

    def as_metrics(self) -> Dict[str, str]:
        """Form, die `audit_log.record(metrics=...)` erwartet."""
        return {
            "model": self.model,
            "provider": self.provider,
            "tokens_in": str(self.tokens_in),
            "tokens_out": str(self.tokens_out),
            "llm_repairs": str(self.repairs),
        }


# --- Provider ----------------------------------------------------------------


class AnthropicProvider:
    """Claude über das offizielle SDK.

    Adaptive Thinking ist auf Opus 5 der Normalfall; `effort` steuert, wie viel
    Denkarbeit ein Schritt bekommt. `temperature`/`top_p`/`budget_tokens` sind
    auf diesem Modell nicht erlaubt und werden deshalb nirgends gesetzt.
    """

    name = "anthropic"

    # `fallbacks: "default"` fängt eine Ablehnung serverseitig ab, statt sie
    # an den Aufrufer zurückzugeben — die Kategorie bestimmt das Ersatzmodell.
    FALLBACK_BETA = "server-side-fallback-2026-07-01"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key or ANTHROPIC_API_KEY
        self.model = model or ANTHROPIC_MODEL
        self._client: Any = None

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                from anthropic import AsyncAnthropic
            except ImportError as exc:  # pragma: no cover - Abhängigkeit fehlt
                raise LLMUnavailableError(
                    "Paket 'anthropic' nicht installiert — siehe requirements.txt"
                ) from exc
            self._client = AsyncAnthropic(api_key=self._api_key, timeout=LLM_TIMEOUT_SECONDS)
        return self._client

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: Optional[Dict[str, Any]] = None,
        effort: str = "medium",
    ) -> LLMResponse:
        # Erst der Client: Fehlt das Paket, wirft `_get_client` einen
        # sprechenden LLMUnavailableError statt eines nackten ImportError.
        client = self._get_client()
        import anthropic

        output_config: Dict[str, Any] = {"effort": effort}
        if schema is not None:
            # Structured Outputs: Claude liefert damit schema-konformes JSON,
            # die Reparaturschleife läuft hier also im Normalfall nie an.
            output_config["format"] = {"type": "json_schema", "schema": schema}

        try:
            # Gestreamt, weil `max_tokens` hoch ist: ein nicht gestreamter
            # Aufruf dieser Größe läuft sonst in den Request-Timeout.
            async with client.beta.messages.stream(
                model=self.model,
                max_tokens=LLM_MAX_TOKENS,
                betas=[self.FALLBACK_BETA],
                fallbacks="default",
                thinking={"type": "adaptive"},
                output_config=output_config,
                system=system,
                messages=[{"role": "user", "content": user}],
            ) as stream:
                message = await stream.get_final_message()
        except anthropic.APIStatusError as exc:
            # 4xx (außer 429) sind Aufruffehler — ein Retry ändert nichts.
            error = LLMUnavailableError(f"Claude-Aufruf fehlgeschlagen: {exc}")
            error.retryable = exc.status_code == 429 or exc.status_code >= 500
            raise error from exc
        except anthropic.APIConnectionError as exc:
            raise LLMUnavailableError(f"Claude nicht erreichbar: {exc}") from exc

        # Vor `content`: Bei einer Ablehnung steht dort nichts Verwertbares.
        if message.stop_reason == "refusal":
            details = getattr(message, "stop_details", None)
            raise LLMRefusalError(
                f"Modell hat abgelehnt (Kategorie: {getattr(details, 'category', 'unbekannt')})"
            )

        text = "".join(block.text for block in message.content if block.type == "text")
        usage = message.usage

        return LLMResponse(
            text=text,
            model=message.model,
            provider=self.name,
            tokens_in=getattr(usage, "input_tokens", 0) or 0,
            tokens_out=getattr(usage, "output_tokens", 0) or 0,
        )


class OllamaProvider:
    """EU-lokales Modell über die Ollama-HTTP-API.

    Kein Structured-Output-Vertrag — `format: "json"` erzwingt nur gültiges
    JSON, nicht das richtige Schema. Genau dafür gibt es die Reparaturschleife.
    """

    name = "ollama"

    def __init__(self, base_url: str = "", model: str = "") -> None:
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or OLLAMA_MODEL

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: Optional[Dict[str, Any]] = None,
        effort: str = "medium",
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if schema is not None:
            # Ollama akzeptiert ein JSON-Schema als `format` — best effort.
            payload["format"] = schema

        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            raise LLMUnavailableError(f"Ollama nicht erreichbar: {exc}") from exc

        return LLMResponse(
            text=data.get("message", {}).get("content", ""),
            model=data.get("model", self.model),
            provider=self.name,
            tokens_in=int(data.get("prompt_eval_count", 0) or 0),
            tokens_out=int(data.get("eval_count", 0) or 0),
        )


class StubProvider:
    """Deterministischer Provider ohne Netzzugriff.

    Erzeugt aus dem JSON-Schema ein minimal gültiges Objekt. Damit bleibt der
    komplette Ablauf — Graph, Gate, Prüfpfad — ohne Zugangsdaten prüfbar, und
    ein Build läuft auch dann durch, wenn kein Provider konfiguriert ist.
    """

    name = "stub"
    model = "stub"

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: Optional[Dict[str, Any]] = None,
        effort: str = "medium",
    ) -> LLMResponse:
        payload = _skeleton_from_schema(schema) if schema else {}
        return LLMResponse(
            text=json.dumps(payload, ensure_ascii=False),
            model=self.model,
            provider=self.name,
        )


def _skeleton_from_schema(schema: Dict[str, Any]) -> Any:
    """Kleinstes Objekt, das ein JSON-Schema erfüllt."""
    kind = schema.get("type")

    if kind == "object":
        properties = schema.get("properties", {})
        return {
            name: _skeleton_from_schema(subschema)
            for name, subschema in properties.items()
            if name in schema.get("required", list(properties))
        }
    if kind == "array":
        return []
    if kind == "integer" or kind == "number":
        return 0
    if kind == "boolean":
        return False
    return ""


# --- Providerauswahl ---------------------------------------------------------

_provider: Any = None


def select_provider() -> Any:
    """Wählt den Provider anhand der Umgebung und merkt ihn sich.

    Reihenfolge: explizite Vorgabe → Claude (Key vorhanden) → Ollama (URL
    vorhanden) → Stub. Der Stub am Ende ist Absicht: Ein fehlender Key soll
    den Dienst nicht am Starten hindern, sondern sichtbar degradieren.
    """
    global _provider

    choice = LLM_PROVIDER.lower()
    if choice == "anthropic":
        _provider = AnthropicProvider()
    elif choice == "ollama":
        _provider = OllamaProvider()
    elif choice == "stub":
        _provider = StubProvider()
    elif ANTHROPIC_API_KEY:
        _provider = AnthropicProvider()
    elif OLLAMA_BASE_URL:
        _provider = OllamaProvider()
    else:
        _provider = StubProvider()

    logger.info("LLM-Provider: %s (Modell %s)", _provider.name, getattr(_provider, "model", "?"))
    return _provider


def get_provider() -> Any:
    if _provider is None:
        return select_provider()
    return _provider


def set_provider(provider: Any) -> None:
    """Nur für Tests und gezielte Overrides."""
    global _provider
    _provider = provider


# --- JSON-Vertrag ------------------------------------------------------------

def build_schema(model_cls: Type[BaseModel]) -> Dict[str, Any]:
    """Macht aus einem Pydantic-Modell ein Structured-Output-taugliches Schema.

    Zwei Eingriffe gegenüber `model_json_schema()`, beide konservativ:

    * **`$ref`/`$defs` werden aufgelöst.** Pydantic lagert verschachtelte
      Modelle (`Feature`, `ApiEndpoint`, ...) in `$defs` aus und verweist
      darauf. Ein Schema ohne Verweise ist unter jeder Auslegung gültig, ein
      Schema mit ist es nur, wenn der Provider Referenzen unterstützt — hier
      nicht zu raten ist billiger als ein 400 im Produktivlauf.
    * **Alle Eigenschaften werden `required`.** Pydantic lässt Felder mit
      Default aus `required` heraus. Zusammen mit `additionalProperties: false`
      verlangen strikte Modi aber üblicherweise Vollständigkeit. Für die
      Validierung ändert das nichts: Die Defaults bleiben im Modell.
    """
    raw = model_cls.model_json_schema()
    defs = raw.pop("$defs", {})
    return _require_all(_inline_refs(raw, defs, frozenset()))


def _inline_refs(node: Any, defs: Dict[str, Any], seen: frozenset) -> Any:
    if isinstance(node, list):
        return [_inline_refs(item, defs, seen) for item in node]
    if not isinstance(node, dict):
        return node

    ref = node.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/$defs/"):
        name = ref.split("/")[-1]
        if name in seen:
            # Rekursives Modell — nicht auflösbar ohne Verweis. Unsere
            # Verträge haben keins; die Bremse steht, damit ein künftiges
            # nicht in eine Endlosschleife läuft.
            raise LLMContractError(f"Rekursives Schema {name} ist nicht inlinebar")
        target = defs.get(name)
        if target is None:
            raise LLMContractError(f"Unbekannte Schema-Referenz {ref}")
        aufgeloest = _inline_refs(target, defs, seen | {name})
        # Geschwisterfelder (z.B. `title`) neben dem $ref beibehalten.
        rest = {k: _inline_refs(v, defs, seen) for k, v in node.items() if k != "$ref"}
        return {**aufgeloest, **rest}

    return {key: _inline_refs(value, defs, seen) for key, value in node.items()}


def _require_all(node: Any) -> Any:
    if isinstance(node, list):
        return [_require_all(item) for item in node]
    if not isinstance(node, dict):
        return node

    result = {key: _require_all(value) for key, value in node.items()}
    properties = result.get("properties")
    if result.get("type") == "object" and isinstance(properties, dict):
        result["required"] = list(properties)
    return result


_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


def _strip_fence(text: str) -> str:
    """Entfernt einen Markdown-Codeblock, falls das Modell einen gesetzt hat."""
    match = _FENCE.match(text)
    return match.group(1) if match else text.strip()


def parse_json_output(text: str, model_cls: Type[T]) -> T:
    """Parst und validiert eine Modellantwort. Wirft bei Verstoß."""
    raw = _strip_fence(text)
    if not raw:
        raise ValueError("leere Antwort")
    return model_cls.model_validate_json(raw)


async def complete_json(
    *,
    system: str,
    user: str,
    model_cls: Type[T],
    effort: str = "medium",
    provider: Any = None,
    max_repairs: Optional[int] = None,
    project_id: str = "",
) -> Tuple[T, LLMResponse]:
    """Ruft das Modell auf und gibt ein validiertes Ergebnis zurück.

    Passt die Antwort nicht zum Schema, geht **der Fehlertext** zurück ans
    Modell — das ist die Reparaturschleife. Sie ist bewusst eng begrenzt
    (`LLM_MAX_REPAIRS`, Default 1): Ein Modell, das die Form nach dem ersten
    Hinweis nicht trifft, trifft sie auch nach dem fünften nicht, und jede
    Runde kostet einen vollen Aufruf.

    Rückgabe ist ein Paar aus validiertem Objekt und der letzten `LLMResponse`
    — Letztere trägt den Verbrauch für den Prüfpfad.

    Mit `project_id` greift zusätzlich das Token-Budget des Builds. Geprüft
    wird vor jedem Aufruf — auch vor jedem Reparaturversuch, denn eine
    Reparatur ist ein vollwertiger Modellaufruf und darf ein aufgebrauchtes
    Budget nicht weiter überziehen.
    """
    provider = provider or get_provider()
    budget_versuche = LLM_MAX_REPAIRS if max_repairs is None else max_repairs
    schema = build_schema(model_cls)

    prompt = user
    last_error = ""

    for attempt in range(budget_versuche + 1):
        budget.ensure_within(project_id)
        response = await provider.complete(
            system=system, user=prompt, schema=schema, effort=effort
        )
        try:
            parsed = parse_json_output(response.text, model_cls)
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            logger.warning(
                "Antwort von %s verletzt %s (Versuch %d/%d): %s",
                provider.name,
                model_cls.__name__,
                attempt + 1,
                budget_versuche + 1,
                last_error,
            )
            # Der Reparatur-Prompt enthält die kaputte Antwort und den
            # konkreten Verstoß — ohne beides rät das Modell nur neu.
            prompt = (
                f"{user}\n\n"
                "Deine vorherige Antwort war ungültig.\n"
                f"Antwort:\n{response.text[:2000]}\n\n"
                f"Fehler:\n{last_error}\n\n"
                "Antworte erneut, ausschließlich als JSON, ohne Codeblock "
                "und ohne erklärenden Text."
            )
            continue

        response.repairs = attempt
        return parsed, response

    raise LLMContractError(
        f"{provider.name} lieferte nach {budget_versuche + 1} Versuchen kein gültiges "
        f"{model_cls.__name__}: {last_error}"
    )
