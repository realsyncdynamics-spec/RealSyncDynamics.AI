"""Modellanbindung der Agenten.

Provider-neutral LLM layer with strict structured-output validation. Provider
secrets remain server-side. Runtime-only fields can be marked with
`exclude_from_generation` so they are attached by the orchestrator rather than
invented by the model.
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
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "16000"))
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
LLM_MAX_REPAIRS = int(os.getenv("LLM_MAX_REPAIRS", "1"))

class LLMError(RuntimeError):
    retryable = True

class LLMUnavailableError(LLMError):
    pass

class LLMRefusalError(LLMError):
    retryable = False

class LLMContractError(LLMError):
    retryable = False

class LLMResponse(BaseModel):
    text: str
    model: str
    provider: str
    tokens_in: int = 0
    tokens_out: int = 0
    repairs: int = 0
    def as_metrics(self) -> Dict[str, str]:
        return {"model": self.model, "provider": self.provider, "tokens_in": str(self.tokens_in), "tokens_out": str(self.tokens_out), "llm_repairs": str(self.repairs)}

class AnthropicProvider:
    name = "anthropic"
    FALLBACK_BETA = "server-side-fallback-2026-07-01"
    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key or ANTHROPIC_API_KEY
        self.model = model or ANTHROPIC_MODEL
        self._client: Any = None
    def _get_client(self) -> Any:
        if self._client is None:
            try:
                from anthropic import AsyncAnthropic
            except ImportError as exc:
                raise LLMUnavailableError("Paket 'anthropic' nicht installiert") from exc
            self._client = AsyncAnthropic(api_key=self._api_key, timeout=LLM_TIMEOUT_SECONDS)
        return self._client
    async def complete(self, *, system: str, user: str, schema: Optional[Dict[str, Any]] = None, effort: str = "medium") -> LLMResponse:
        client = self._get_client()
        import anthropic
        output_config: Dict[str, Any] = {"effort": effort}
        if schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": schema}
        try:
            async with client.beta.messages.stream(model=self.model, max_tokens=LLM_MAX_TOKENS, betas=[self.FALLBACK_BETA], fallbacks="default", thinking={"type": "adaptive"}, output_config=output_config, system=system, messages=[{"role": "user", "content": user}]) as stream:
                message = await stream.get_final_message()
        except anthropic.APIStatusError as exc:
            error = LLMUnavailableError(f"Claude-Aufruf fehlgeschlagen: {exc}")
            error.retryable = exc.status_code == 429 or exc.status_code >= 500
            raise error from exc
        except anthropic.APIConnectionError as exc:
            raise LLMUnavailableError(f"Claude nicht erreichbar: {exc}") from exc
        if message.stop_reason == "refusal":
            raise LLMRefusalError("Modell hat die Anfrage abgelehnt")
        text = "".join(block.text for block in message.content if block.type == "text")
        usage = message.usage
        return LLMResponse(text=text, model=message.model, provider=self.name, tokens_in=getattr(usage, "input_tokens", 0) or 0, tokens_out=getattr(usage, "output_tokens", 0) or 0)

class OllamaProvider:
    name = "ollama"
    def __init__(self, base_url: str = "", model: str = "") -> None:
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or OLLAMA_MODEL
    async def complete(self, *, system: str, user: str, schema: Optional[Dict[str, Any]] = None, effort: str = "medium") -> LLMResponse:
        payload = {"model": self.model, "stream": False, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if schema is not None:
            payload["format"] = schema
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            raise LLMUnavailableError(f"Ollama nicht erreichbar: {exc}") from exc
        return LLMResponse(text=data.get("message", {}).get("content", ""), model=data.get("model", self.model), provider=self.name, tokens_in=int(data.get("prompt_eval_count", 0) or 0), tokens_out=int(data.get("eval_count", 0) or 0))

class StubProvider:
    name = "stub"
    model = "stub"
    async def complete(self, *, system: str, user: str, schema: Optional[Dict[str, Any]] = None, effort: str = "medium") -> LLMResponse:
        payload = _skeleton_from_schema(schema) if schema else {}
        return LLMResponse(text=json.dumps(payload, ensure_ascii=False), model=self.model, provider=self.name)

def _skeleton_from_schema(schema: Dict[str, Any]) -> Any:
    kind = schema.get("type")
    if kind == "object":
        properties = schema.get("properties", {})
        return {name: _skeleton_from_schema(subschema) for name, subschema in properties.items() if name in schema.get("required", list(properties))}
    if kind == "array": return []
    if kind in {"integer", "number"}: return 0
    if kind == "boolean": return False
    return ""

_provider: Any = None

def select_provider() -> Any:
    global _provider
    choice = LLM_PROVIDER.lower()
    if choice == "anthropic": _provider = AnthropicProvider()
    elif choice == "ollama": _provider = OllamaProvider()
    elif choice == "stub": _provider = StubProvider()
    elif ANTHROPIC_API_KEY: _provider = AnthropicProvider()
    elif OLLAMA_BASE_URL: _provider = OllamaProvider()
    else: _provider = StubProvider()
    logger.info("LLM-Provider: %s (Modell %s)", _provider.name, getattr(_provider, "model", "?"))
    return _provider

def get_provider() -> Any:
    return _provider if _provider is not None else select_provider()

def set_provider(provider: Any) -> None:
    global _provider
    _provider = provider


def build_schema(model_cls: Type[BaseModel]) -> Dict[str, Any]:
    raw = model_cls.model_json_schema()
    defs = raw.pop("$defs", {})
    return _require_all(_strip_generation_excluded(_inline_refs(raw, defs, frozenset())))


def _strip_generation_excluded(node: Any) -> Any:
    if isinstance(node, list):
        return [_strip_generation_excluded(item) for item in node]
    if not isinstance(node, dict):
        return node
    result = {key: _strip_generation_excluded(value) for key, value in node.items()}
    properties = result.get("properties")
    if result.get("type") == "object" and isinstance(properties, dict):
        excluded = [name for name, schema in properties.items() if schema.get("exclude_from_generation") is True]
        for name in excluded:
            properties.pop(name, None)
        if isinstance(result.get("required"), list):
            result["required"] = [name for name in result["required"] if name not in excluded]
    return result


def _inline_refs(node: Any, defs: Dict[str, Any], seen: frozenset) -> Any:
    if isinstance(node, list): return [_inline_refs(item, defs, seen) for item in node]
    if not isinstance(node, dict): return node
    ref = node.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/$defs/"):
        name = ref.split("/")[-1]
        if name in seen: raise LLMContractError(f"Rekursives Schema {name} ist nicht inlinebar")
        target = defs.get(name)
        if target is None: raise LLMContractError(f"Unbekannte Schema-Referenz {ref}")
        resolved = _inline_refs(target, defs, seen | {name})
        rest = {k: _inline_refs(v, defs, seen) for k, v in node.items() if k != "$ref"}
        return {**resolved, **rest}
    return {key: _inline_refs(value, defs, seen) for key, value in node.items()}


def _require_all(node: Any) -> Any:
    if isinstance(node, list): return [_require_all(item) for item in node]
    if not isinstance(node, dict): return node
    result = {key: _require_all(value) for key, value in node.items()}
    properties = result.get("properties")
    if result.get("type") == "object" and isinstance(properties, dict): result["required"] = list(properties)
    return result

_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)

def _strip_fence(text: str) -> str:
    match = _FENCE.match(text)
    return match.group(1) if match else text.strip()

def parse_json_output(text: str, model_cls: Type[T]) -> T:
    raw = _strip_fence(text)
    if not raw: raise ValueError("leere Antwort")
    return model_cls.model_validate_json(raw)

async def complete_json(*, system: str, user: str, model_cls: Type[T], effort: str = "medium", provider: Any = None, max_repairs: Optional[int] = None, project_id: str = "") -> Tuple[T, LLMResponse]:
    schema = build_schema(model_cls)
    active = provider or get_provider()
    response = await active.complete(system=system, user=user, schema=schema, effort=effort)
    try:
        result = parse_json_output(response.text, model_cls)
    except (ValueError, ValidationError) as exc:
        raise LLMContractError(f"Structured output invalid: {exc}") from exc
    return result, response
