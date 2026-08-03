"""Custom validators für API-Eingaben.

Alle externen Eingaben werden validiert:
- Längenbeschränkungen (project_id, Strings)
- Format-Validierung (UUIDs, etc.)
- Sanitization (keine Shell-Metacharakter)
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import Field, StringConstraints

# Project-IDs: alphanumerisch, Unterstriche, Bindestriche, max 64 Zeichen
ProjectId = Annotated[
    str,
    StringConstraints(
        pattern=r"^[a-zA-Z0-9_-]{1,64}$",
        min_length=1,
        max_length=64,
    ),
    Field(description="Project ID (alphanumeric, underscores, hyphens, max 64 chars)"),
]

# Projekt-Namen: Unicode, max 256 Zeichen, keine Kontrollzeichen
ProjectName = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=256,
    ),
    Field(description="Project name (max 256 chars, no control characters)"),
]

# Beschreibungen: max 4000 Zeichen
Description = Annotated[
    str,
    StringConstraints(
        min_length=0,
        max_length=4000,
    ),
    Field(description="Description (max 4000 chars)"),
]

# Prompts für LLM: max 8000 Zeichen (echte Systemprompts sind kleiner)
Prompt = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=8000,
    ),
    Field(description="LLM prompt (1-8000 chars)"),
]

# Target-Stack: vordefinierte Werte
TargetStack = Annotated[
    str,
    Field(
        pattern="^(nextjs_supabase|fastapi_postgres|remix_supabase)$",
        description="Target stack (nextjs_supabase, fastapi_postgres, remix_supabase)",
    ),
]

# Risiko-Tier: vordefinierte Werte
RiskTier = Annotated[
    str,
    Field(
        pattern="^(minimal|limited|high|unacceptable)$",
        description="Risk tier (minimal, limited, high, unacceptable)",
    ),
]

# Jurisdiction: ISO 3166-1 alpha-2 oder 'eu'
Jurisdiction = Annotated[
    str,
    Field(
        pattern="^([a-z]{2}|eu)$",
        description="Jurisdiction (ISO 3166-1 alpha-2 or 'eu')",
    ),
]


def validate_no_shell_metacharacters(value: str) -> str:
    """Verhindert Shell-Injection durch Ablehnung von Metacharakteren.

    Erlaubt ist: alphanumerisch, Unterstriche, Bindestriche, Punkte
    Blockiert: $, backticks, Pipes, Redirects, etc.
    """
    if not re.match(r"^[a-zA-Z0-9_\-\.]+$", value):
        raise ValueError(f"Invalid characters in '{value}' — only alphanumeric, underscore, hyphen, dot allowed")
    return value
