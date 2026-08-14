"""Typed contracts for the website audit -> Gemini -> SiteOS pipeline."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field, confloat

AuditCategory = Literal[
    "privacy_dsgvo", "ttdsg_consent", "legal_notices",
    "accessibility_wcag", "security_headers", "performance", "seo",
    "third_party_leak", "ai_act_readiness",
]
Severity = Literal["critical", "warning", "recommendation"]

class EvidenceTrace(BaseModel):
    initiator_url: Optional[str] = None
    resource_url: Optional[str] = None
    dom_selector: Optional[str] = None
    cookies_set: List[str] = Field(default_factory=list)
    timestamp: str
    detail: Optional[str] = None

class EvidenceFinding(BaseModel):
    finding_id: str
    category: AuditCategory
    severity: Severity
    title: str
    description: str
    evidence: EvidenceTrace
    remediation_hint: str
    confidence: confloat(ge=0, le=1)

class EvidenceSnapshot(BaseModel):
    domain: str
    final_url: str
    captured_at: str
    evidence_hash: str
    title: str = ""
    meta_description: str = ""
    legal_pages: Dict[str, bool] = Field(default_factory=dict)
    technologies: List[str] = Field(default_factory=list)
    third_party_requests: List[Dict[str, str]] = Field(default_factory=list)
    cookies: List[Dict[str, str]] = Field(default_factory=list)
    consent: Dict[str, object] = Field(default_factory=dict)
    accessibility: Dict[str, object] = Field(default_factory=dict)
    content: Dict[str, object] = Field(default_factory=dict)
    deterministic_findings: List[EvidenceFinding] = Field(default_factory=list)

class AuditResult(BaseModel):
    score: int = Field(ge=0, le=100)
    critical_findings: List[EvidenceFinding] = Field(default_factory=list)
    warnings: List[EvidenceFinding] = Field(default_factory=list)
    recommendations: List[EvidenceFinding] = Field(default_factory=list)
    evidence_hash: str
    summary: str
    remediation_plan: List[str] = Field(default_factory=list)

SectionType = Literal[
    "problem_grid", "trust_badges", "solution_feature",
    "compliance_comparison", "faq", "cta_banner",
]

class CTA(BaseModel):
    label: str
    action: str

class PageSection(BaseModel):
    id: str
    type: SectionType
    title: str
    subtitle: Optional[str] = None
    items: List[Dict[str, object]] = Field(default_factory=list)

class DesignTokens(BaseModel):
    theme: Literal["light", "dark", "system"] = "light"
    density: Literal["compact", "comfortable", "spacious"] = "comfortable"
    accent_color: str = "#4C82FF"

class VisualAsset(BaseModel):
    mime_type: str
    data_base64: str
    model: str

class PageSpec(BaseModel):
    """AI Studio output consumed by the deterministic SiteOS renderer."""
    schema_version: int = Field(default=1, ge=1)
    variant: Literal["executive", "modern", "authority", "minimal"]
    source_domain: str = ""
    evidence_hash: str = ""
    backend_preservation: Literal["preserve_all"] = "preserve_all"
    hero: Dict[str, object]
    sections: List[PageSection]
    design_tokens: DesignTokens
    asset_prompts: List[Dict[str, str]] = Field(default_factory=list)
    visual_asset: Optional[VisualAsset] = Field(default=None, json_schema_extra={"exclude_from_generation": True})
    ai_disclosure_required: bool = True
