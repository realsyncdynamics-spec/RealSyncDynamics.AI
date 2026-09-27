// @vitest-environment node
/**
 * tenant-audit pipeline (supabase/functions/tenant-audit/pipeline.ts).
 *
 * Regression for the live v37 bug: startScanRun returns
 * { ok: true, run: { scan_run_id, correlation_id } }, index.ts read both ids
 * from the top level → undefined. completeScanRun(undefined) failed
 * ("scanRunId required", HTTP 500), findings got correlation_id '' (invalid
 * uuid) and the scan_runs row stayed `running`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runTenantAuditPipeline, type GdprAuditResponse, type PipelineDeps } from '../../supabase/functions/tenant-audit/pipeline';

const TENANT = '11111111-1111-4111-8111-111111111111';
const WEBSITE = '33333333-3333-4333-8333-333333333333';
const USER = '0000000a-0000-4000-8000-00000000000a';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Db {
  scan_runs: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  updates: Array<{ table: string; patch: Record<string, unknown>; id: unknown }>;
  failFindingInsert?: boolean;
  failComplete?: boolean;
}

function mockAdmin(db: Db) {
  return {
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => {
          if (table === 'findings' && db.failFindingInsert) return { data: null, error: { message: 'invalid input syntax for type uuid' } };
          (db as unknown as Record<string, Array<Record<string, unknown>>>)[table].push(row);
          return { data: null, error: null };
        },
        select: (_cols: string) => ({
          eq: (col: string, val: unknown) => {
            const rows = table === 'websites'
              ? [{ governance_asset_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]
              : db.findings.filter((f) => f[col] === val).map((f) => ({ severity: f.severity }));
            const res = { data: rows, error: null };
            return { then: (ok: (v: typeof res) => unknown) => Promise.resolve(ok(res)) };
          },
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: unknown) => {
            if (table === 'scan_runs' && patch.status === 'completed' && db.failComplete) {
              return { error: { message: 'scan_runs update failed' } };
            }
            db.updates.push({ table, patch, id });
            const run = db.scan_runs.find((r) => r.id === id);
            if (run) Object.assign(run, patch);
            return { error: null };
          },
        }),
      };
    },
  };
}

const AUDIT: GdprAuditResponse = {
  ok: true, audit_id: 'audit-1', score: 72, severity: 'medium', domain: 'example.de',
  issues: [
    { id: 'hsts_missing', severity: 'high', title: 'HSTS fehlt', detail: 'x' },
    { id: 'impressum_missing', severity: 'medium', title: 'Impressum fehlt', detail: 'y' },
  ],
  fetched_status: 200, fetched: true, fetch_error: null,
};

function setup(over: Partial<Db> = {}, audit: PipelineDeps['callGdprAudit'] = async () => AUDIT) {
  const db: Db = { scan_runs: [], findings: [], updates: [], ...over };
  const events: Array<{ type: string; correlation_id: string | null; payload: Record<string, unknown> }> = [];
  const deps: PipelineDeps = {
    // deno-lint-ignore no-explicit-any
    admin: mockAdmin(db) as any,
    callGdprAudit: audit,
    emit: async (a) => { events.push(a); },
  };
  return { db, events, deps };
}

const input = { tenantId: TENANT, websiteId: WEBSITE, url: 'https://example.de', userId: USER };

describe('tenant-audit pipeline: ids come from started.run', () => {
  it('happy path: run completes with the real scan_run_id; findings carry a uuid correlation_id', async () => {
    const { db, events, deps } = setup();
    const r = await runTenantAuditPipeline(deps, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const run = db.scan_runs[0];
    expect(r.scan_run_id).toBe(run.id);
    expect(r.scan_run_id).toMatch(UUID_RE);
    expect(r.correlation_id).toBe(run.correlation_id);
    expect(run.status).toBe('completed');
    expect(r.finding_count).toBe(2);
    expect(r.severity_max).toBe('high');
    for (const f of db.findings) {
      expect(f.scan_run_id).toBe(run.id);
      expect(f.correlation_id).toMatch(UUID_RE);
      expect(f.correlation_id).not.toBe('');
    }
    expect(events.map((e) => e.type)).toEqual(['audit.scan_started', 'audit.scan_completed']);
    expect(events.every((e) => e.payload.scan_run_id === run.id && e.correlation_id === run.correlation_id)).toBe(true);
  });

  it('finding insert failure → run marked failed (not left running)', async () => {
    const { db, events, deps } = setup({ failFindingInsert: true });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, status: 500, code: 'FINDING_INSERT' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'FINDING_INSERT' });
    expect(db.scan_runs[0].completed_at).toBeTruthy();
    expect(events.at(-1)?.type).toBe('audit.scan_failed');
  });

  it('completeScanRun failure → run marked failed', async () => {
    const { db, deps } = setup({ failComplete: true });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, code: 'PIPELINE_COMPLETE_FAILED' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'PIPELINE_COMPLETE_FAILED' });
  });

  it('detector HTTP error / network error → failed run with the real id', async () => {
    const http = setup({}, async () => ({ httpStatus: 503, text: 'unavailable' }));
    expect(await runTenantAuditPipeline(http.deps, input)).toMatchObject({ ok: false, status: 502, code: 'GDPR_AUDIT_HTTP' });
    expect(http.db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'GDPR_AUDIT_HTTP' });
    expect(http.db.updates[0].id).toBe(http.db.scan_runs[0].id);

    const net = setup({}, async () => { throw new Error('ECONNRESET'); });
    expect(await runTenantAuditPipeline(net.deps, input)).toMatchObject({ ok: false, code: 'GDPR_AUDIT_FETCH' });
    expect(net.db.scan_runs[0]).toMatchObject({ status: 'failed' });
  });

  it('unexpected exception after start → run marked failed (INTERNAL)', async () => {
    const { db, deps } = setup({}, async () => ({ ...AUDIT, issues: [null as never] }));
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, code: 'INTERNAL' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'INTERNAL' });
  });

  it('index.ts no longer destructures ids from the top level of startScanRun', () => {
    const src = readFileSync('supabase/functions/tenant-audit/index.ts', 'utf8');
    expect(src).not.toMatch(/const \{ scan_run_id, correlation_id \} = started;/);
    expect(src).not.toContain("correlation_id ?? ''");
    expect(src).toContain('runTenantAuditPipeline');
  });
});
