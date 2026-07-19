// DB-side Report assembly: read a scan_run + its findings, hand to the
// pure mapping in src/lib/governance/reportMapping.ts.
//
// Edge Functions can't import from src/, so the mapping logic is
// duplicated minimally below as Deno-importable plain TS. The shape
// MUST stay byte-equivalent with src/lib/governance/reportMapping.ts
// — type contract tests on the TS side verify the math; this file
// is the data-access wrapper.

import type { AdminLike } from './findings.ts';

export type ComplianceGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus   =
  | 'open' | 'acknowledged' | 'fixed' | 'false_positive' | 'ignored' | 'resolved';
export type FindingCategory =
  | 'consent' | 'tracker' | 'ai_act' | 'tom' | 'dpa'
  | 'accessibility' | 'security' | 'transparency' | 'data_quality'
  | 'documentation' | 'other';

export interface FindingRow {
  id:             string;
  tenant_id:      string;
  website_id:     string | null;
  scan_run_id:    string | null;
  category:       FindingCategory;
  severity:       FindingSeverity;
  status:         FindingStatus;
  detector:       string;
  evidence_ref:   string | null;
  summary:        string;
  raw_payload:    Record<string, unknown> | null;
  correlation_id: string | null;
  created_at:     string;
  updated_at:     string;
}

export interface ScanRunRow {
  id:             string;
  tenant_id:      string;
  website_id:     string | null;
  detector:       string;
  status:         string;
  started_at:     string | null;
  completed_at:   string | null;
  duration_ms:    number | null;
  finding_count:  number;
  severity_max:   FindingSeverity | null;
  error_code:     string | null;
  error_message:  string | null;
  raw_payload:    Record<string, unknown> | null;
  correlation_id: string | null;
  created_at:     string;
  updated_at:     string;
}

export interface ReportHeader {
  scan_run_id:        string;
  tenant_id:          string;
  website_id:         string | null;
  detector:           string;
  scanned_at:         string;
  duration_ms:        number | null;
  score:              number;
  grade:              ComplianceGrade;
  severity_breakdown: Record<FindingSeverity, number>;
  status_breakdown:   Record<FindingStatus, number>;
  category_breakdown: Partial<Record<FindingCategory, number>>;
  top_findings:       Array<{
    id:         string;
    category:   FindingCategory;
    severity:   FindingSeverity;
    status:     FindingStatus;
    detector:   string;
    summary:    string;
    evidence_ref: string | null;
    created_at: string;
  }>;
  total_findings:     number;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

function computeScore(findings: FindingRow[]): number {
  const P: Record<FindingSeverity, number> = {
    critical: 20, high: 10, medium: 5, low: 2, info: 0,
  };
  let total = 100;
  for (const f of findings) {
    if (f.status === 'false_positive' || f.status === 'ignored' || f.status === 'resolved') continue;
    const base = P[f.severity] ?? 0;
    total -= f.status === 'fixed' ? base * 0.5 : base;
  }
  return Math.max(0, Math.round(total));
}

function grade(score: number): ComplianceGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function sortByImpact(findings: FindingRow[]): FindingRow[] {
  return [...findings].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 0;
    const rb = SEVERITY_RANK[b.severity] ?? 0;
    if (ra !== rb) return rb - ra;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  });
}

export interface GetReportResult {
  ok:            boolean;
  error?:        string;
  report?:       ReportHeader;
  scan_run?:     ScanRunRow;
  all_findings?: FindingRow[];
}

export interface GetReportOptions {
  topN?: number;
}

/**
 * Joins scan_run + findings + builds the ReportHeader for the calling
 * Edge Function. Caller does its own auth/membership check before
 * invoking — this adapter relies on service_role bypass + the
 * application-level guard. Returns ok=false on missing scan_run so
 * callers can map to 404.
 */
export async function getReport(
  admin:     AdminLike,
  scanRunId: string,
  opts:      GetReportOptions = {},
): Promise<GetReportResult> {
  if (!scanRunId) return { ok: false, error: 'scanRunId required' };
  const topN = opts.topN ?? 10;

  const scanQ = admin.from('scan_runs').select('*').eq('id', scanRunId) as unknown as Promise<{ data: unknown; error: unknown }>;
  const { data: scanData, error: scanErr } = await scanQ;
  if (scanErr) return { ok: false, error: scanErr.message };
  const scanRow = Array.isArray(scanData) ? scanData[0] : scanData;
  if (!scanRow) return { ok: false, error: 'scan_run not found' };
  const scanRun = scanRow as ScanRunRow;

  const findsQ = admin.from('findings').select('*').eq('scan_run_id', scanRunId) as unknown as Promise<{ data: unknown; error: unknown }>;
  const { data: findData, error: findErr } = await findsQ;
  if (findErr) return { ok: false, error: findErr.message };
  const findings = ((findData as FindingRow[]) ?? []);

  const sevBreak: Record<FindingSeverity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  };
  const stsBreak: Record<FindingStatus, number> = {
    open: 0, acknowledged: 0, fixed: 0, false_positive: 0, ignored: 0, resolved: 0,
  };
  const catBreak: Partial<Record<FindingCategory, number>> = {};
  for (const f of findings) {
    sevBreak[f.severity] = (sevBreak[f.severity] ?? 0) + 1;
    stsBreak[f.status]   = (stsBreak[f.status]   ?? 0) + 1;
    catBreak[f.category] = (catBreak[f.category] ?? 0) + 1;
  }

  const score = computeScore(findings);
  const top = sortByImpact(findings).slice(0, topN).map((f) => ({
    id:           f.id,
    category:     f.category,
    severity:     f.severity,
    status:       f.status,
    detector:     f.detector,
    summary:      f.summary,
    evidence_ref: f.evidence_ref,
    created_at:   f.created_at,
  }));

  const report: ReportHeader = {
    scan_run_id:        scanRun.id,
    tenant_id:          scanRun.tenant_id,
    website_id:         scanRun.website_id,
    detector:           scanRun.detector,
    scanned_at:         scanRun.completed_at ?? scanRun.created_at,
    duration_ms:        scanRun.duration_ms,
    score,
    grade:              grade(score),
    severity_breakdown: sevBreak,
    status_breakdown:   stsBreak,
    category_breakdown: catBreak,
    top_findings:       top,
    total_findings:     findings.length,
  };

  return { ok: true, report, scan_run: scanRun, all_findings: findings };
}
