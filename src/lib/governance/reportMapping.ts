/**
 * Pure-logic mapping: (ScanRun, Finding[]) → Report.
 *
 * No DB access, no async, no I/O. The DB-side helper that reads the
 * inputs lives in `supabase/functions/_shared/report.ts`; this file
 * carries the deterministic transform from records to a Report shape
 * the UI + PDF exporter both consume.
 *
 * Tested by `test/lib/governance/reportMapping.test.ts`.
 */

import type {
  Finding,
  FindingCategory,
  FindingSeverity,
  FindingStatus,
} from '../../types/governance/finding';
import { SEVERITY_RANK } from '../../types/governance/finding';
import type { ScanRun } from '../../types/governance/scan-run';
import type {
  ComplianceGrade,
  EvidenceCatalogEntry,
  Report,
  ReportFinding,
  ReportPayload,
} from '../../types/governance/report';
import { parseEvidenceRef, formatEvidenceRef } from '../../types/governance/evidence';

const ALL_SEVERITIES: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const ALL_STATUSES:   FindingStatus[]   = [
  'open', 'acknowledged', 'fixed', 'false_positive', 'ignored', 'resolved',
];

/**
 * Score 0..100. Weighted penalty per severity:
 *   critical  -20 / each (cap at 100 deductions)
 *   high      -10
 *   medium     -5
 *   low        -2
 *   info        0  (informational — does not reduce score)
 *
 * Findings in 'false_positive', 'ignored', 'resolved' don't count;
 * 'fixed' counts at 50% (until a re-scan confirms).
 *
 * Caps at 0 (cannot go negative). Open + acknowledged + fixed
 * findings reduce the score; everything else is treated as "not
 * currently a problem".
 */
export function computeComplianceScore(findings: Finding[]): number {
  const PENALTY: Record<FindingSeverity, number> = {
    critical: 20, high: 10, medium: 5, low: 2, info: 0,
  };
  let total = 100;
  for (const f of findings) {
    if (f.status === 'false_positive' || f.status === 'ignored' || f.status === 'resolved') continue;
    const base = PENALTY[f.severity] ?? 0;
    const scaled = f.status === 'fixed' ? base * 0.5 : base;
    total -= scaled;
  }
  return Math.max(0, Math.round(total));
}

/** Letter grade from score. Boundaries tuned for compliance reports:
 *  A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, F < 40. */
export function gradeFromScore(score: number): ComplianceGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function severityBreakdown(findings: Finding[]): Record<FindingSeverity, number> {
  const out: Record<FindingSeverity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  };
  for (const f of findings) out[f.severity] = (out[f.severity] ?? 0) + 1;
  return out;
}

export function statusBreakdown(findings: Finding[]): Record<FindingStatus, number> {
  const out: Record<FindingStatus, number> = {
    open: 0, acknowledged: 0, fixed: 0, false_positive: 0, ignored: 0, resolved: 0,
  };
  for (const f of findings) out[f.status] = (out[f.status] ?? 0) + 1;
  return out;
}

export function categoryBreakdown(findings: Finding[]): Partial<Record<FindingCategory, number>> {
  const out: Partial<Record<FindingCategory, number>> = {};
  for (const f of findings) {
    out[f.category] = (out[f.category] ?? 0) + 1;
  }
  return out;
}

/** Findings sorted by severity desc, then created_at desc. Stable
 *  for ties (relies on Array.prototype.sort being stable per ES2019). */
export function sortByImpact(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 0;
    const rb = SEVERITY_RANK[b.severity] ?? 0;
    if (ra !== rb) return rb - ra;
    // both same severity → newer first
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

/** Compact ReportFinding for the top-N summary view. */
export function toReportFinding(f: Finding): ReportFinding {
  return {
    id:         f.id,
    category:   f.category,
    severity:   f.severity,
    status:     f.status,
    detector:   f.detector,
    summary:    f.summary,
    evidence:   parseEvidenceRef(f.evidence_ref),
    created_at: f.created_at,
  };
}

export interface MapToReportOptions {
  /** Default 10. Set to Infinity for "all findings in top list". */
  topN?: number;
}

/**
 * Pure mapping function. Producer side decides what to do with the
 * Report — render JSX, build PDF, post to email, expose JSON.
 */
export function mapFindingsToReport(
  scanRun:  ScanRun,
  findings: Finding[],
  opts:     MapToReportOptions = {},
): Report {
  const topN  = opts.topN ?? 10;
  const score = computeComplianceScore(findings);
  const sorted = sortByImpact(findings);
  return {
    scan_run_id:   scanRun.id,
    tenant_id:     scanRun.tenant_id,
    website_id:    scanRun.website_id,
    detector:      scanRun.detector,
    scanned_at:    scanRun.completed_at ?? scanRun.created_at,
    duration_ms:   scanRun.duration_ms,
    score,
    grade:         gradeFromScore(score),
    severity_breakdown: severityBreakdown(findings),
    status_breakdown:   statusBreakdown(findings),
    category_breakdown: categoryBreakdown(findings),
    top_findings:  sorted.slice(0, topN).map(toReportFinding),
    total_findings: findings.length,
  };
}

/**
 * Build the deduped evidence index. EvidenceRef equality is wire-format
 * equality (formatEvidenceRef result string). Same evidence supporting
 * multiple findings lists all those finding ids under one entry.
 */
export function buildEvidenceCatalog(findings: Finding[]): EvidenceCatalogEntry[] {
  const by: Map<string, EvidenceCatalogEntry> = new Map();
  for (const f of findings) {
    const ref = parseEvidenceRef(f.evidence_ref);
    if (!ref) continue;
    const key = formatEvidenceRef(ref);
    const existing = by.get(key);
    if (existing) {
      existing.supports.push(f.id);
    } else {
      by.set(key, { ref, supports: [f.id] });
    }
  }
  return Array.from(by.values());
}

/**
 * Convenience: build the full ReportPayload (Report header + raw
 * findings + evidence catalog). The DB-side adapter uses this as
 * the final assembly step after fetching.
 */
export function buildReportPayload(
  scanRun:  ScanRun,
  findings: Finding[],
  opts:     MapToReportOptions = {},
): ReportPayload {
  return {
    report:           mapFindingsToReport(scanRun, findings, opts),
    scan_run:         scanRun,
    all_findings:     findings,
    evidence_catalog: buildEvidenceCatalog(findings),
  };
}

/** Re-export ALL_SEVERITIES / ALL_STATUSES so test files can assert
 *  exhaustive bucket creation without importing finding.ts directly. */
export { ALL_SEVERITIES, ALL_STATUSES };
