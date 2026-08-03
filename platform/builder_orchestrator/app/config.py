"""Environment validation and configuration.

Prüft kritische Sicherheits-Einstellungen beim Start und schlägt fehl wenn
erforderliche Konfiguration fehlt. Das verhindert, dass ein falsch
konfigurierter Service unbemerkt in Produktion läuft.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("builder.config")


class ConfigError(Exception):
    """Kritischer Konfigurationsfehler."""


def validate_environment() -> dict[str, str]:
    """Validiert Umgebungsvariablen und gibt validierte Config zurück.

    Wirft ConfigError bei kritischen Fehlern.
    Warnt bei empfohlenen aber nicht erforderlichen Settings.
    """
    config: dict[str, str] = {}

    # Kritisch: Database-URL für Persistenz
    database_url = os.getenv("DATABASE_URL", "")
    config["DATABASE_URL"] = database_url
    if database_url:
        if not database_url.startswith(("postgresql://", "postgres://")):
            raise ConfigError(
                f"DATABASE_URL hat ungültiges Schema: {database_url[:30]}... "
                "(erwartet postgresql:// oder postgres://)"
            )
        logger.info("✓ DATABASE_URL gesetzt — Persistenz aktiviert")
    else:
        logger.warning("⚠ DATABASE_URL nicht gesetzt — läuft im In-Memory-Modus (Daten gehen bei Neustart verloren)")

    # Empfohlen: Auth-Token-Konfiguration
    builder_auth_tokens = os.getenv("BUILDER_AUTH_TOKENS", "")
    config["BUILDER_AUTH_TOKENS"] = builder_auth_tokens
    if builder_auth_tokens:
        logger.info(f"✓ BUILDER_AUTH_TOKENS gesetzt ({builder_auth_tokens.count(',') + 1} Token)")
    else:
        logger.warning("⚠ BUILDER_AUTH_TOKENS nicht gesetzt — API ist offen zugänglich")

    # Kritisch für Service-to-Service: Service-Token
    builder_service_token = os.getenv("BUILDER_SERVICE_TOKEN", "")
    config["BUILDER_SERVICE_TOKEN"] = builder_service_token
    if builder_service_token:
        logger.info("✓ BUILDER_SERVICE_TOKEN gesetzt")
    else:
        logger.warning("⚠ BUILDER_SERVICE_TOKEN nicht gesetzt — Service-to-Service-Aufrufe blockiert")

    # Governance-Backend-URL für Registry
    governance_url = os.getenv("GOVERNANCE_BACKEND_URL", "http://governance:8000")
    config["GOVERNANCE_BACKEND_URL"] = governance_url
    if not governance_url:
        raise ConfigError("GOVERNANCE_BACKEND_URL ist erforderlich")
    logger.info(f"✓ GOVERNANCE_BACKEND_URL: {governance_url}")

    # Empfohlen: Request-Size-Limit
    max_body_size = os.getenv("MAX_BODY_SIZE", "10485760")
    try:
        size_bytes = int(max_body_size)
        config["MAX_BODY_SIZE"] = max_body_size
        logger.info(f"✓ MAX_BODY_SIZE: {size_bytes / 1024 / 1024:.1f} MB")
    except ValueError:
        raise ConfigError(f"MAX_BODY_SIZE ungültig: {max_body_size} (erwartet Zahl in Bytes)")

    # Empfohlen: Log-Level
    log_level = os.getenv("LOG_LEVEL", "INFO")
    config["LOG_LEVEL"] = log_level
    logger.info(f"✓ LOG_LEVEL: {log_level}")

    # CORS-Konfiguration
    cors_origins = os.getenv("CORS_ORIGINS", "*")
    config["CORS_ORIGINS"] = cors_origins
    if cors_origins == "*":
        logger.warning("⚠ CORS_ORIGINS ist '*' (alles erlaubt) — für Produktion restriktiver setzen")
    else:
        logger.info(f"✓ CORS_ORIGINS: {cors_origins}")

    return config


def get_config() -> dict[str, str]:
    """Gibt validierte Config zurück (wird beim App-Start aufgerufen)."""
    try:
        return validate_environment()
    except ConfigError as e:
        logger.error(f"❌ Konfigurationsfehler: {e}")
        raise
