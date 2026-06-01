// Unit-Tests für den Audit-Worker-Persistenz-Layer.
//
// Deckt die reine Mapping-Logik (worker/src/mapping.ts) und den
// DB-Adapter (worker/src/persistence.ts) ab. Beide ziehen KEIN Playwright,
// daher im Node/jsdom-Vitest direkt importierbar — anders als crawler.ts.
//
// Der Supabase-Client wird per Hand gemockt (gleicher Stil wie
// test/edge/scan-pipeline.test.ts), sodass kein Live-Postgres nötig ist.

import { describe, it, expect } from 'vitest';
import {
  mapRuleCategory,
  mapRuleSeverity,
  maxSeverity,
  mapRuleFindingToRow,
  truncateSummary,
  type RuleFindingLike,
} from '../../worker/src/mapping';
import {
  startScanRun,
  recordFindings,
  completeScanRun,
  failScanRun,
} from '../../worker/src/persistence';

// ── Mapping ────────────────────────────────────────────────────────────

describe('worker mapping', () => {
  it('maps rule categories to the findings CHECK vocabulary', () => {
    expect(mapRuleCategory('tracking')).toBe('tracker');
    expect(mapRuleCategory('ai-act')).toBe('ai_act');
    expect(mapRuleCategory('consent')).toBe('consent');
    // unbekannte/zukünftige Kategorie darf den CHECK nicht brechen
    expect(mapRuleCategory('something-new')).toBe('other');
    expect(mapRuleCategory('rights')).toBe('other');
  });

  it('passes valid severities through and defaults unknown to info', () => {
    expect(mapRuleSeverity('critical')).toBe('critical');
    expect(mapRuleSeverity('low')).toBe('low');
    expect(mapRuleSeverity('bogus')).toBe('info');
  });

  it('computes the maximum severity of a list', () => {
    expect(maxSeverity([])).toBeNull();
    expect(maxSeverity(['low', 'high', 'medium'])).toBe('high');
    expect(maxSeverity(['low', 'critical', 'high'])).toBe('critical');
  });

  it('truncates summaries to the 1000-char CHECK limit', () => {
    const long = 'x'.repeat(1500);
    const out = truncateSummary(long);
    expect(out.length).toBe(1000);
    expect(out.endsWith('…')).toBe(true);
    expect(truncateSummary('short')).toBe('short');
  });

  it('maps a rule finding into a valid findings row', () => {
    const finding: RuleFindingLike = {
      rule_id: 'GDPR-GA-001',
      title: 'Google Analytics ohne Consent',
      severity: 'high',
      category: 'tracking',
    };
    const row = mapRuleFindingToRow(finding, {
      tenant_id: 't1',
      scan_run_id: 'sr1',
      correlation_id: 'c1',
      detector: 'audit-worker',
      evidence_ref: 'path/shot.png',
    });
    expect(row).toMatchObject({
      tenant_id: 't1',
      scan_run_id: 'sr1',
      correlation_id: 'c1',
      category: 'tracker',
      severity: 'high',
      status: 'open',
      detector: 'audit-worker',
      evidence_ref: 'path/shot.png',
      summary: 'Google Analytics ohne Consent',
    });
    expect(row.website_id).toBeNull();
    expect(row.raw_payload).toMatchObject({ rule_id: 'GDPR-GA-001' });
  });

  it('falls back to rule_id when title is empty (summary CHECK >= 1)', () => {
    const row = mapRuleFindingToRow(
      { rule_id: 'R-1', title: '', severity: 'low', category: 'consent' },
      { tenant_id: 't', scan_run_id: 's', correlation_id: 'c', detector: 'd' },
    );
    expect(row.summary).toBe('R-1');
  });
});

// ── Persistenz-Adapter (gemockter Supabase-Client) ──────────────────────

interface InsertCall { table: string; row: unknown; }
interface UpdateCall { table: string; patch: Record<string, unknown>; eqCol: string; eqVal: unknown; }

class MockSupabase {
  inserts: InsertCall[] = [];
  updates: UpdateCall[] = [];
  failInsertOn: string | null = null;

  from(table: string) {
    return {
      insert: (row: unknown) => {
        if (this.failInsertOn === table) {
          return Promise.resolve({ error: { message: `insert ${table} failed` } });
        }
        this.inserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (eqCol: string, eqVal: unknown) => {
          this.updates.push({ table, patch, eqCol, eqVal });
          return Promise.resolve({ error: null });
        },
      }),
    };
  }
}

describe('worker persistence', () => {
  it('startScanRun inserts a running scan_run with generated ids', async () => {
    const sb = new MockSupabase();
    const res = await startScanRun(sb as never, { tenant_id: 't1', detector: 'audit-worker' });
    expect(res.scan_run_id).toBeTruthy();
    expect(res.correlation_id).toBeTruthy();
    expect(sb.inserts).toHaveLength(1);
    expect(sb.inserts[0].table).toBe('scan_runs');
    expect((sb.inserts[0].row as Record<string, unknown>).status).toBe('running');
  });

  it('startScanRun throws on insert error', async () => {
    const sb = new MockSupabase();
    sb.failInsertOn = 'scan_runs';
    await expect(startScanRun(sb as never, { tenant_id: 't1', detector: 'd' })).rejects.toThrow(/scan_runs insert failed/);
  });

  it('recordFindings skips the insert for an empty list', async () => {
    const sb = new MockSupabase();
    const res = await recordFindings(sb as never, [], {
      tenant_id: 't', scan_run_id: 's', correlation_id: 'c', detector: 'd',
    });
    expect(res).toEqual({ count: 0, severity_max: null });
    expect(sb.inserts).toHaveLength(0);
  });

  it('recordFindings bulk-inserts rows and returns count + max severity', async () => {
    const sb = new MockSupabase();
    const findings: RuleFindingLike[] = [
      { rule_id: 'A', title: 'a', severity: 'low', category: 'consent' },
      { rule_id: 'B', title: 'b', severity: 'critical', category: 'tracking' },
    ];
    const res = await recordFindings(sb as never, findings, {
      tenant_id: 't', scan_run_id: 's', correlation_id: 'c', detector: 'audit-worker',
    });
    expect(res.count).toBe(2);
    expect(res.severity_max).toBe('critical');
    expect(sb.inserts).toHaveLength(1);
    expect(sb.inserts[0].table).toBe('findings');
    expect(Array.isArray(sb.inserts[0].row)).toBe(true);
  });

  it('completeScanRun updates the row with rollups + duration', async () => {
    const sb = new MockSupabase();
    await completeScanRun(sb as never, 'sr1', {
      finding_count: 3, severity_max: 'high', started_at: Date.now() - 1000,
    });
    expect(sb.updates).toHaveLength(1);
    expect(sb.updates[0].table).toBe('scan_runs');
    expect(sb.updates[0].patch.status).toBe('completed');
    expect(sb.updates[0].patch.finding_count).toBe(3);
    expect(typeof sb.updates[0].patch.duration_ms).toBe('number');
    expect(sb.updates[0].eqVal).toBe('sr1');
  });

  it('failScanRun marks the run failed with an error_code', async () => {
    const sb = new MockSupabase();
    await failScanRun(sb as never, 'sr1', 'CRAWL_ERROR', 'boom');
    expect(sb.updates[0].patch.status).toBe('failed');
    expect(sb.updates[0].patch.error_code).toBe('CRAWL_ERROR');
  });
});
