"""Google Gemini provider for RealSync AI Studio.

Google AI Studio is used to create/manage the Gemini API key and test prompts;
production calls remain server-side so the key never reaches the browser.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

from .llm import LLMResponse, LLMUnavailableError

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Gemini 3.6 Flash is GA and supports multimodal input, function calling and
# structured output; it is the default reasoning model for AI Studio.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
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

        if schema is not None:
            payload["generationConfig"] = {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
            }

        url = f"{GEMINI_BASE_URL}/models/{self.model}:generateContent"
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

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

    async def generate_image(
        self,
        *,
        prompt: str,
        aspect_ratio: str = "16:9",
        image_size: str = "1K",
    ) -> Dict[str, str]:
        """Generate an optional visual asset for an AI Studio landing preview.

        The image is returned as an ephemeral data payload. Persistence belongs
        to the asset/evidence layer (R2) and is deliberately not mixed into the
        inference adapter.
        """
        if not self.api_key:
            raise LLMUnavailableError("GEMINI_API_KEY ist nicht gesetzt")
        if aspect_ratio not in {"1:1", "16:9", "9:16", "4:3", "3:2", "21:9"}:
            raise ValueError("unsupported aspect ratio")
        if image_size not in {"1K", "2K", "4K"}:
            raise ValueError("unsupported image size")

        base = GEMINI_BASE_URL.replace("/v1beta", "/v1")
        url = f"{base}/models/{GEMINI_IMAGE_MODEL}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "responseFormat": {
                    "image": {"aspectRatio": aspect_ratio, "imageSize": image_size}
                },
            },
        }
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    error = LLMUnavailableError(
                        f"Gemini Image API {response.status_code}: {response.text[:500]}"
                    )
                    error.retryable = response.status_code == 429 or response.status_code >= 500
                    raise error
                data = response.json()
        except httpx.HTTPError as exc:
            raise LLMUnavailableError(f"Gemini Image nicht erreichbar: {exc}") from exc

        parts = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return {
                    "mime_type": inline.get("mimeType", inline.get("mime_type", "image/png")),
                    "data_base64": inline["data"],
                    "model": GEMINI_IMAGE_MODEL,
                }
        raise LLMUnavailableError("Gemini Image lieferte kein Bild")
