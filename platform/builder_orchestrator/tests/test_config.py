"""Tests für Environment-Konfiguration und Validierung."""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.config import ConfigError, validate_environment


def test_database_url_valid():
    """Gültige PostgreSQL-URL wird akzeptiert."""
    with patch.dict(os.environ, {"DATABASE_URL": "postgresql://user:pass@localhost/db"}):
        config = validate_environment()
        assert config["DATABASE_URL"] == "postgresql://user:pass@localhost/db"


def test_database_url_alternate_schema():
    """postgres:// Schema wird auch akzeptiert."""
    with patch.dict(os.environ, {"DATABASE_URL": "postgres://localhost/db"}):
        config = validate_environment()
        assert config["DATABASE_URL"] == "postgres://localhost/db"


def test_database_url_invalid_schema():
    """Ungültiges Database-Schema wird abgelehnt."""
    with patch.dict(os.environ, {"DATABASE_URL": "mysql://localhost/db"}):
        with pytest.raises(ConfigError, match="ungültiges Schema"):
            validate_environment()


def test_database_url_optional():
    """Database-URL ist optional (In-Memory-Mode)."""
    with patch.dict(os.environ, {"DATABASE_URL": ""}, clear=False):
        config = validate_environment()
        assert config["DATABASE_URL"] == ""


def test_governance_backend_url_required():
    """GOVERNANCE_BACKEND_URL ist erforderlich."""
    with patch.dict(os.environ, {"GOVERNANCE_BACKEND_URL": ""}, clear=False):
        with pytest.raises(ConfigError, match="erforderlich"):
            validate_environment()


def test_governance_backend_url_valid():
    """Gültige Governance-Backend-URL wird akzeptiert."""
    with patch.dict(os.environ, {"GOVERNANCE_BACKEND_URL": "http://governance:8000"}):
        config = validate_environment()
        assert config["GOVERNANCE_BACKEND_URL"] == "http://governance:8000"


def test_max_body_size_valid():
    """Gültige MAX_BODY_SIZE wird akzeptiert."""
    with patch.dict(os.environ, {"MAX_BODY_SIZE": "5242880"}):  # 5 MB
        config = validate_environment()
        assert config["MAX_BODY_SIZE"] == "5242880"


def test_max_body_size_invalid():
    """Ungültige MAX_BODY_SIZE wird abgelehnt."""
    with patch.dict(os.environ, {"MAX_BODY_SIZE": "not_a_number"}):
        with pytest.raises(ConfigError, match="ungültig"):
            validate_environment()


def test_max_body_size_default():
    """MAX_BODY_SIZE hat einen Default-Wert."""
    with patch.dict(os.environ, {"MAX_BODY_SIZE": ""}, clear=False):
        config = validate_environment()
        assert config["MAX_BODY_SIZE"] == "10485760"  # 10 MB


def test_log_level_custom():
    """Custom LOG_LEVEL wird akzeptiert."""
    with patch.dict(os.environ, {"LOG_LEVEL": "DEBUG"}):
        config = validate_environment()
        assert config["LOG_LEVEL"] == "DEBUG"


def test_log_level_default():
    """LOG_LEVEL hat einen Default-Wert."""
    with patch.dict(os.environ, {"LOG_LEVEL": ""}, clear=False):
        config = validate_environment()
        assert config["LOG_LEVEL"] == "INFO"


def test_cors_origins_wildcard_warning():
    """CORS_ORIGINS '*' wird akzeptiert aber gewarnt."""
    with patch.dict(os.environ, {"CORS_ORIGINS": "*"}):
        config = validate_environment()
        assert config["CORS_ORIGINS"] == "*"


def test_cors_origins_restricted():
    """Restriktive CORS_ORIGINS werden akzeptiert."""
    with patch.dict(os.environ, {"CORS_ORIGINS": "https://example.com"}):
        config = validate_environment()
        assert config["CORS_ORIGINS"] == "https://example.com"


def test_auth_tokens_optional():
    """BUILDER_AUTH_TOKENS ist optional."""
    with patch.dict(os.environ, {"BUILDER_AUTH_TOKENS": ""}, clear=False):
        config = validate_environment()
        assert config["BUILDER_AUTH_TOKENS"] == ""


def test_auth_tokens_multiple():
    """Mehrere BUILDER_AUTH_TOKENS werden akzeptiert."""
    tokens = "token1:uuid1,token2:uuid2"
    with patch.dict(os.environ, {"BUILDER_AUTH_TOKENS": tokens}):
        config = validate_environment()
        assert config["BUILDER_AUTH_TOKENS"] == tokens


def test_service_token_optional():
    """BUILDER_SERVICE_TOKEN ist optional."""
    with patch.dict(os.environ, {"BUILDER_SERVICE_TOKEN": ""}, clear=False):
        config = validate_environment()
        assert config["BUILDER_SERVICE_TOKEN"] == ""


def test_full_production_config():
    """Vollständige Production-Konfiguration wird validiert."""
    env_vars = {
        "DATABASE_URL": "postgresql://user:pass@db.example.com/governance",
        "BUILDER_AUTH_TOKENS": "prod_token:tenant-uuid",
        "BUILDER_SERVICE_TOKEN": "service_secret",
        "GOVERNANCE_BACKEND_URL": "https://governance.example.com",
        "MAX_BODY_SIZE": "52428800",  # 50 MB
        "LOG_LEVEL": "WARNING",
        "CORS_ORIGINS": "https://app.example.com",
    }
    with patch.dict(os.environ, env_vars):
        config = validate_environment()
        for key, value in env_vars.items():
            assert config[key] == value
