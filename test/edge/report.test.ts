/**
 * DB-side Report-assembly tests for supabase/functions/_shared/report.
 * Mocks the AdminLike client; no DB roundtrips.
 */
import { describe, it, expect } from 'vitest';
import {
  getReport,
  type FindingRow,
  type ScanRunRow,
} from '../../supabase/functions/_shared/report';
import type { AdminLike } from '../../supabase/functions/_shared/findings';

interface Call { table: string; verb: 'select-eq'; col: string; val: unknown }

function mockAdmin(opts: {
  scanRow?:  ScanRunRow | null;
  findings?: FindingRow[];
  scanErr?:  string;
  findErr?:  string;
} = {}): { admin: AdminLike; calls: Call[] } {
  const calls: Call[] = [];
  const admin: AdminLike = {
    from(table: string) {
      return {
        // unused
        insert(_row) { return Promise.resolve({ data: null, error: null }); },
        // deno-lint-ignore no-explicit-any
        select(_cols: string): any {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, verb: 'select-eq', col, val });
              if (table === 'scan_runs') {
                if (opts.scanErr) return Promise.resolve({ data: null, error: { message: opts.scanErr } });
                return Promise.resolve({ data: opts.scanRow ?? null, error: null });
              }
              if (table === 'findings') {
                if (opts.findErr) return Promise.resolve({ data: null, error: { message: opts.findErr } });
                return Promise.resolve({ data: opts.findings ?? [], error: null });
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        update(_p) { return { eq: () => Promise.resolve({ error: null }) }; },
      };
    },
  };
  return { admin, calls };
}

function row(o: Partial<FindingRow>): FindingRow {
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
    correlation_id: 'corr-1',
    created_at:     '2026-05-25T15:00:00Z',
    updated_at:     '2026-05-25T15:00:00Z',
    ...o,
  };
}

const SCAN: ScanRunRow = {
  id:             's-1',
  tenant_id:      't-1',
  website_id:     'w-1',
  detector:       'gdpr-audit',
  status:         'completed',
  started_at:     '2026-05-25T15:00:00Z',
  completed_at:   '2026-05-25T15:00:30Z',
  duration_ms:    30000,
  finding_count:  3,
  severity_max:   'high',
  error_code:     null,
  error_message:  null,
  raw_payload:    null,
  correlation_id: 'corr-1',
  created_at:     '2026-05-25T15:00:00Z',
  updated_at:     '2026-05-25T15:00:30Z',
};

describe('getReport', () => {
  it('returns ok=false when scan_run not found', async () => {
    const { admin } = mockAdmin({ scanRow: null });
    const r = await getReport(admin, 'missing');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not found/);
  });

  it('returns ok=false on scan_runs query error', async () => {
    const { admin } = mockAdmin({ scanErr: 'rls-blocked' });
    const r = await getReport(admin, 's-1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rls-blocked');
  });

  it('returns ok=false on findings query error', async () => {
    const { admin } = mockAdmin({ scanRow: SCAN, findErr: 'timeout' });
    const r = await getReport(admin, 's-1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
  });

  it('returns report with score + breakdowns from findings', async () => {
    const { admin } = mockAdmin({
      scanRow: SCAN,
      findings: [
        row({ severity: 'critical', category: 'consent', summary: 'A' }),
        row({ severity: 'high',     category: 'tracker', summary: 'B' }),
        row({ severity: 'low',      category: 'security', summary: 'C' }),
      ],
    });
    const r = await getReport(admin, 's-1');
    expect(r.ok).toBe(true);
    expect(r.report).toBeDefined();
    if (!r.report) return;
    expect(r.report.scan_run_id).toBe('s-1');
    expect(r.report.score).toBe(68);  // 100 - 20 - 10 - 2
    expect(r.report.grade).toBe('C');
    expect(r.report.severity_breakdown).toEqual({
      critical: 1, high: 1, medium: 0, low: 1, info: 0,
    });
    expect(r.report.category_breakdown).toEqual({
      consent: 1, tracker: 1, security: 1,
    });
    expect(r.report.top_findings.length).toBe(3);
    expect(r.report.top_findings[0].severity).toBe('critical');
    expect(r.report.total_findings).toBe(3);
  });

  it('respects topN option', async () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      row({ severity: 'low', summary: `f${i}` })
    );
    const { admin } = mockAdmin({ scanRow: SCAN, findings });
    const r = await getReport(admin, 's-1', { topN: 5 });
    expect(r.ok).toBe(true);
    expect(r.report?.top_findings.length).toBe(5);
    expect(r.report?.total_findings).toBe(15);
  });

  it('returns empty report for scan with no findings', async () => {
    const { admin } = mockAdmin({ scanRow: SCAN, findings: [] });
    const r = await getReport(admin, 's-1');
    expect(r.ok).toBe(true);
    expect(r.report?.score).toBe(100);
    expect(r.report?.grade).toBe('A');
    expect(r.report?.total_findings).toBe(0);
  });

  it('rejects empty scanRunId', async () => {
    const { admin, calls } = mockAdmin();
    const r = await getReport(admin, '');
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
