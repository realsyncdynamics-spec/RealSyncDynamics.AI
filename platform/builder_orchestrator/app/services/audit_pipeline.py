"""Audit pipeline: Playwright evidence -> deterministic findings -> Gemini -> SiteOS."""

from __future__ import annotations

import asyncio
import json

from . import llm
from .audit_contracts import AuditResult, EvidenceSnapshot, PageSpec
from .audit_crawler import collect

AUDIT_SYSTEM = """You are the RealSyncDynamicsAI website governance auditor.
Analyze ONLY the supplied evidence snapshot. Do not invent network requests,
cookies, legal documents, or technical facts. Deterministic findings are
observations and must be preserved unless the evidence directly contradicts
them. Use cautious compliance language: identify technical/documentary
indicators and remediation needs, not definitive legal judgments. Return only
the requested JSON schema."""

PAGESPEC_SYSTEM = """You are the RealSyncDynamicsAI SiteOS transformation engine.
You are the reasoning/design layer behind RealSync AI Studio. Transform the
supplied existing website evidence into a complete modern landingpage
specification. Preserve factual company information and use audit findings as
remediation context. Never invent certifications, customer logos, statistics,
legal guarantees, prices, testimonials, or regulatory conclusions.

Hard boundary: generate a frontend specification only. Never emit HTML/CSS,
backend code, database changes, API changes, credentials, authentication
changes, or instructions to mutate the customer's backend. Set
backend_preservation to preserve_all. The result is a component AST consumed
by SiteOS, not production source code. Include concise asset_prompts when a
hero visual would improve the design. Return only the requested JSON schema."""


async def run_audit(url: str, project_id: str = "") -> tuple[EvidenceSnapshot, AuditResult]:
    snapshot = await collect(url)
    deterministic = snapshot.deterministic_findings
    prompt = json.dumps(snapshot.model_dump(), ensure_ascii=False, separators=(",", ":"))
    result, _ = await llm.complete_json(
        system=AUDIT_SYSTEM,
        user=("Evidence snapshot:\n" + prompt
              + "\n\nClassify the findings, calculate a 0-100 risk/readiness score, "
                "write a concise summary and remediation plan. Preserve evidence_hash: "
                + snapshot.evidence_hash),
        model_cls=AuditResult,
        effort="high",
        provider=llm.get_provider(),
        project_id=project_id,
    )
    known = {f.finding_id: f for f in deterministic}
    merged = {f.finding_id: f for f in result.critical_findings + result.warnings + result.recommendations}
    for fid, finding in known.items():
        merged.setdefault(fid, finding)
    ordered = list(merged.values())
    result.critical_findings = [f for f in ordered if f.severity == "critical"]
    result.warnings = [f for f in ordered if f.severity == "warning"]
    result.recommendations = [f for f in ordered if f.severity == "recommendation"]
    result.evidence_hash = snapshot.evidence_hash
    return snapshot, result


async def generate_variants(
    *,
    company_context: str,
    snapshot: EvidenceSnapshot,
    audit: AuditResult,
    project_id: str = "",
    include_visuals: bool = False,
) -> list[PageSpec]:
    """Generate independent SiteOS AST variants in parallel.

    Visual asset prompts are part of the PageSpec. Actual image bytes are kept
    out of the structured-output contract and should be persisted by the
    future R2 asset layer; this prevents base64 payloads from polluting the
    model response and keeps preview generation fast.
    """
    variants = ["executive", "modern", "authority", "minimal"]
    evidence = json.dumps(snapshot.model_dump(), ensure_ascii=False, separators=(",", ":"))
    findings = json.dumps(audit.model_dump(), ensure_ascii=False, separators=(",", ":"))

    async def generate_one(variant: str) -> PageSpec:
        result, _ = await llm.complete_json(
            system=PAGESPEC_SYSTEM,
            user=(
                f"Generate variant '{variant}'.\nCompany context:\n{company_context[:6000]}\n"
                f"Audit:\n{findings}\nEvidence:\n{evidence[:12000]}\n"
                "Create a complete landingpage structure, not a single hero. "
                "Address remediation opportunities without making legal guarantees. "
                f"Set variant exactly to '{variant}', source_domain to '{snapshot.domain}', "
                f"evidence_hash to '{snapshot.evidence_hash}', and backend_preservation to 'preserve_all'."
            ),
            model_cls=PageSpec,
            effort="high",
            provider=llm.get_provider(),
            project_id=project_id,
        )
        result.variant = variant
        result.source_domain = snapshot.domain
        result.evidence_hash = snapshot.evidence_hash
        result.backend_preservation = "preserve_all"
        return result

    return await asyncio.gather(*(generate_one(v) for v in variants))
