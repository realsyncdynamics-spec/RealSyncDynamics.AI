// @vitest-environment node
/**
 * tenant-audit pipeline (supabase/functions/tenant-audit/pipeline.ts).
 *
 * Regression for the live v37 bug: startScanRun returns
 * { ok: true, run: { scan_run_id, correlation_id } }, index.ts read both ids
 * from the top level → undefined. completeScanRun(undefined) failed
 * ("scanRunId required", HTTP 500), findings got correlation_id '' (invalid
 * uuid) and the scan_runs row stayed `running`.
 *
 * Gate 2: website anchor (own tenant only), fail-closed on an unfetched
 * target, hash-chained evidence before findings, dedupe on re-scan
 * (refresh / reopen / resolve / suppressed stays suppressed).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  runTenantAuditPipeline, siteHost, dedupeKey,
  type AuditRepo, type GdprAuditResponse, type PipelineDeps, type TrackedFinding, type WebsiteRow,
} from '../../supabase/functions/tenant-audit/pipeline';
import { trackedKeyPattern } from '../../supabase/functions/tenant-audit/repo';
import { canonicalJson, evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';

const TENANT = '11111111-1111-4111-8111-111111111111';
const WEBSITE = '33333333-3333-4333-8333-333333333333';
const USER = '0000000a-0000-4000-8000-00000000000a';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const ASSET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Db {
  scan_runs: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  websites: Array<WebsiteRow & { tenant_id: string }>;
  failEvidenceInsert?: boolean;
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
          ((db as unknown as Record<string, Array<Record<string, unknown>>>)[table] ??= []).push(row);
          return { data: null, error: null };
        },
        select: (_cols: string) => ({
          eq: (col: string, val: unknown) => {
            const rows = table === 'websites'
              ? db.websites.filter((w) => w[col as keyof WebsiteRow] === val).map((w) => ({ governance_asset_id: w.governance_asset_id }))
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

/** In-memory AuditRepo over the same Db; mirrors repo.ts semantics (tenant filter, status guard, 23505). */
function memRepo(db: Db): AuditRepo {
  return {
    async findWebsite(tenantId, websiteId) {
      return db.websites.find((w) => w.tenant_id === tenantId && w.id === websiteId) ?? null;
    },
    async listWebsites(tenantId) {
      return db.websites.filter((w) => w.tenant_id === tenantId);
    },
    async latestEvidenceHash(tenantId) {
      const own = db.evidence.filter((e) => e.tenant_id === tenantId && e.content_hash);
      return (own.at(-1)?.content_hash as string | undefined) ?? null;
    },
    async insertEvidence(row) {
      if (db.failEvidenceInsert) throw new Error('governance_evidence insert: denied');
      db.evidence.push(row);
      return { id: row.id as string };
    },
    async listTrackedFindings(tenantId, host) {
      return db.findings
        .filter((f) => f.tenant_id === tenantId && f.detector === 'gdpr-audit'
          && typeof f.dedupe_key === 'string' && (f.dedupe_key as string).endsWith(`:${host}`)
          && ['open', 'acknowledged', 'fixed', 'false_positive', 'ignored'].includes(f.status as string))
        .map((f) => ({ ...f }) as unknown as TrackedFinding);
    },
    async insertFinding(row) {
      if (db.failFindingInsert) throw new Error('findings insert: invalid input syntax for type uuid');
      const clash = db.findings.some((f) => f.tenant_id === row.tenant_id && f.dedupe_key === row.dedupe_key
        && ['open', 'acknowledged'].includes(f.status as string));
      if (clash) return 'conflict';
      db.findings.push({ ...row });
      return { id: row.id as string };
    },
    async updateFinding(id, expectStatus, patch) {
      const f = db.findings.find((x) => x.id === id && x.status === expectStatus);
      if (f) Object.assign(f, patch);
    },
  };
}

const AUDIT: GdprAuditResponse = {
  ok: true, audit_id: 'audit-1', score: 72, severity: 'medium', domain: 'example.de',
  issues: [
    { id: 'hsts_missing', severity: 'high', title: 'HSTS fehlt', detail: 'x' },
    { id: 'impressum_missing', severity: 'medium', title: 'Impressum fehlt', detail: 'y' },
  ],
  fetched_status: 200, fetched: true, fetch_error: null, coverage: 'full',
};

