"""Typed contracts for the website audit -> Gemini -> SiteOS pipeline."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field, HttpUrl, confloat


AuditCategory = Literal[
    "privacy_dsgvo",
    "ttdsg_consent",
    "legal_notices",
    "accessibility_wcag",
    "third_party_leak",
    "ai_act_readiness",
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
    "compliance_comparison", "faq", "cta_banner"
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
    accent_color: str = "#4f46e5"


class PageSpec(BaseModel):
    variant: Literal["executive", "modern", "authority", "minimal"]
    hero: Dict[str, object]
    sections: List[PageSection]
    design_tokens: DesignTokens
