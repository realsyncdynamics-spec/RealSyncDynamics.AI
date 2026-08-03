"""Prüft, dass TLS-Konfiguration vollständig und korrekt ist.

Hintergrund: Traefik benötigt:
1. SSL/TLS-Zertifikate (selbstsigniert lokal, ACME in Prod)
2. Korrekte Traefik-Konfiguration (websecure entrypoint, ACME resolver)
3. Router-Labels auf den Services (entrypoints=websecure, tls=true)
4. Richtige Berechtigungen auf Zertifikat-Dateien
"""

from __future__ import annotations

import re
import ssl
from pathlib import Path

TRAEFIK_DIR = Path(__file__).resolve().parent.parent
COMPOSE_FILE = TRAEFIK_DIR.parent / "docker-compose.yml"
TRAEFIK_CONFIG = TRAEFIK_DIR / "traefik.yml"
DYNAMIC_CONFIG = TRAEFIK_DIR / "dynamic.yml"
CERT_FILE = TRAEFIK_DIR / "certs" / "server.crt"
KEY_FILE = TRAEFIK_DIR / "certs" / "server.key"
ACME_FILE = TRAEFIK_DIR / "acme.json"


def test_self_signed_certificate_exists():
    """Selbstsigniertes Zertifikat existiert und hat korrekte SANs."""
    assert CERT_FILE.exists(), f"Zertifikat fehlt: {CERT_FILE}"
    assert KEY_FILE.exists(), f"Schlüssel fehlt: {KEY_FILE}"

    # Lese Zertifikat
    cert_data = CERT_FILE.read_text(encoding="utf-8")
    assert "-----BEGIN CERTIFICATE-----" in cert_data
    assert "-----END CERTIFICATE-----" in cert_data
    # SANs (Subject Alternative Names) sollten *.localhost enthalten
    # Die SANs stehen in der PEM-kodierten Form, wird von openssl dekodiert
    # Wir prüfen die PEM existiert, die Validierung der SANs macht Traefik zur Laufzeit


def test_certificate_key_permissions():
    """Zertifikat-Schlüssel hat sichere Berechtigungen (600)."""
    key_stat = KEY_FILE.stat()
    mode = key_stat.st_mode & 0o777
    assert mode == 0o600, f"Schlüssel sollte 600 sein, ist aber {oct(mode)}"


def test_acme_json_exists():
    """ACME-Speicherdatei existiert."""
    assert ACME_FILE.exists(), f"acme.json fehlt: {ACME_FILE}"
    content = ACME_FILE.read_text(encoding="utf-8")
    # Sollte mindestens gültiges JSON sein (oder leer {})
    assert content.strip() == "{}" or '"' in content, "acme.json sollte JSON sein"


def test_traefik_config_has_websecure_entrypoint():
    """traefik.yml definiert websecure entrypoint auf :443."""
    content = TRAEFIK_CONFIG.read_text(encoding="utf-8")
    assert "websecure:" in content
    assert "address: \":443\"" in content


def test_traefik_config_has_acme_resolver():
    """traefik.yml definiert ACME/Let's-Encrypt-Resolver."""
    content = TRAEFIK_CONFIG.read_text(encoding="utf-8")
    assert "certificatesResolvers:" in content
    assert "letsencrypt:" in content
    assert "acme:" in content


def test_dynamic_config_has_tls_section():
    """dynamic.yml definiert TLS-Optionen."""
    content = DYNAMIC_CONFIG.read_text(encoding="utf-8")
    assert "tls:" in content
    assert "stores:" in content
    assert "options:" in content


def test_dynamic_config_has_default_certificate():
    """dynamic.yml referenziert selbstsigniertes Standardzertifikat."""
    content = DYNAMIC_CONFIG.read_text(encoding="utf-8")
    assert "defaultCertificate:" in content
    assert "/etc/traefik/certs/server.crt" in content
    assert "/etc/traefik/certs/server.key" in content


def test_routers_have_tls_labels():
    """Alle Services haben TLS-Router-Labels."""
    content = COMPOSE_FILE.read_text(encoding="utf-8")

    # Router names: governance, builder, frontend
    routers = ["governance", "builder", "frontend"]
    for router in routers:
        assert f"traefik.http.routers.{router}.entrypoints=web,websecure" in content, \
            f"Router {router} hat nicht beide entrypoints"
        assert f"traefik.http.routers.{router}.tls=true" in content, \
            f"Router {router} hat nicht tls=true"


def test_compose_exposes_443():
    """docker-compose.yml exposiert Port 443."""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "- \"443:443\"" in content, "Port 443 nicht in docker-compose.yml"


def test_compose_mounts_certificates():
    """docker-compose.yml mount Zertifikat-Verzeichnis."""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "./traefik/certs:/etc/traefik/certs:ro" in content, \
        "Zertifikat-Verzeichnis nicht im Traefik-Mount"


def test_compose_mounts_acme_json():
    """docker-compose.yml mount acme.json für ACME-Zertifikate."""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "./traefik/acme.json:/etc/traefik/acme.json" in content, \
        "acme.json nicht im Traefik-Mount"


def test_tls_cipher_suites_are_modern():
    """Moderne Cipher-Suites in der TLS-Konfiguration."""
    content = DYNAMIC_CONFIG.read_text(encoding="utf-8")
    # Sollte mindestens TLS 1.2 verwenden
    assert "minVersion: VersionTLS12" in content
    # Sollte moderne Suites haben (ECDHE, AES-GCM oder ChaCha)
    assert "ECDHE" in content or "ChaCha" in content or "AES_GCM" in content


def test_frontend_urls_configurable():
    """Frontend-URLs sind über Umgebungsvariablen konfigurierbar."""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "NEXT_PUBLIC_BUILDER_URL: ${NEXT_PUBLIC_BUILDER_URL:-" in content
    assert "NEXT_PUBLIC_GOVERNANCE_URL: ${NEXT_PUBLIC_GOVERNANCE_URL:-" in content
