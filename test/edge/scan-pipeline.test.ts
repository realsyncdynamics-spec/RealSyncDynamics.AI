/**
 * Scan-pipeline adapter tests — mocks the admin client; no DB roundtrips.
 * DB-level CHECK constraints (terminal_timestamp_check,
 * failed_requires_error_check, etc.) are covered by CI Migration
 * validation + the local PG15 apply during development.
 */
import { describe, it, expect } from 'vitest';
import {
  startScanRun,
  recordScanFinding,
  completeScanRun,
  failScanRun,
  cancelScanRun,
  type AdminLike,
} from '../../supabase/functions/_shared/scan-pipeline';
import type { FindingSeverity } from '../../supabase/functions/_shared/findings';

interface Call { table: string; verb: 'insert' | 'update' | 'select-eq'; payload: unknown }

function mockAdmin(opts: {
  insertResult?: { error: { message: string } | null };
  updateResult?: { error: { message: string } | null };
  selectRows?:   { severity: FindingSeverity }[];
} = {}): { admin: AdminLike; calls: Call[] } {
  const calls: Call[] = [];
  const admin: AdminLike = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ table, verb: 'insert', payload: row });
          return Promise.resolve({ data: null, error: opts.insertResult?.error ?? null });
        },
        select(cols: string) {
          // deno-lint-ignore no-explicit-any
          const chain: any = {
            eq(col: string, val: unknown) {
              calls.push({ table, verb: 'select-eq', payload: { cols, col, val } });
              const promise = Promise.resolve({ data: opts.selectRows ?? [], error: null });
              // chainable + thenable
              return Object.assign(promise, {
                eq:    chain.eq,
                order: chain.order,
                limit: chain.limit,
              });
            },
            order() { return chain; },
            limit() { return Promise.resolve({ data: opts.selectRows ?? [], error: null }); },
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              calls.push({ table, verb: 'update', payload: { patch, col, val } });
              return Promise.resolve({ error: opts.updateResult?.error ?? null });
            },
          };
        },
      };
    },
  };
  return { admin, calls };
}

