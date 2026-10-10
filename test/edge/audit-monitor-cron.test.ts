// @vitest-environment node
/**
 * audit-monitor-cron — täglicher Re-Scan der monitored_domains.
 * handler.ts gegen ein In-Memory-Repo, Fake-Scanner, Fake-Alerter;
 * keine Deno-Runtime, kein Netz, keine Datenbank, keine echten Credentials.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  handleAuditMonitor,
  type Alerter,
  type HandlerDeps,
  type MonitorRepo,
  type Scanner,
} from '../../supabase/functions/audit-monitor-cron/handler';
import {
  canonicalJson,
  checkCronAuth,
  detectDrift,
  evidenceContentHash,
  gateDomain,
  normalizeCookieScan,
  planViewFrom,
  type MonitoredDomain,
  type PlanView,
  type ScanResult,
} from '../../supabase/functions/audit-monitor-cron/logic';

const KEY = 'test-cron-audit-monitor-key-0123456789';
const T1 = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-10T02:00:00.000Z');
const DAY = 86_400_000;

const PLANS: Record<string, PlanView> = {
  // Werte aus PLAN_ENTITLEMENTS (pricing.generated.ts)
  free: planViewFrom({ has: () => false, limit: () => null }),
  starter: planViewFrom(lookup({ 'alerts.email': 1, 'monitoring.monthly': 1, 'limit.domains': 1 })),
  growth: planViewFrom(lookup({ 'alerts.email': 1, 'monitoring.daily': 1, 'monitoring.drift': 1, 'monitoring.monthly': 1, 'limit.domains': 3 })),
  agency: planViewFrom(lookup({ 'alerts.email': 1, 'monitoring.daily': 1, 'monitoring.drift': 1, 'monitoring.monthly': 1, 'limit.domains': 10 })),
};

function lookup(m: Record<string, number>) {
  return {
    has: (k: string) => (m[k] ?? 0) === -1 || (m[k] ?? 0) > 0,
    limit: (k: string) => (k in m ? m[k] : null),
  };
}

function domain(over: Partial<MonitoredDomain> = {}): MonitoredDomain {
  return {
    id: 'd1', tenant_id: T1, domain: 'example.de', tier: 'growth', active: true,
    alert_email: 'ops@example.de',
    last_scan_at: new Date(NOW.getTime() - DAY).toISOString(),
    last_risk_score: 80, last_trackers: ['google_analytics'],
    created_at: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

function scanOf(over: Partial<ScanResult> = {}): ScanResult {
  return {
    domain: 'example.de', risk_score: 80, trackers: ['google_analytics'], cookie_count: 3,
    consent_manager_detected: true, issues: [], scanned_at: NOW.toISOString(), scan_type: 'fetch',
    ...over,
  };
}

class MemRepo implements MonitorRepo {
  evidence: Array<Record<string, unknown>> = [];
  results: Array<Record<string, unknown>> = [];
  updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  failEvidence = false;
  constructor(public domains: MonitoredDomain[], public head: string | null = null) {}
  async listActiveDomains() { return this.domains; }
  async latestEvidenceHash() { return this.head; }
  async appendEvidence(row: Record<string, unknown>, prev: string | null) {
    if (this.failEvidence) throw new Error('append_governance_evidence: boom');
    if (prev !== this.head) return 'conflict' as const;
    this.evidence.push(row);
    this.head = row.content_hash as string;
    return { id: row.id as string };
  }
  async insertResult(row: Record<string, unknown>) { this.results.push(row); }
  async updateDomainState(id: string, patch: Record<string, unknown>) {
    this.updates.push({ id, patch });
    const d = this.domains.find((entry) => entry.id === id);
    if (d) Object.assign(d, patch);
  }
}

function setup(o: {
  domains?: MonitoredDomain[]; plan?: PlanView | ((t: string) => Promise<PlanView>);
  scanner?: Scanner | null; cronKey?: string; repo?: MemRepo;
  now?: () => Date; runBudgetMs?: number;
}) {
  const repo = o.repo ?? new MemRepo(o.domains ?? [domain()]);
  const alerts: string[] = [];
  const alerter: Alerter = async (d) => { alerts.push(d.domain); return 'sent'; };
  let n = 0;
  const plan = o.plan ?? PLANS.growth;
  const deps: HandlerDeps = {
    cronKey: o.cronKey ?? KEY,
    repo,
    scanner: o.scanner === undefined ? async () => scanOf() : o.scanner,
    plan: typeof plan === 'function' ? plan : async () => plan,
    alerter,
    now: o.now ?? (() => NOW),
    runBudgetMs: o.runBudgetMs,
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    pauseMs: 0,
  };
  return { repo, alerts, deps };
}

function post(key: string | null = KEY): Request {
  return new Request('http://x/audit-monitor-cron', {
    method: 'POST',
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    body: JSON.stringify({ trigger: 'cron' }),
  });
}

async function run(deps: HandlerDeps, key: string | null = KEY) {
  const res = await handleAuditMonitor(post(key), deps);
  return { status: res.status, body: await res.json() };
}

describe('audit-monitor-cron: Cron-Auth fail-closed', () => {
  it('fehlendes CRON_AUDIT_MONITOR_KEY → 500, kein DB-Zugriff', async () => {
    const { deps, repo } = setup({ cronKey: '' });
    let touched = false;
    repo.listActiveDomains = async () => { touched = true; return []; };
    const r = await run(deps);
    expect(r.status).toBe(500);
    expect(r.body.error?.code ?? r.body.code).toBe('CRON_KEY_MISSING');
    expect(touched).toBe(false);
  });

  it('falscher oder fehlender Bearer → 401 cron only', async () => {
    const { deps } = setup({});
    expect((await run(deps, 'wrong')).status).toBe(401);
    expect((await run(deps, null)).status).toBe(401);
    expect(checkCronAuth(KEY, `Bearer ${KEY}`)).toEqual({ ok: true });
  });

  it('index.ts vergleicht den Bearer nicht mit dem service_role-Key', () => {
    const src = readFileSync('supabase/functions/audit-monitor-cron/index.ts', 'utf8');
    expect(src).toContain("Deno.env.get('CRON_AUDIT_MONITOR_KEY')");
    expect(src).not.toMatch(/Bearer \$\{SERVICE_KEY\}/);
    expect(src).toContain('cron_audit_monitor_key');
  });
});

describe('audit-monitor-cron: Drift nur bei Delta', () => {
  it('kein Delta gegenüber dem letzten Lauf → kein Drift, kein Alert, aber Evidence', async () => {
    const { deps, repo, alerts } = setup({});
    const r = await run(deps);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.results[0]).toMatchObject({ status: 'ok', drift: false, alert: 'none' });
    expect(alerts).toEqual([]);
    expect(repo.evidence).toHaveLength(1);
    expect(repo.results[0]).toMatchObject({ drift_detected: false });
  });

  it('neuer Tracker → Drift + genau ein Alert', async () => {
    const { deps, alerts } = setup({ scanner: async () => scanOf({ trackers: ['google_analytics', 'meta_pixel'] }) });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ status: 'ok', drift: true, alert: 'sent' });
    expect(alerts).toEqual(['example.de']);
  });

  it('Score-Rauschen unter der Schwelle ist kein Delta', () => {
    expect(detectDrift(scanOf({ risk_score: 75 }), domain()).has_drift).toBe(false);
    expect(detectDrift(scanOf({ risk_score: 70 }), domain()).has_drift).toBe(true);
  });

  it('erster Lauf ist Baseline, kein Drift/Alert', async () => {
    const { deps, alerts } = setup({ domains: [domain({ last_scan_at: null, last_risk_score: null, last_trackers: [] })],
      scanner: async () => scanOf({ trackers: ['meta_pixel'] }) });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ status: 'ok', drift: false, baseline: true, alert: 'none' });
    expect(alerts).toEqual([]);
  });

  it('Drift ohne alerts.email+monitoring.drift (Starter) → kein Versand', async () => {
    const { deps, alerts } = setup({ plan: PLANS.starter,
      domains: [domain({ last_scan_at: new Date(NOW.getTime() - 31 * DAY).toISOString() })],
      scanner: async () => scanOf({ trackers: [] }) });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ drift: true, alert: 'suppressed_plan' });
    expect(alerts).toEqual([]);
  });
});

describe('audit-monitor-cron: Fail-closed', () => {
  it('kein Scanner-Endpoint → failed, Evidence des Fehllaufs, kein Status-Update, kein Alert', async () => {
    const { deps, repo, alerts } = setup({ scanner: null });
    const r = await run(deps);
    expect(r.status).toBe(500);
    expect(r.body.ok).toBe(false);
    expect(r.body.results[0]).toMatchObject({ status: 'failed', reason: 'scanner_not_configured' });
    expect(repo.evidence).toHaveLength(1);
    expect((repo.evidence[0].metadata as { status: string }).status).toBe('failed');
    expect(repo.updates).toEqual([]);
    expect(alerts).toEqual([]);
  });

  it('Scanner wirft → failed (kein stiller Fallback)', async () => {
    const { deps, repo } = setup({ scanner: async () => { throw new Error('timeout'); } });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ status: 'failed', reason: 'scan_failed' });
    expect(repo.results).toEqual([]);
  });

  it('normalisiert das reale cookie-scan-Antwortformat statt riskScore/tracker', () => {
    const wire = {
      ok: true, fetched_status: 200, fetch_error: null, score: 78,
      trackers: [{ id: 'meta_pixel' }, { id: 'google_analytics' }],
      cookies: [{ name: 'session' }], consent_manager_detected: true,
    };
    expect(normalizeCookieScan('example.de', wire, NOW.toISOString())).toMatchObject({
      risk_score: 78, trackers: ['google_analytics', 'meta_pixel'],
      cookie_count: 1, consent_manager_detected: true,
    });
  });

  it('fehlender Score, fehlgeschlagener Fetch oder fehlende Tracker sind kein erfolgreicher Scan', () => {
    const wire = {
      ok: true, fetched_status: 200, fetch_error: null, score: 80,
      trackers: [{ id: 'meta_pixel' }], cookies: [], consent_manager_detected: false,
    };
    const normalize = (x: unknown) => normalizeCookieScan('example.de', x, NOW.toISOString());
    expect(() => normalize({ ...wire, score: undefined })).toThrow(/score/);
    expect(() => normalize({ ...wire, fetch_error: 'timeout' })).toThrow(/successful response/);
    expect(() => normalize({ ...wire, fetched_status: 403 })).toThrow(/successful response/);
    expect(() => normalize({ ...wire, trackers: [{ tracker: 'meta_pixel' }] })).toThrow(/trackers/);
    expect(() => normalize({ ...wire, cookies: undefined })).toThrow(/cookie\/consent/);
  });

  it('akzeptiert terminale 3xx wie cookie-scan selbst (Grenze < 400)', () => {
    // fetchGuarded folgt 301/302/303/307/308 selbst; als 3xx kommen nur
    // Endstationen zurück (300, 304, Redirect ohne Location). cookie-scan
    // wertet sie als Erfolg (`status >= 300 && status < 400`) und liefert
    // einen Score — der Monitor darf sie nicht als Fehllauf verwerfen.
    const wire = {
      ok: true, fetch_error: null, score: 80,
      trackers: [], cookies: [], consent_manager_detected: false,
    };
    const normalize = (status: number) =>
      normalizeCookieScan('example.de', { ...wire, fetched_status: status }, NOW.toISOString());
    expect(normalize(304).risk_score).toBe(80);
    expect(normalize(399).risk_score).toBe(80);
    expect(() => normalize(400)).toThrow(/successful response/);
    expect(() => normalize(199)).toThrow(/successful response/);
  });

  it('Evidence-Write schlägt fehl → failed, kein Ergebnis, kein Alert', async () => {
    const repo = new MemRepo([domain()]);
    repo.failEvidence = true;
    const { deps, alerts } = setup({ repo, scanner: async () => scanOf({ trackers: ['meta_pixel'] }) });
    const r = await run(deps);
    expect(r.status).toBe(500);
    expect(r.body.results[0]).toMatchObject({ status: 'failed', reason: 'evidence_write_failed' });
    expect(repo.results).toEqual([]);
    expect(repo.updates).toEqual([]);
    expect(alerts).toEqual([]);
  });

  it('Plan nicht ladbar → failed, kein Scan', async () => {
    let scanned = false;
    const { deps } = setup({ plan: async () => { throw new Error('rpc down'); }, scanner: async () => { scanned = true; return scanOf(); } });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ status: 'failed', reason: 'plan_unavailable' });
    expect(scanned).toBe(false);
  });
});

describe('audit-monitor-cron: Plan-Gates', () => {
  it('Free ist nicht im Dauerbetrieb (auch wenn tier=growth in der Zeile steht)', async () => {
    let scanned = false;
    const { deps, repo } = setup({ plan: PLANS.free, scanner: async () => { scanned = true; return scanOf(); } });
    const r = await run(deps);
    expect(r.body.results[0]).toMatchObject({ status: 'skipped', reason: 'no_monitoring_plan' });
    expect(scanned).toBe(false);
    expect(repo.evidence).toEqual([]);
  });

  it('Starter: monatlich, nicht täglich', () => {
    const d = domain();
    expect(gateDomain(d, PLANS.starter, 0, NOW.getTime())).toEqual({ scan: false, reason: 'not_due' });
    expect(gateDomain(domain({ last_scan_at: new Date(NOW.getTime() - 30 * DAY).toISOString() }), PLANS.starter, 0, NOW.getTime()))
      .toEqual({ scan: true, kadenz: 'monthly' });
    expect(gateDomain(d, PLANS.growth, 0, NOW.getTime())).toEqual({ scan: true, kadenz: 'daily' });
  });

  it('limit.domains begrenzt den Dauerbetrieb je Tenant (Growth = 3)', async () => {
    const ds = [1, 2, 3, 4].map((i) => domain({ id: `d${i}`, domain: `s${i}.de`, created_at: `2026-10-0${i}T00:00:00Z` }));
    const { deps } = setup({ domains: ds });
    const r = await run(deps);
    const by = Object.fromEntries(r.body.results.map((x: { domain_id: string; status: string }) => [x.domain_id, x.status]));
    expect(by).toEqual({ d1: 'ok', d2: 'ok', d3: 'ok', d4: 'skipped' });
  });

  it('fehlt limit.domains im Plan, gibt es kein Kontingent', () => {
    expect(planViewFrom(lookup({ 'monitoring.daily': 1 })).domainLimit).toBe(0);
  });
});

describe('audit-monitor-cron: Evidence-Chain', () => {
  it('verkettet je Tenant über previous_hash und content_hash = sha256(JCS(snapshot))', async () => {
    const ds = [domain({ id: 'd1' }), domain({ id: 'd2', domain: 'b.de', created_at: '2026-10-02T00:00:00Z' })];
    const repo = new MemRepo(ds, 'abc');
    const { deps } = setup({ repo });
    await run(deps);
    expect(repo.evidence).toHaveLength(2);
    expect(repo.evidence[0].previous_hash).toBe('abc');
    expect(repo.evidence[1].previous_hash).toBe(repo.evidence[0].content_hash);
    const snap = (repo.evidence[1].metadata as { snapshot: Record<string, unknown> }).snapshot;
    expect(await evidenceContentHash(snap)).toBe(repo.evidence[1].content_hash);
    expect(canonicalJson(snap)).toContain('"kind":"domain_monitor_run"');
  });
});

describe('audit-monitor-cron: bounded processing', () => {
  it('stops starting new scans when time budget expires and leaves the backlog eligible', async () => {
    const ds = [1, 2, 3].map((i) => domain({
      id: `d${i}`, domain: `site${i}.de`,
      created_at: `2026-10-0${i}T00:00:00Z`,
    }));
    let elapsed = 0;
    const { deps, repo } = setup({
      domains: ds, runBudgetMs: 90_000,
      now: () => new Date(NOW.getTime() + elapsed),
      scanner: async () => { elapsed += 60_000; return scanOf(); },
    });
    const first = await run(deps);
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ ok: false, status: 'partial', scanned: 2, deferred: 1 });
    expect(repo.updates.map((x) => x.id)).toEqual(['d1', 'd2']);
    const next = await run(deps);
    expect(next.status).toBe(200);
    expect(next.body).toMatchObject({ ok: true, status: 'ok', scanned: 1, deferred: 0 });
    expect(repo.updates.map((x) => x.id)).toEqual(['d1', 'd2', 'd3']);
  });
});
