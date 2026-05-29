/**
 * Pure-logic mapping tests for src/lib/governance/reportMapping.
 *
 * No DB, no async. The DB-side adapter (supabase/functions/_shared/report.ts)
 * gets its own contract tests via the mocked AdminLike harness.
 */
import { describe, it, expect } from 'vitest';
import {
  computeComplianceScore,
  gradeFromScore,
  severityBreakdown,
  statusBreakdown,
  categoryBreakdown,
  sortByImpact,
  mapFindingsToReport,
  buildEvidenceCatalog,
  buildReportPayload,
  toReportFinding,
  ALL_SEVERITIES,
  ALL_STATUSES,
} from '../../../src/lib/governance/reportMapping';
import type { Finding } from '../../../src/types/governance/finding';
import type { ScanRun } from '../../../src/types/governance/scan-run';

const SCAN_RUN: ScanRun = {
  id:             's-1',
  tenant_id:      't-1',
  website_id:     'w-1',
  detector:       'gdpr-audit',
  status:         'completed',
  started_at:     '2026-05-25T15:00:00Z',
  completed_at:   '2026-05-25T15:00:30Z',
  duration_ms:    30000,
  finding_count:  4,
  severity_max:   'high',
  error_code:     null,
  error_message:  null,
  raw_payload:    null,
  correlation_id: 'corr-1',
  created_at:     '2026-05-25T15:00:00Z',
  updated_at:     '2026-05-25T15:00:30Z',
};

function f(o: Partial<Finding>): Finding {
  return {
    id:             'f-' + Math.random().toString(36).slice(2, 8),
    tenant_id:      't-1',
    website_id:     'w-1',
    scan_run_id:    's-1',
    category:       'tracker',
    severity:       'medium',
    status:         'open',
    detector:       'gdpr-audit',
    evidence_ref:   null,
    summary:        's',
    raw_payload:    null,
    confidence_score:    1.00,
    evidence_level:      'observed',
    verification_status: 'unverified',
    correlation_id: 'corr-1',
    created_at:     '2026-05-25T15:00:10Z',
    updated_at:     '2026-05-25T15:00:10Z',
    ...o,
  };
}

describe('computeComplianceScore', () => {
  it('returns 100 for empty findings', () => {
    expect(computeComplianceScore([])).toBe(100);
  });

  it('deducts 20 per open critical', () => {
    expect(computeComplianceScore([f({ severity: 'critical' })])).toBe(80);
    expect(computeComplianceScore([f({ severity: 'critical' }), f({ severity: 'critical' })])).toBe(60);
  });

  it('deducts severity-weighted per status=open', () => {
    const findings = [
      f({ severity: 'high'   }),  // -10
      f({ severity: 'medium' }),  // -5
      f({ severity: 'low'    }),  // -2
      f({ severity: 'info'   }),  // -0
    ];
    expect(computeComplianceScore(findings)).toBe(83);  // 100 - 17
  });

  it('ignores findings in false_positive / ignored / resolved', () => {
    const findings = [
      f({ severity: 'critical', status: 'false_positive' }),
      f({ severity: 'critical', status: 'ignored'        }),
      f({ severity: 'critical', status: 'resolved'       }),
      f({ severity: 'high',     status: 'open'           }),  // only this counts -10
    ];
    expect(computeComplianceScore(findings)).toBe(90);
  });

  it('counts fixed at 50% penalty', () => {
    // 1 critical@open=-20, 1 critical@fixed=-10
    const findings = [
      f({ severity: 'critical', status: 'open'  }),
      f({ severity: 'critical', status: 'fixed' }),
    ];
    expect(computeComplianceScore(findings)).toBe(70);
  });

  it('caps at 0 (never negative)', () => {
    const findings = Array.from({ length: 10 }, () => f({ severity: 'critical' }));
    expect(computeComplianceScore(findings)).toBe(0);
  });
});

describe('gradeFromScore', () => {
  it('boundary cases', () => {
    expect(gradeFromScore(100)).toBe('A');
    expect(gradeFromScore(90)).toBe('A');
    expect(gradeFromScore(89)).toBe('B');
    expect(gradeFromScore(75)).toBe('B');
    expect(gradeFromScore(74)).toBe('C');
    expect(gradeFromScore(60)).toBe('C');
    expect(gradeFromScore(59)).toBe('D');
    expect(gradeFromScore(40)).toBe('D');
    expect(gradeFromScore(39)).toBe('F');
    expect(gradeFromScore(0)).toBe('F');
  });
});

describe('severityBreakdown', () => {
  it('produces all five buckets even when empty', () => {
    const out = severityBreakdown([]);
    for (const s of ALL_SEVERITIES) {
      expect(out[s]).toBe(0);
    }
  });

  it('counts correctly', () => {
    const out = severityBreakdown([
      f({ severity: 'critical' }),
      f({ severity: 'critical' }),
      f({ severity: 'high'     }),
      f({ severity: 'low'      }),
    ]);
    expect(out).toEqual({ critical: 2, high: 1, medium: 0, low: 1, info: 0 });
  });
});