describe('startScanRun', () => {
  it('inserts a row in running state with detected timestamps', async () => {
    const { admin, calls } = mockAdmin();
    const r = await startScanRun(admin, {
      tenant_id: 't-1',
      detector:  'gdpr-audit',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const inserted = calls[0].payload as Record<string, unknown>;
    expect(inserted.tenant_id).toBe('t-1');
    expect(inserted.detector).toBe('gdpr-audit');
    expect(inserted.status).toBe('running');
    expect(typeof inserted.started_at).toBe('string');
    expect(inserted.id).toBeTruthy();
    expect(inserted.correlation_id).toBeTruthy();
    expect(r.run.scan_run_id).toBe(inserted.id);
    expect(r.run.correlation_id).toBe(inserted.correlation_id);
  });

  it('honors caller-supplied correlation_id', async () => {
    const { admin, calls } = mockAdmin();
    const r = await startScanRun(admin, {
      tenant_id: 't-1',
      detector:  'cookie-scanner',
      correlation_id: 'corr-fixed',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.run.correlation_id).toBe('corr-fixed');
    expect((calls[0].payload as Record<string, unknown>).correlation_id).toBe('corr-fixed');
  });

  it('rejects missing tenant_id without hitting the DB', async () => {
    const { admin, calls } = mockAdmin();
    const r = await startScanRun(admin, { tenant_id: '', detector: 'd' });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('rejects missing detector', async () => {
    const { admin, calls } = mockAdmin();
    const r = await startScanRun(admin, { tenant_id: 't', detector: '' });
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('propagates DB error from insert', async () => {
    const { admin } = mockAdmin({ insertResult: { error: { message: 'unique-violation' } } });
    const r = await startScanRun(admin, { tenant_id: 't', detector: 'd' });
    expect(r.ok).toBe(false);
    if ('error' in r) {
      expect(r.error).toBe('unique-violation');
    }
  });
});

describe('recordScanFinding', () => {
  it('auto-stamps scan_run_id + correlation_id onto the finding row', async () => {
    const { admin, calls } = mockAdmin();
    const r = await recordScanFinding(admin, 's-1', 'corr-1', {
      tenant_id: 't',
      category:  'tracker',
      severity:  'high',
      detector:  'gdpr-audit',
      summary:   'Unknown vendor pre-consent',
    });
    expect(r.ok).toBe(true);
    const inserted = calls.find((c) => c.table === 'findings')?.payload as Record<string, unknown>;
    expect(inserted.scan_run_id).toBe('s-1');
    expect(inserted.correlation_id).toBe('corr-1');
    expect(inserted.summary).toBe('Unknown vendor pre-consent');
  });
});

describe('completeScanRun', () => {
  it('computes finding_count + severity_max from DB roll-up by default', async () => {
    const { admin, calls } = mockAdmin({
      selectRows: [
        { severity: 'low'    },
        { severity: 'high'   },
        { severity: 'medium' },
      ],
    });
    const r = await completeScanRun(admin, 's-1');
    expect(r.ok).toBe(true);
    expect(r.finding_count).toBe(3);
    expect(r.severity_max).toBe('high');
    // status update applied
    const upd = calls.find((c) => c.verb === 'update');
    expect(upd?.payload).toMatchObject({
      patch: expect.objectContaining({
        status:        'completed',
        finding_count: 3,
        severity_max:  'high',
      }),
      col:   'id',
      val:   's-1',
    });
  });

  it('treats empty finding set as severity_max=null', async () => {
    const { admin } = mockAdmin({ selectRows: [] });
    const r = await completeScanRun(admin, 's-1');
    expect(r.ok).toBe(true);
    expect(r.finding_count).toBe(0);
    expect(r.severity_max).toBeNull();
  });

  it('respects caller-supplied counters and skips the roll-up SELECT', async () => {
    const { admin, calls } = mockAdmin();
    const r = await completeScanRun(admin, 's-1', { finding_count: 7, severity_max: 'critical' });
    expect(r.ok).toBe(true);
    expect(r.finding_count).toBe(7);
    expect(r.severity_max).toBe('critical');
    // No findings-SELECT issued.
    const selectFindings = calls.find((c) => c.table === 'findings' && c.verb === 'select-eq');
    expect(selectFindings).toBeUndefined();
  });

  it('propagates DB error from the update', async () => {
    const { admin } = mockAdmin({
      selectRows: [],
      updateResult: { error: { message: 'rls-blocked' } },
    });
    const r = await completeScanRun(admin, 's-1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rls-blocked');
  });

  it('rejects missing scanRunId', async () => {
    const { admin, calls } = mockAdmin();
    const r = await completeScanRun(admin, '');
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('failScanRun', () => {
  it('persists status=failed with error_code + message + completed_at', async () => {
    const { admin, calls } = mockAdmin();
    const r = await failScanRun(admin, 's-1', 'DETECTOR_TIMEOUT', 'Site took >30s');
    expect(r.ok).toBe(true);
    const upd = calls.find((c) => c.verb === 'update');
    expect(upd?.payload).toMatchObject({
      patch: expect.objectContaining({
        status:        'failed',
        error_code:    'DETECTOR_TIMEOUT',
        error_message: 'Site took >30s',
      }),
      col:   'id',
      val:   's-1',
    });
    expect(typeof (upd?.payload as { patch: Record<string, string> }).patch.completed_at).toBe('string');
  });

  it('rejects missing errorCode (DB CHECK would otherwise catch it)', async () => {
    const { admin, calls } = mockAdmin();
    const r = await failScanRun(admin, 's-1', '', 'reason');
    expect(r.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('cancelScanRun', () => {
  it('moves to cancelled with reason in error_message', async () => {
    const { admin, calls } = mockAdmin();
    const r = await cancelScanRun(admin, 's-1', 'tenant cancelled the scan');
    expect(r.ok).toBe(true);
    const upd = calls.find((c) => c.verb === 'update');
    expect(upd?.payload).toMatchObject({
      patch: expect.objectContaining({
        status:        'cancelled',
        error_message: 'tenant cancelled the scan',
      }),
      col:   'id',
      val:   's-1',
    });
  });
});
