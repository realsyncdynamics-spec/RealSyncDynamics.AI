/**
 * M8 Monitoring/Sicherheit/Kosten — Views lesen nur belegte Daten, Mandantentrennung, Plattform-Health.
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('command center monitoring', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M8 Command Center Monitoring', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; uOp: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);
  async function as<T>(sub: string | null, fn: () => Promise<T>, role = 'authenticated'): Promise<T> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
      await q(`SET LOCAL ROLE ${role}`);
      return await fn();
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `m8_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`m8-A-${Date.now()}`); ids.tB = await tenant(`m8-B-${Date.now()}`);
    ids.uA = await user(); ids.uB = await user(); ids.uOp = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner')`, [ids.tA, ids.uA, ids.tB, ids.uB]);
    await q(`INSERT INTO public.platform_operators(user_id, active) VALUES ($1, true)`, [ids.uOp]);
    // Kosten: gemessen, geschätzt, simuliert (muss fehlen), Reservierung (muss fehlen), fremder Mandant
    await q(`INSERT INTO public.tenant_cost_ledger(tenant_id, agent_ref, cost_kind, units, unit_price_usd, value_basis)
             VALUES ($1,'a','llm_input',1000,0.000001,'gemessen'), ($1,'a','llm_estimate',500,0.00001,NULL),
                    ($1,'a','reservation',1,1,NULL), ($2,'b','llm_input',99,1,'gemessen')`, [ids.tA, ids.tB]);
    await q(`INSERT INTO public.tenant_cost_ledger(tenant_id, agent_ref, cost_kind, units, unit_price_usd, is_simulated, replay_run_id)
             VALUES ($1,'a','llm_input',7,1,true,gen_random_uuid())`, [ids.tA]);
    await q(`INSERT INTO public.agent_runs(tenant_id, actor_user_id, user_message, llm_provider, llm_model, input_tokens, output_tokens, cost_usd, outcome, error_message)
             VALUES ($1,$2,'m','anthropic','x',10,5,0.02,'success',NULL), ($1,$2,'m','anthropic','x',1,1,0.01,'budget_exceeded','Budget')`, [ids.tA, ids.uA]);
    await q(`INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent) VALUES ($1,'task.claim_rejected','task','t1','b')`, [ids.tA]);
    await q(`INSERT INTO public.agent_actions_log(tenant_id, action_type, input, status) VALUES ($1,'config_activate','{"agent_ref":"grok:x","section":"computer","actor":"u"}','ok')`, [ids.tA]);
    await q(`INSERT INTO public.cron_execution_logs(function_name, status) VALUES ('scheduler-dispatch','success'),('scheduler-dispatch','failure')`);
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Kosten: nur echte Buchungen, Basis ausgewiesen, Quellen getrennt, Mandant getrennt', async () => {
    const rows = await as(ids.uA, async () => (await q<{ source: string; metric: string; basis: string; cost_usd: string; tokens: string | null }>(
      `SELECT source, metric, basis, cost_usd::text, tokens::text FROM public.cc_cost_by_source_v ORDER BY source, metric`)).rows);
    expect(rows).toEqual([
      { source: 'agent_runs', metric: 'anthropic', basis: 'unbekannt', cost_usd: '0.030000', tokens: '17' },
      { source: 'tenant_cost_ledger', metric: 'llm_estimate', basis: 'geschaetzt', cost_usd: expect.stringMatching(/^0\.005/), tokens: null },
      { source: 'tenant_cost_ledger', metric: 'llm_input', basis: 'gemessen', cost_usd: expect.stringMatching(/^0\.001/), tokens: expect.stringMatching(/^1000(\.0+)?$/) },
    ]);
  });

  it('Kritische Ereignisse und Audit-Feed nur eigener Mandant', async () => {
    const ev = await as(ids.uA, async () => (await q<{ kind: string; category: string }>(
      `SELECT kind, category FROM public.cc_critical_events_v ORDER BY kind`)).rows);
    expect(ev).toEqual([
      { kind: 'agent_run_error', category: 'health' },
      { kind: 'claim_conflict', category: 'coordination' },
      { kind: 'config_activated', category: 'security' },
    ]);
    expect((await as(ids.uB, () => q(`SELECT 1 FROM public.cc_critical_events_v WHERE tenant_id=$1`, [ids.tA]))).rowCount).toBe(0);
    const feed = await as(ids.uA, async () => (await q<{ source: string }>(`SELECT source FROM public.cc_audit_feed_v ORDER BY source`)).rows);
    expect(feed.map((r) => r.source)).toEqual(['action_log', 'agent_event']);
  });

  it('anon ohne Zugriff auf alle Views', async () => {
    for (const v of ['cc_cost_by_source_v', 'cc_audit_feed_v', 'cc_critical_events_v']) {
      await expect(as(null, () => q(`SELECT 1 FROM public.${v}`), 'anon')).rejects.toThrow(/permission denied/);
    }
  });

  it('Plattform-Health nur für Operatoren; cron_execution_logs bleibt direkt gesperrt', async () => {
    await expect(as(ids.uA, () => q(`SELECT * FROM public.cc_platform_health()`))).rejects.toThrow(/Plattform-Operatoren/);
    const h = await as(ids.uOp, async () => (await q<{ function_name: string; runs_24h: string; failures_24h: string }>(
      `SELECT function_name, runs_24h::text, failures_24h::text FROM public.cc_platform_health() WHERE function_name='scheduler-dispatch'`)).rows);
    expect(Number(h[0]!.runs_24h)).toBeGreaterThanOrEqual(2);
    expect(Number(h[0]!.failures_24h)).toBeGreaterThanOrEqual(1);
    await expect(as(ids.uOp, () => q(`SELECT 1 FROM public.cron_execution_logs`))).rejects.toThrow(/permission denied/);
  });
});