function setup(over: Partial<Db> = {}, audit: PipelineDeps['callGdprAudit'] = async () => AUDIT) {
  const db: Db = {
    scan_runs: [], findings: [], evidence: [], updates: [],
    websites: [
      { id: WEBSITE, tenant_id: TENANT, domain: 'www.example.de', governance_asset_id: ASSET },
      { id: '44444444-4444-4444-8444-444444444444', tenant_id: OTHER_TENANT, domain: 'example.de', governance_asset_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    ],
    ...over,
  };
  const events: Array<{ type: string; correlation_id: string | null; payload: Record<string, unknown> }> = [];
  const deps: PipelineDeps = {
    // deno-lint-ignore no-explicit-any
    admin: mockAdmin(db) as any,
    repo: memRepo(db),
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

  it('malformed detector issue → run marked failed, nothing written', async () => {
    const { db, deps } = setup({}, async () => ({ ...AUDIT, issues: [null as never] }));
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, code: 'DETECTOR_INVALID' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'DETECTOR_INVALID' });
    expect(db.findings).toEqual([]);
    expect(db.evidence).toEqual([]);
  });

  it('unexpected exception after start → run marked failed (INTERNAL)', async () => {
    const { db, deps } = setup();
    const emit = deps.emit;
    deps.emit = async (a) => { if (a.type === 'audit.scan_started') throw new Error('boom'); await emit(a); };
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

describe('Gate 2 · website anchor', () => {
  it('a website_id of another tenant starts no run and writes nothing', async () => {
    const { db, deps } = setup();
    const r = await runTenantAuditPipeline(deps, { ...input, websiteId: '44444444-4444-4444-8444-444444444444' });
    expect(r).toMatchObject({ ok: false, status: 404, code: 'WEBSITE_NOT_FOUND' });
    expect(db.scan_runs).toEqual([]);
    expect(db.findings).toEqual([]);
    expect(db.evidence).toEqual([]);
  });

  it('url host must match the website', async () => {
    const { db, deps } = setup();
    const r = await runTenantAuditPipeline(deps, { ...input, url: 'https://evil.example.com' });
    expect(r).toMatchObject({ ok: false, status: 400, code: 'URL_WEBSITE_MISMATCH' });
    expect(db.scan_runs).toEqual([]);
  });

  it('run, evidence and findings carry the own asset', async () => {
    const { db, deps } = setup();
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: true, website_id: WEBSITE, asset_id: ASSET });
    expect(db.scan_runs[0]).toMatchObject({ website_id: WEBSITE, asset_id: ASSET });
    expect(db.evidence[0]).toMatchObject({ tenant_id: TENANT, asset_id: ASSET });
    for (const f of db.findings) expect(f).toMatchObject({ asset_id: ASSET, website_id: WEBSITE, tenant_id: TENANT });
  });

  it('without website_id the own website with this host is used, never a foreign one', async () => {
    const { db, deps } = setup();
    const r = await runTenantAuditPipeline(deps, { ...input, websiteId: null });
    expect(r).toMatchObject({ ok: true, website_id: WEBSITE, asset_id: ASSET });
    expect(db.findings.every((f) => f.asset_id === ASSET)).toBe(true);
  });

  it('siteHost normalises scheme, www, port, path and case', () => {
    expect(siteHost('HTTPS://www.Example.de:8443/impressum?x=1')).toBe('example.de');
    expect(siteHost('example.de')).toBe('example.de');
    expect(siteHost('')).toBe('');
  });

  it('LIKE pattern escapes wildcards in the host', () => {
    expect(trackedKeyPattern('my_site.de')).toBe('gdpr\\_audit.%:my\\_site.de');
  });
});

describe('Gate 2 · fail-closed', () => {
  it('unfetched target → failed run, no findings, no evidence, nothing resolved', async () => {
    const { db, deps } = setup({}, async () => ({ ...AUDIT, fetched: false, fetched_status: null, fetch_error: 'timeout', coverage: 'failed' }));
    db.findings.push({ id: 'f-old', tenant_id: TENANT, detector: 'gdpr-audit', status: 'open', dedupe_key: dedupeKey('csp_missing', 'example.de'), raw_payload: {} });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, status: 502, code: 'TARGET_UNREACHABLE' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'TARGET_UNREACHABLE' });
    expect(db.evidence).toEqual([]);
    expect(db.findings).toHaveLength(1);
    expect(db.findings[0].status).toBe('open');
  });

  it('evidence insert failure → failed run and no finding without evidence', async () => {
    const { db, deps } = setup({ failEvidenceInsert: true });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: false, code: 'EVIDENCE_INSERT' });
    expect(db.scan_runs[0]).toMatchObject({ status: 'failed', error_code: 'EVIDENCE_INSERT' });
    expect(db.findings).toEqual([]);
  });
});

