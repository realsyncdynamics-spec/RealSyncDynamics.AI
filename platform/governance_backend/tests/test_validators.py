"""Tests für Input-Validierung der Governance-API-Schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import (
    GateCheckArtifacts,
    GateCheckRequest,
    InventoryActivate,
    ProjectRegistration,
    ProjectRegistrationResponse,
    RuntimeTelemetry,
)
from app.validators import Description, Jurisdiction, ProjectId, ProjectName


class TestProjectRegistrationValidation:
    """ProjectRegistration validiert Namen, Beschreibung, Jurisdiction."""

    def test_valid_registration(self):
        """Gültige Registrierung wird akzeptiert."""
        reg = ProjectRegistration(
            project_name="AI Model v1",
            description="A machine learning model for classification",
            data_types=["text", "numbers"],
            data_subjects=["users", "customers"],
            models=["gpt-4", "claude-3"],
            jurisdiction="eu",
        )
        assert reg.project_name == "AI Model v1"
        assert reg.jurisdiction == "eu"

    def test_registration_empty_project_name(self):
        """Registrierung mit leerem Namen wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectRegistration(
                project_name="",
                description="Test",
                data_types=["text"],
                data_subjects=["users"],
                models=["gpt-4"],
            )

    def test_registration_too_long_description(self):
        """Registrierung mit zu langer Beschreibung wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectRegistration(
                project_name="App",
                description="A" * 4001,
                data_types=["text"],
                data_subjects=["users"],
                models=["gpt-4"],
            )

    def test_registration_invalid_jurisdiction(self):
        """Registrierung mit ungültiger Jurisdiction wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectRegistration(
                project_name="App",
                description="Test",
                data_types=["text"],
                data_subjects=["users"],
                models=["gpt-4"],
                jurisdiction="invalid",
            )

    def test_registration_defaults(self):
        """Jurisdiction defaultiert auf 'eu'."""
        reg = ProjectRegistration(
            project_name="App",
            description="Test",
            data_types=["text"],
            data_subjects=["users"],
            models=["gpt-4"],
        )
        assert reg.jurisdiction == "eu"


class TestProjectRegistrationResponseValidation:
    """ProjectRegistrationResponse validiert project_id."""

    def test_valid_response(self):
        """Gültige Response wird akzeptiert."""
        resp = ProjectRegistrationResponse(
            project_id="proj-123",
            risk_tier="limited",
            required_gates=["tests_passed", "audit_logging_active"],
        )
        assert resp.project_id == "proj-123"

    def test_response_invalid_project_id(self):
        """Response mit ungültiger project_id wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectRegistrationResponse(
                project_id="proj@invalid",
                risk_tier="limited",
                required_gates=[],
            )


class TestGateCheckRequestValidation:
    """GateCheckRequest validiert project_id."""

    def test_valid_gate_check(self):
        """Gültige GateCheckRequest wird akzeptiert."""
        artifacts = GateCheckArtifacts(
            tests_passed=True,
            audit_logging_active=True,
            model_card_included=True,
            transparency_notice_enabled=True,
            pii_scan_passed=True,
        )
        req = GateCheckRequest(
            project_id="my-project",
            build_hash="abc123def456",
            artifacts=artifacts,
        )
        assert req.project_id == "my-project"

    def test_gate_check_invalid_project_id(self):
        """GateCheckRequest mit ungültiger project_id wird abgelehnt."""
        artifacts = GateCheckArtifacts(
            tests_passed=True,
            audit_logging_active=True,
            model_card_included=True,
            transparency_notice_enabled=True,
            pii_scan_passed=True,
        )
        with pytest.raises(ValidationError):
            GateCheckRequest(
                project_id="project$invalid",
                build_hash="abc123",
                artifacts=artifacts,
            )


class TestInventoryActivateValidation:
    """InventoryActivate validiert project_id."""

    def test_valid_inventory_activate(self):
        """Gültige InventoryActivate wird akzeptiert."""
        req = InventoryActivate(
            project_id="my-app",
            endpoint="https://api.example.com",
            deployment_timestamp="2024-01-15T10:30:00Z",
        )
        assert req.project_id == "my-app"

    def test_inventory_activate_invalid_project_id(self):
        """InventoryActivate mit ungültiger project_id wird abgelehnt."""
        with pytest.raises(ValidationError):
            InventoryActivate(
                project_id="app;rm",
                endpoint="https://api.example.com",
                deployment_timestamp="2024-01-15T10:30:00Z",
            )


class TestRuntimeTelemetryValidation:
    """RuntimeTelemetry validiert project_id."""

    def test_valid_telemetry(self):
        """Gültige RuntimeTelemetry wird akzeptiert."""
        telemetry = RuntimeTelemetry(
            project_id="production-app",
            event_type="inference_completed",
            model_version="v1.2.3",
            region="eu-west-1",
        )
        assert telemetry.project_id == "production-app"

    def test_telemetry_invalid_project_id(self):
        """RuntimeTelemetry mit ungültiger project_id wird abgelehnt."""
        with pytest.raises(ValidationError):
            RuntimeTelemetry(
                project_id="app`whoami`",
                event_type="inference_completed",
            )

    def test_telemetry_minimal(self):
        """Minimale RuntimeTelemetry wird akzeptiert."""
        telemetry = RuntimeTelemetry(
            project_id="app-123",
            event_type="error",
        )
        assert telemetry.project_id == "app-123"
        assert telemetry.model_version is None
        assert telemetry.region is None
