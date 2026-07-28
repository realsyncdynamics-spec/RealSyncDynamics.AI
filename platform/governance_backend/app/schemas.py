"""Pydantic-v2-Schemas des Governance-Backends.

Single Source of Truth für den öffentlichen API-Vertrag:
Der Builder-Orchestrator (``builder_orchestrator/app/clients/rsd_client.py``)
und das Next.js-Frontend sprechen ausschließlich gegen diese Modelle.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# EU-AI-Act-Risikoklassen (Art. 5 / Art. 6 / Art. 50).
RiskTier = Literal["minimal", "limited", "high", "unacceptable"]

# Kanonische Namen der CI/CD-Gates. Jeder Gate-Name mappt im Gate-Engine
# (services/gate_engine.py) auf genau ein Feld aus GateCheckArtifacts.
GateName = Literal[
    "tests_passed",
    "audit_logging_active",
    "model_card_included",
    "transparency_notice_enabled",
    "pii_scan_passed",
]


class ProjectRegistration(BaseModel):
    """Registrierung eines neuen KI-Projekts im Governance-Inventar."""

    project_name: str
    description: str
    data_types: List[str]
    data_subjects: List[str]
    models: List[str]
    llm_provider: Optional[str] = None
    jurisdiction: Optional[str] = "eu"
    tags: Dict[str, str] = Field(default_factory=dict)


class ProjectRegistrationResponse(BaseModel):
    project_id: str
    risk_tier: RiskTier
    required_gates: List[str]


class GateCheckArtifacts(BaseModel):
    """Nachweise, die eine CI/CD-Pipeline pro Build mitliefert."""

    tests_passed: bool
    audit_logging_active: bool
    model_card_included: bool
    transparency_notice_enabled: bool
    pii_scan_passed: bool


class GateCheckRequest(BaseModel):
    project_id: str
    build_hash: str
    artifacts: GateCheckArtifacts


class GateCheckResponse(BaseModel):
    status: Literal["approved", "warning", "blocked"]
    reason: Optional[str] = None
    remediation: Optional[str] = None
    severity: Optional[Literal["low", "medium", "high"]] = None


class InventoryActivate(BaseModel):
    """Aktivierung: Projekt geht produktiv (Deployment gemeldet)."""

    project_id: str
    endpoint: str
    deployment_timestamp: str


class RuntimeTelemetry(BaseModel):
    """Laufzeit-Signal aus einer deployten App (Sentinel-Loop-Input)."""

    project_id: str
    event_type: str
    model_version: Optional[str] = None
    region: Optional[str] = None
    details: Dict[str, str] = Field(default_factory=dict)


# --- Read-Modelle (Cockpit / Frontend) -------------------------------------


class ProjectRecord(BaseModel):
    """Projektzeile, wie sie das Governance-Cockpit anzeigt."""

    project_id: str
    project_name: str
    description: str
    risk_tier: RiskTier
    required_gates: List[str]
    status: Literal["registered", "active", "retired"] = "registered"
    endpoint: Optional[str] = None
    deployment_timestamp: Optional[str] = None
    jurisdiction: Optional[str] = "eu"
    last_gate_status: Optional[Literal["approved", "warning", "blocked"]] = None


class ProjectListResponse(BaseModel):
    projects: List[ProjectRecord]
