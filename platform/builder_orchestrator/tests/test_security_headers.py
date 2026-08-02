"""Tests der Security Middlewares."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware


@pytest.fixture
def app_with_security():
    """Minimale FastAPI-App mit Security Middlewares."""
    app = FastAPI()

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, requests_per_minute=5)

    @app.get("/api/test")
    async def test_endpoint():
        return {"status": "ok"}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


def test_security_headers_present(app_with_security):
    """Sicherheitsheader sind in den Responses vorhanden."""
    client = TestClient(app_with_security)
    response = client.get("/api/test")

    assert response.status_code == 200
    assert "X-Frame-Options" in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "X-Content-Type-Options" in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "X-XSS-Protection" in response.headers
    assert "Referrer-Policy" in response.headers
    assert "Content-Security-Policy" in response.headers


def test_rate_limit_applied(app_with_security):
    """Rate Limiting blockiert nach zu vielen Anfragen."""
    client = TestClient(app_with_security)

    # 5 Anfragen sollten durchgehen (limits auf 5 pro min)
    for i in range(5):
        response = client.get("/api/test")
        assert response.status_code == 200, f"Request {i+1} sollte 200 sein"

    # 6. Anfrage sollte 429 (Too Many Requests) bekommen
    response = client.get("/api/test")
    assert response.status_code == 429


def test_health_not_rate_limited(app_with_security):
    """Healthcheck wird nicht rate-limitiert."""
    client = TestClient(app_with_security)

    # Beliebig viele /health Requests sollten durchgehen
    for i in range(20):
        response = client.get("/health")
        assert response.status_code == 200, f"Health request {i+1} sollte nicht rate-limitiert sein"


def test_rate_limit_per_ip(app_with_security):
    """Rate Limit ist pro IP-Adresse, nicht global."""
    client1 = TestClient(app_with_security)
    client2 = TestClient(app_with_security, headers={"X-Forwarded-For": "192.168.1.100"})

    # Beide Clients können das Limit unabhängig ausschöpfen
    for _ in range(5):
        assert client1.get("/api/test").status_code == 200
        assert client2.get("/api/test").status_code == 200

    # Beide sollten jetzt limitiert sein
    assert client1.get("/api/test").status_code == 429
    assert client2.get("/api/test").status_code == 429


def test_csp_header_strict(app_with_security):
    """Content Security Policy ist hinreichend restriktiv."""
    client = TestClient(app_with_security)
    response = client.get("/api/test")

    csp = response.headers["Content-Security-Policy"]
    # Sollte default-src 'none' enthalten (alles default blockiert)
    assert "default-src 'none'" in csp
    # Sollte script-src auf 'self' begrenzen
    assert "script-src 'self'" in csp
    # Sollte frame-ancestors 'none' enthalten (Clickjacking-Schutz)
    assert "frame-ancestors 'none'" in csp
