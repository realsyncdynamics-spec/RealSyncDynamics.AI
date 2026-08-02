"""Security middlewares für den Orchestrator.

Rate Limiting: Einfacher In-Memory-Approach, der pro IP zählt.
Security Headers: Standard-Sicherheitsheader für alle Responses.
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


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

        return response
