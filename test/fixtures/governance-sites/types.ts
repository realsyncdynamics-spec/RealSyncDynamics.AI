/**
 * Golden-fixture protocol for governance-site regression tests.
 *
 * Each fixture is a self-contained synthetic scan: a ScanRun + the
 * Finding[] a hypothetical detector would have emitted for a known
 * site state, plus the deterministic expected output of running them
 * through `mapFindingsToReport` / `buildReportPayload`.
 *
 * No scanner code is invoked; the fixtures ARE the detector output.
 * Their job is to lock the report-mapping math (PR 3) so that future
 * changes to the scoring formula, severity weights, status rules, or
 * evidence-catalog dedup are caught immediately.
 */
import type { Finding, FindingSeverity, FindingStatus } from '../../../src/types/governance/finding';
import type { ScanRun } from '../../../src/types/governance/scan-run';
import type { ComplianceGrade } from '../../../src/types/governance/report';

export interface GoldenExpectation {
  score:                number;
  grade:                ComplianceGrade;
  totalFindings:        number;
  severityBreakdown:    Record<FindingSeverity, number>;
  statusBreakdown:      Record<FindingStatus, number>;
  topFindingsCount:     number;
  evidenceCatalogSize:  number;
}

export interface GoldenFixture {
  name:        string;
  description: string;
  scanRun:     ScanRun;
  findings:    Finding[];
  expected:    GoldenExpectation;
}
