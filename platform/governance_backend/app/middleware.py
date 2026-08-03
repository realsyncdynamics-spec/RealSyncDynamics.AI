"""Security middlewares für das Governance Backend.

Rate Limiting: Einfacher In-Memory-Approach, der pro IP zählt.
Security Headers: Standard-Sicherheitsheader für alle Responses.
Request Size Limits: Begrenzt Payload-Größe um DoS-Angriffe zu verhindern.
Error Sanitization: Verhindert Preisgabe interner Implementierungsdetails.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("governance.security")

# Max 10 MB pro Request-Body (konfigurierbar via MAX_BODY_SIZE)
MAX_BODY_SIZE = int(os.getenv("MAX_BODY_SIZE", "10485760"))


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Einfaches Rate Limiting pro IP-Adresse.

    Limits: 100 requests pro Minute pro IP.
    Zu aggressive Requests (> 100/min) bekommen 429 (Too Many Requests).
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        # {ip: [(timestamp, count), ...]} — wir halten nur 1-min-Fenster
        self.request_log: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # API-Endpoints rate-limitiert, Healthcheck nicht
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # IP auslesen (X-Forwarded-For durch Reverse Proxy)
        client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
        now = time.time()

        # Alte Einträge (älter als 60s) aufräumen
        cutoff = now - 60
        self.request_log[client_ip] = [ts for ts in self.request_log[client_ip] if ts > cutoff]

        # Limit prüfen
        if len(self.request_log[client_ip]) >= self.requests_per_minute:
            return Response(
                content={"detail": "Rate limit exceeded"},
                status_code=429,
                media_type="application/json",
            )

        # Anfrage zählen
        self.request_log[client_ip].append(now)

        response = await call_next(request)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Fügt Sicherheitsheader zu allen Responses hinzu."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Clickjacking-Schutz
        response.headers["X-Frame-Options"] = "DENY"

        # MIME-Sniffing verhindern
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS-Schutz (moderner Browser-Header)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy (ehemals Feature-Policy)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # CSP (Content Security Policy) — streng, aber nicht zu streng für APIs
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self'; "
            "frame-ancestors 'none';"
        )

        # HSTS für HTTPS (wird in Produktion relevant)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Blockiert Cross-Domain-Policy-Misbrauch
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Verhindert Browser-Caching sensativer Daten
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Begrenzt die Größe eingehender Requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_BODY_SIZE:
            return Response(
                content={"detail": f"Request body exceeds maximum size of {MAX_BODY_SIZE} bytes"},
                status_code=413,
                media_type="application/json",
            )
        return await call_next(request)


class ErrorSanitizationMiddleware(BaseHTTPMiddleware):
    """Sanitiert Error-Responses um interne Details nicht preiszugeben."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Nur 5xx Errors (Server Errors) sanitieren
        # 4xx sind Nutzer-Fehler und dürfen Details enthalten
        if 500 <= response.status_code < 600:
            try:
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk

                # Versuchen, den Body zu parsen
                try:
                    data = json.loads(body)
                    # Nur "detail" mit generic message behalten, Details löschen
                    sanitized = {"detail": "An internal error occurred"}
                    logger.error(
                        f"Internal error on {request.method} {request.url.path}: {data.get('detail', 'unknown')}"
                    )
                    response.body_iterator = self._iterate_body(
                        json.dumps(sanitized).encode()
                    )
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Nicht-JSON Response: ebenfalls sanitieren
                    sanitized = {"detail": "An internal error occurred"}
                    response.body_iterator = self._iterate_body(
                        json.dumps(sanitized).encode()
                    )
            except Exception:
                pass

        return response

    @staticmethod
    async def _iterate_body(body: bytes):
        yield body