describe('Gate 2 · evidence', () => {
  it('one hash-chained evidence row per run; every finding cites it', async () => {
    const { db, deps } = setup();
    db.evidence.push({ id: 'e-prev', tenant_id: TENANT, content_hash: 'prevhash' });
    db.evidence.push({ id: 'e-foreign', tenant_id: OTHER_TENANT, content_hash: 'foreignhash' });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ev = db.evidence.find((e) => e.id === r.evidence_id)!;
    const meta = ev.metadata as { snapshot: Record<string, unknown>; scan_run_id: string };
    expect(ev.previous_hash).toBe('prevhash');
    expect(meta.snapshot.previous_hash).toBe('prevhash');
    expect(meta.scan_run_id).toBe(r.scan_run_id);
    expect(ev.content_hash).toBe(await evidenceContentHash(meta.snapshot));
    expect(canonicalJson(meta.snapshot)).toContain('"issues":[{"id":"hsts_missing"');
    expect(db.findings.every((f) => f.evidence_id === r.evidence_id && f.scan_run_id === r.scan_run_id)).toBe(true);
  });
});

describe('Gate 2 · re-scan dedupe', () => {
  it('second scan refreshes instead of duplicating', async () => {
    const { db, deps } = setup();
    const first = await runTenantAuditPipeline(deps, input);
    const second = await runTenantAuditPipeline(deps, input);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(db.findings).toHaveLength(2);
    expect(second.findings).toMatchObject({ created: 0, refreshed: 2 });
    expect(second.finding_count).toBe(2);
    expect(db.findings.every((f) => f.scan_run_id === second.scan_run_id && f.evidence_id === second.evidence_id)).toBe(true);
    expect(db.evidence).toHaveLength(2);
    expect(db.evidence[1].previous_hash).toBe(db.evidence[0].content_hash);
  });

  it('acknowledged stays acknowledged when re-observed', async () => {
    const { db, deps } = setup();
    await runTenantAuditPipeline(deps, input);
    db.findings[0].status = 'acknowledged';
    await runTenantAuditPipeline(deps, input);
    expect(db.findings[0].status).toBe('acknowledged');
    expect(db.findings).toHaveLength(2);
  });

  it('fixed but still observed → reopened with history', async () => {
    const { db, deps } = setup();
    await runTenantAuditPipeline(deps, input);
    db.findings[0].status = 'fixed';
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: true, findings: { reopened: 1, refreshed: 1, created: 0 } });
    expect(db.findings[0].status).toBe('open');
    const hist = (db.findings[0].raw_payload as { status_history: Array<Record<string, unknown>> }).status_history;
    expect(hist.at(-1)).toMatchObject({ from: 'fixed', to: 'open', by: 'scanner' });
  });

  it('no longer observed on full coverage → resolved with the evidence of this run', async () => {
    const { db, deps } = setup();
    await runTenantAuditPipeline(deps, input);
    deps.callGdprAudit = async () => ({ ...AUDIT, issues: [AUDIT.issues[0]] });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: true, findings: { resolved: 1, refreshed: 1 } });
    if (!r.ok) return;
    const gone = db.findings.find((f) => f.dedupe_key === dedupeKey('impressum_missing', 'example.de'))!;
    expect(gone).toMatchObject({ status: 'resolved', evidence_id: r.evidence_id });
    expect(gone.resolved_at).toBeTruthy();
  });

  it('limited coverage proves no absence → nothing resolved', async () => {
    const { db, deps } = setup();
    await runTenantAuditPipeline(deps, input);
    deps.callGdprAudit = async () => ({ ...AUDIT, coverage: 'limited', issues: [AUDIT.issues[0]] });
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: true, findings: { resolved: 0 } });
    expect(db.findings.every((f) => f.status === 'open')).toBe(true);
  });

  it('false_positive stays suppressed and is not duplicated', async () => {
    const { db, deps } = setup();
    await runTenantAuditPipeline(deps, input);
    db.findings[0].status = 'false_positive';
    const r = await runTenantAuditPipeline(deps, input);
    expect(r).toMatchObject({ ok: true, findings: { suppressed: 1, created: 0 } });
    expect(db.findings).toHaveLength(2);
    expect(db.findings[0].status).toBe('false_positive');
  });

  it('findings of another tenant are never touched', async () => {
    const { db, deps } = setup();
    db.findings.push({ id: 'f-foreign', tenant_id: OTHER_TENANT, detector: 'gdpr-audit', status: 'open', dedupe_key: dedupeKey('csp_missing', 'example.de'), raw_payload: {} });
    await runTenantAuditPipeline(deps, input);
    expect(db.findings.find((f) => f.id === 'f-foreign')).toMatchObject({ status: 'open', raw_payload: {} });
  });
});