describe('statusBreakdown', () => {
  it('produces all six buckets even when empty', () => {
    const out = statusBreakdown([]);
    for (const s of ALL_STATUSES) {
      expect(out[s]).toBe(0);
    }
  });
});

describe('categoryBreakdown', () => {
  it('only populates seen categories', () => {
    const out = categoryBreakdown([
      f({ category: 'consent' }),
      f({ category: 'tracker' }),
      f({ category: 'tracker' }),
    ]);
    expect(out).toEqual({ consent: 1, tracker: 2 });
  });
});

describe('sortByImpact', () => {
  it('orders critical → high → medium → low → info', () => {
    const sorted = sortByImpact([
      f({ severity: 'info'     }),
      f({ severity: 'critical' }),
      f({ severity: 'low'      }),
      f({ severity: 'high'     }),
      f({ severity: 'medium'   }),
    ]);
    expect(sorted.map((x) => x.severity)).toEqual([
      'critical', 'high', 'medium', 'low', 'info',
    ]);
  });

  it('within same severity, newer created_at comes first', () => {
    const sorted = sortByImpact([
      f({ severity: 'high', id: 'A', created_at: '2026-05-25T10:00:00Z' }),
      f({ severity: 'high', id: 'B', created_at: '2026-05-25T12:00:00Z' }),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['B', 'A']);
  });
});

describe('toReportFinding', () => {
  it('parses evidence_ref into typed EvidenceRef', () => {
    const out = toReportFinding(f({
      evidence_ref: 'url:https://example.com/cookie',
    }));
    expect(out.evidence).toEqual({ kind: 'url', url: 'https://example.com/cookie' });
  });

  it('null evidence_ref → evidence=null', () => {
    const out = toReportFinding(f({ evidence_ref: null }));
    expect(out.evidence).toBeNull();
  });
});

describe('mapFindingsToReport', () => {
  it('produces a complete Report header for typical mid-severity scan', () => {
    const findings = [
      f({ severity: 'critical', category: 'consent', summary: 'A' }),
      f({ severity: 'high',     category: 'tracker', summary: 'B' }),
      f({ severity: 'medium',   category: 'tracker', summary: 'C' }),
      f({ severity: 'low',      category: 'security', summary: 'D' }),
    ];
    const r = mapFindingsToReport(SCAN_RUN, findings);

    expect(r.scan_run_id).toBe('s-1');
    expect(r.detector).toBe('gdpr-audit');
    expect(r.scanned_at).toBe('2026-05-25T15:00:30Z');
    expect(r.duration_ms).toBe(30000);

    // 100 - 20 - 10 - 5 - 2 = 63
    expect(r.score).toBe(63);
    expect(r.grade).toBe('C');

    expect(r.severity_breakdown).toEqual({
      critical: 1, high: 1, medium: 1, low: 1, info: 0,
    });
    expect(r.category_breakdown).toEqual({
      consent: 1, tracker: 2, security: 1,
    });
    expect(r.top_findings.length).toBe(4);
    expect(r.top_findings[0].summary).toBe('A');  // critical first
    expect(r.total_findings).toBe(4);
  });

  it('respects opts.topN truncation', () => {
    const findings = Array.from({ length: 20 }, (_, i) =>
      f({ severity: 'medium', summary: `f${i}` })
    );
    const r = mapFindingsToReport(SCAN_RUN, findings, { topN: 5 });
    expect(r.top_findings.length).toBe(5);
    expect(r.total_findings).toBe(20);
  });

  it('falls back to created_at when completed_at is null', () => {
    const r = mapFindingsToReport({ ...SCAN_RUN, completed_at: null }, []);
    expect(r.scanned_at).toBe(SCAN_RUN.created_at);
  });
});

describe('buildEvidenceCatalog', () => {
  it('dedupes by wire-format equality', () => {
    const findings = [
      f({ id: 'A', evidence_ref: 'url:https://example.com/x' }),
      f({ id: 'B', evidence_ref: 'url:https://example.com/x' }),  // same
      f({ id: 'C', evidence_ref: 'url:https://example.com/y' }),  // different
    ];
    const cat = buildEvidenceCatalog(findings);
    expect(cat.length).toBe(2);
    const xEntry = cat.find((e) => e.ref.kind === 'url' && e.ref.url === 'https://example.com/x');
    expect(xEntry?.supports).toEqual(['A', 'B']);
  });

  it('skips findings without evidence_ref', () => {
    expect(buildEvidenceCatalog([f({ evidence_ref: null })])).toEqual([]);
  });
});

describe('buildReportPayload', () => {
  it('returns full payload with report + scan_run + findings + catalog', () => {
    const findings = [f({ severity: 'high', evidence_ref: 'sha256:' + 'a'.repeat(64) })];
    const p = buildReportPayload(SCAN_RUN, findings);
    expect(p.report.score).toBe(90);
    expect(p.scan_run).toBe(SCAN_RUN);
    expect(p.all_findings).toBe(findings);
    expect(p.evidence_catalog.length).toBe(1);
    expect(p.evidence_catalog[0].ref).toEqual({ kind: 'sha256', hash: 'a'.repeat(64) });
  });
});
