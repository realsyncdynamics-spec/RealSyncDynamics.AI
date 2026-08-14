"""Audit pipeline: Playwright evidence -> deterministic findings -> Gemini."""

from __future__ import annotations

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

PAGESPEC_SYSTEM = """You are the RealSyncDynamicsAI SiteOS Page Specification generator.
Generate a production-oriented PageSpec JSON for a website modernization.
Use the supplied company context and audit evidence. Never invent regulatory
certifications, customer logos, statistics, legal claims, or guarantees. The
output is a component AST consumed by SiteOS; do not output HTML or CSS."""


async def run_audit(url: str, project_id: str = "") -> tuple[EvidenceSnapshot, AuditResult]:
    snapshot = await collect(url)
    deterministic = snapshot.deterministic_findings
    prompt = json.dumps(snapshot.model_dump(), ensure_ascii=False, separators=(",", ":"))
    result, _ = await llm.complete_json(
        system=AUDIT_SYSTEM,
        user=(
            "Evidence snapshot:\n" + prompt +
            "\n\nClassify the findings, calculate a 0-100 risk/readiness score, "
            "write a concise summary and remediation plan. Preserve evidence_hash: " + snapshot.evidence_hash
        ),
        model_cls=AuditResult,
        effort="high",
        provider=llm.get_provider(),
        project_id=project_id,
    )
    # Gemini must not be able to silently detach findings from their evidence.
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
) -> list[PageSpec]:
    variants = ["executive", "modern", "authority", "minimal"]
    specs: list[PageSpec] = []
    evidence = json.dumps(snapshot.model_dump(), ensure_ascii=False, separators=(",", ":"))
    findings = json.dumps(audit.model_dump(), ensure_ascii=False, separators=(",", ":"))
    for variant in variants:
        result, _ = await llm.complete_json(
            system=PAGESPEC_SYSTEM,
            user=(
                f"Generate variant '{variant}'.\nCompany context:\n{company_context[:6000]}\n"
                f"Audit:\n{findings}\nEvidence:\n{evidence[:10000]}\n"
                "The generated page must address the remediation opportunities without making legal guarantees. "
                f"Set variant exactly to '{variant}'."
            ),
            model_cls=PageSpec,
            effort="high",
            provider=llm.get_provider(),
            project_id=project_id,
        )
        result.variant = variant
        specs.append(result)
    return specs
