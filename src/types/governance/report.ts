/**
 * Report — the audit-facing rolled-up view of a scan_run + its findings.
 *
 * Mapping logic: `src/lib/governance/reportMapping.ts`.
 * DB read helper: `supabase/functions/_shared/report.ts::getReport`.
 *
 * Designed as the SINGLE data shape consumed by:
 *   - the existing /audit/result/:auditId React page (#406)
 *   - the future PDF exporter (PR 4 of the MVP sequence)
 *   - the auditor permalink shareable view
 *   - the in-Edge `audit-report-email` body builder
 *
 * Pure data — no methods, no DB references. Producer fills it from
 * (ScanRun, Finding[]) and optional evidence dereferencing.
 */

import type { Finding, FindingCategory, FindingSeverity, FindingStatus } from './finding';
import type { ScanRun } from './scan-run';
import type { EvidenceRef } from './evidence';

/** Coarse roll-up label paired with the integer score. */
export type ComplianceGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Report {
  /** Header */
  scan_run_id:   string;
  tenant_id:     string;
  website_id:    string | null;
  detector:      string;
  scanned_at:    string;    // ISO-8601, == scan_run.completed_at
  duration_ms:   number | null;

  /** Aggregate score 0..100, derived from severity counts; see
   *  `computeComplianceScore`. */
  score:         number;
  grade:         ComplianceGrade;

  /** Count by severity. Always includes all five buckets (zero allowed). */
  severity_breakdown: Record<FindingSeverity, number>;

  /** Count by status. */
  status_breakdown:   Record<FindingStatus, number>;

  /** Count by category, only populated keys. */
  category_breakdown: Partial<Record<FindingCategory, number>>;

  /** Top N findings, sorted by severity desc then created_at desc.
   *  Default N = 10 — the PDF cover page shows these as a summary. */
  top_findings:  ReportFinding[];

  /** Full set of findings (id + severity + summary only — full data
   *  via getReport's all_findings path). */
  total_findings: number;
}

/** Compact finding shape used in `top_findings`. The full Finding
 *  carries raw_payload + correlation_id which are heavy in JSON. */
export interface ReportFinding {
  id:             string;
  category:       FindingCategory;
  severity:       FindingSeverity;
  status:         FindingStatus;
  detector:       string;
  summary:        string;
  evidence:       EvidenceRef | null;   // parsed from finding.evidence_ref
  created_at:     string;
}

/** Computed reverse-index used by the PDF / UI to render an
 *  "Evidence catalogue" section. Same EvidenceRef can support
 *  multiple findings — index lists the supporting finding-ids. */
export interface EvidenceCatalogEntry {
  ref:           EvidenceRef;
  supports:      string[];   // finding ids
}

/** Full data shape returned by `getReport(scanRunId)` — the Report
 *  header + the complete findings list. Caller decides what to render. */
export interface ReportPayload {
  report:         Report;
  scan_run:       ScanRun;
  all_findings:   Finding[];
  evidence_catalog: EvidenceCatalogEntry[];
}
