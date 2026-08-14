"""Google Gemini provider for the SiteOS Builder.

Google AI Studio is used to create/manage the Gemini API key and test prompts;
the production Builder calls the Gemini API server-side so the key never
reaches the browser.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

from .llm import LLMResponse, LLMUnavailableError

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
).rstrip("/")


class GeminiProvider:
    """Gemini API adapter implementing the Builder LLM provider contract."""

    name = "gemini"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: Optional[Dict[str, Any]] = None,
        effort: str = "medium",
    ) -> LLMResponse:
        if not self.api_key:
            raise LLMUnavailableError("GEMINI_API_KEY ist nicht gesetzt")

        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {},
        }

        # Gemini Structured Output: the Builder's existing Pydantic contract
        # is forwarded directly as JSON schema, keeping the same validation
        # path used by the other providers.
        if schema is not None:
            payload["generationConfig"] = {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
            }

        url = f"{GEMINI_BASE_URL}/models/{self.model}:generateContent"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    error = LLMUnavailableError(
                        f"Gemini API {response.status_code}: {response.text[:500]}"
                    )
                    error.retryable = response.status_code == 429 or response.status_code >= 500
                    raise error
                data = response.json()
        except httpx.HTTPError as exc:
            raise LLMUnavailableError(f"Gemini nicht erreichbar: {exc}") from exc

        candidates = data.get("candidates") or []
        if not candidates:
            raise LLMUnavailableError("Gemini lieferte keine Kandidaten")

        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts if part.get("text"))
        if not text:
            raise LLMUnavailableError("Gemini lieferte keinen Textinhalt")

        usage = data.get("usageMetadata") or {}
        return LLMResponse(
            text=text,
            model=data.get("modelVersion", self.model),
            provider=self.name,
            tokens_in=int(usage.get("promptTokenCount", 0) or 0),
            tokens_out=int(usage.get("candidatesTokenCount", 0) or 0),
        )
