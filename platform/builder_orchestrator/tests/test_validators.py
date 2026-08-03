"""Tests für Input-Validierung der API-Schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import BuildSpec, CancelRequest
from app.validators import (
    Description,
    Jurisdiction,
    ProjectId,
    ProjectName,
    Prompt,
    TargetStack,
    validate_no_shell_metacharacters,
)


class TestProjectId:
    """ProjectId: alphanumerisch, Unterstriche, Bindestriche, max 64 Zeichen."""

    def test_valid_project_id(self):
        """Gültige Project-IDs werden akzeptiert."""
        assert ProjectId.validate("my-project") == "my-project"
        assert ProjectId.validate("project_123") == "project_123"
        assert ProjectId.validate("A") == "A"

    def test_project_id_too_long(self):
        """Project-ID über 64 Zeichen wird abgelehnt."""
        long_id = "a" * 65
        with pytest.raises(ValidationError):
            ProjectId.validate(long_id)

    def test_project_id_empty(self):
        """Leere Project-ID wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectId.validate("")

    def test_project_id_invalid_characters(self):
        """Ungültige Zeichen in Project-ID werden abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectId.validate("project@123")
        with pytest.raises(ValidationError):
            ProjectId.validate("project 123")
        with pytest.raises(ValidationError):
            ProjectId.validate("project.yaml")


class TestProjectName:
    """ProjectName: Unicode, max 256 Zeichen."""

    def test_valid_project_names(self):
        """Gültige Projektnamen werden akzeptiert."""
        assert ProjectName.validate("My App") == "My App"
        assert ProjectName.validate("ÄÖÜ Test") == "ÄÖÜ Test"
        assert ProjectName.validate("Projekt 2024") == "Projekt 2024"

    def test_project_name_too_long(self):
        """Projektname über 256 Zeichen wird abgelehnt."""
        long_name = "A" * 257
        with pytest.raises(ValidationError):
            ProjectName.validate(long_name)

    def test_project_name_empty(self):
        """Leerer Projektname wird abgelehnt."""
        with pytest.raises(ValidationError):
            ProjectName.validate("")


class TestDescription:
    """Description: max 4000 Zeichen."""

    def test_valid_description(self):
        """Gültige Beschreibungen werden akzeptiert."""
        assert Description.validate("A simple description") == "A simple description"
        assert Description.validate("") == ""
        long_desc = "A" * 4000
        assert Description.validate(long_desc) == long_desc

    def test_description_too_long(self):
        """Beschreibung über 4000 Zeichen wird abgelehnt."""
        long_desc = "A" * 4001
        with pytest.raises(ValidationError):
            Description.validate(long_desc)


class TestPrompt:
    """Prompt: 1-8000 Zeichen für LLM-Prompts."""

    def test_valid_prompt(self):
        """Gültige Prompts werden akzeptiert."""
        assert Prompt.validate("Generate a summary") == "Generate a summary"
        long_prompt = "A" * 8000
        assert Prompt.validate(long_prompt) == long_prompt

    def test_prompt_too_short(self):
        """Leerer Prompt wird abgelehnt."""
        with pytest.raises(ValidationError):
            Prompt.validate("")

    def test_prompt_too_long(self):
        """Prompt über 8000 Zeichen wird abgelehnt."""
        long_prompt = "A" * 8001
        with pytest.raises(ValidationError):
            Prompt.validate(long_prompt)


class TestTargetStack:
    """TargetStack: vordefinierte Werte."""

    def test_valid_stacks(self):
        """Gültige Stacks werden akzeptiert."""
        assert TargetStack.validate("nextjs_supabase") == "nextjs_supabase"
        assert TargetStack.validate("fastapi_postgres") == "fastapi_postgres"
        assert TargetStack.validate("remix_supabase") == "remix_supabase"

    def test_invalid_stack(self):
        """Ungültiger Stack wird abgelehnt."""
        with pytest.raises(ValidationError):
            TargetStack.validate("invalid_stack")
        with pytest.raises(ValidationError):
            TargetStack.validate("django_postgres")


class TestJurisdiction:
    """Jurisdiction: ISO 3166-1 alpha-2 oder 'eu'."""

    def test_valid_jurisdictions(self):
        """Gültige Jurisdictions werden akzeptiert."""
        assert Jurisdiction.validate("eu") == "eu"
        assert Jurisdiction.validate("de") == "de"
        assert Jurisdiction.validate("fr") == "fr"
        assert Jurisdiction.validate("us") == "us"

    def test_jurisdiction_invalid(self):
        """Ungültige Jurisdictions werden abgelehnt."""
        with pytest.raises(ValidationError):
            Jurisdiction.validate("DE")  # Großbuchstaben
        with pytest.raises(ValidationError):
            Jurisdiction.validate("DEU")  # 3-Letter Code
        with pytest.raises(ValidationError):
            Jurisdiction.validate("invalid")


class TestShellMetacharacters:
    """Shell-Injection-Prävention."""

    def test_valid_no_metacharacters(self):
        """Strings ohne Shell-Metacharakter werden akzeptiert."""
        assert validate_no_shell_metacharacters("simple-value") == "simple-value"
        assert validate_no_shell_metacharacters("value_123") == "value_123"
        assert validate_no_shell_metacharacters("file.txt") == "file.txt"

    def test_reject_shell_injection(self):
        """Shell-Metacharakter werden abgelehnt."""
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value$(whoami)")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value`id`")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value|grep")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value > output")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value & bg")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value;rm")
        with pytest.raises(ValueError):
            validate_no_shell_metacharacters("value'escaped'")


class TestBuildSpecValidation:
    """Integration: BuildSpec verwendet die Validator-Typen."""

    def test_buildspec_valid(self):
        """Gültige BuildSpec wird akzeptiert."""
        spec = BuildSpec(
            project_name="My App",
            description="Test app",
            prompt="Build an app",
            target_stack="nextjs_supabase",
            jurisdiction="eu",
        )
        assert spec.project_name == "My App"
        assert spec.target_stack == "nextjs_supabase"

    def test_buildspec_invalid_project_name(self):
        """BuildSpec mit ungültigem Projektnamen wird abgelehnt."""
        with pytest.raises(ValidationError):
            BuildSpec(
                project_name="",  # Leerer Name
                description="Test",
                prompt="Build",
                target_stack="nextjs_supabase",
            )

    def test_buildspec_invalid_description_length(self):
        """BuildSpec mit zu langer Beschreibung wird abgelehnt."""
        with pytest.raises(ValidationError):
            BuildSpec(
                project_name="App",
                description="A" * 4001,  # Zu lang
                prompt="Build",
                target_stack="nextjs_supabase",
            )

    def test_buildspec_invalid_target_stack(self):
        """BuildSpec mit ungültigem Stack wird abgelehnt."""
        with pytest.raises(ValidationError):
            BuildSpec(
                project_name="App",
                description="Test",
                prompt="Build",
                target_stack="invalid_stack",
            )

    def test_buildspec_invalid_jurisdiction(self):
        """BuildSpec mit ungültiger Jurisdiction wird abgelehnt."""
        with pytest.raises(ValidationError):
            BuildSpec(
                project_name="App",
                description="Test",
                prompt="Build",
                jurisdiction="invalid",
            )


class TestCancelRequestValidation:
    """Integration: CancelRequest validiert project_id."""

    def test_cancelrequest_valid(self):
        """Gültige CancelRequest wird akzeptiert."""
        req = CancelRequest(project_id="my-project-123")
        assert req.project_id == "my-project-123"

    def test_cancelrequest_invalid_project_id(self):
        """CancelRequest mit ungültiger project_id wird abgelehnt."""
        with pytest.raises(ValidationError):
            CancelRequest(project_id="project@invalid")
        with pytest.raises(ValidationError):
            CancelRequest(project_id="")
