/**
 * M7 Entscheidungsarchiv, Wissenssuche, Routinen-Nachweis, cron_execution_logs-Härtung.
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('memory archive routines', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M7 Gedächtnis, Archiv, Routinen', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; uE: string; dA: string; dA2: string; rA: string };
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
  async function asKeep<T>(sub: string | null, fn: () => Promise<T>, role = 'authenticated'): Promise<T> {
    await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role })]);
    await q(`SET LOCAL ROLE ${role}`);
    try { return await fn(); } finally { await q(`RESET ROLE`); }
  }
  const search = (sub: string, s: string, kinds: string[] | null = null, any = false) =>
    as(sub, async () => (await q<{ kind: string; id: string; title: string }>(
      `SELECT kind, id, title FROM public.search_agent_knowledge($1, $2::text[], 20, $3)`, [s, kinds, any])).rows);

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `m7_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`m7-A-${Date.now()}`); ids.tB = await tenant(`m7-B-${Date.now()}`);
    ids.uA = await user(); ids.uB = await user(); ids.uE = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner'),($1,$5,'editor')`,
      [ids.tA, ids.uA, ids.tB, ids.uB, ids.uE]);
    const dec = async (t: string, title: string) => (await q<{ id: string }>(
      `INSERT INTO public.agent_decisions(tenant_id, decision_title, problem, options, recommendation, reason, risk_level, reversibility, status, proposed_by)
       VALUES ($1,$2,'p','[{"label":"A","rationale":"a","recommended":true},{"label":"B","rationale":"b"}]'::jsonb,'A','Begründung Webhook','high','reversible','proposed','grok:x') RETURNING id`,
      [t, title])).rows[0]!.id;
    ids.dA = await dec(ids.tA, 'Stripe Webhook Retry erhöhen');
    ids.dA2 = await dec(ids.tA, 'Stripe Webhook Retry erhöhen');
    await dec(ids.tB, 'Stripe Webhook fremd');
    await q(`INSERT INTO public.agent_memory(tenant_id, topic, content, source_agent) VALUES ($1,'Webhook-Ausfall','Lösung: Signatur-Secret rotiert','grok:x')`, [ids.tA]);
    ids.rA = (await q<{ id: string }>(`INSERT INTO public.agent_routines(tenant_id, routine_key, label, expected_interval_minutes) VALUES ($1,'daily.drift-check','Drift-Prüfung',1440) RETURNING id`, [ids.tA])).rows[0]!.id;
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Suche findet Entscheidungen und Gedächtnis nur im eigenen Mandanten', async () => {
    const r = await search(ids.uA, 'webhook');
    expect(r.filter((x) => x.kind === 'decision')).toHaveLength(2);
    expect(r.filter((x) => x.kind === 'memory')).toHaveLength(1);
    expect(r.some((x) => x.title === 'Stripe Webhook fremd')).toBe(false);
    expect(await search(ids.uA, 'webhook', ['memory'])).toHaveLength(1);
    expect(await search(ids.uA, '   ')).toHaveLength(0);
    expect(await search(ids.uA, 'webhook gibtsnicht')).toHaveLength(0);
    expect((await search(ids.uA, 'webhook gibtsnicht', ['decision'], true))).toHaveLength(2);
    expect(await search(ids.uA, '%%%')).toHaveLength(0);
  });

  it('anon: keine Suche, kein Archiv', async () => {
    await expect(as(null, () => q(`SELECT * FROM public.search_agent_knowledge('x')`), 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(null, () => q(`SELECT * FROM public.agent_decision_archive_v`), 'anon')).rejects.toThrow(/permission denied/);
  });

  it('Archiv zeigt letzte Freigabe; frühere Freigabe überträgt sich NICHT auf gleichlautende neue Entscheidung', async () => {
    await asKeep(ids.uA, () => q(`SELECT public.resolve_agent_decision($1,'approve',0,'L4',true,'ok')`, [ids.dA]));
    const arch = await as(ids.uA, async () => (await q<{ decision_id: string; status: string; last_action: string | null }>(
      `SELECT decision_id, status, last_action FROM public.agent_decision_archive_v WHERE tenant_id=$1 ORDER BY created_at`, [ids.tA])).rows);
    const a = arch.find((x) => x.decision_id === ids.dA)!; const b = arch.find((x) => x.decision_id === ids.dA2)!;
    expect(a).toMatchObject({ status: 'approved', last_action: 'approve' });
    expect(b).toMatchObject({ status: 'proposed', last_action: null });
    await expect(as(ids.uA, () => q(`SELECT public.resolve_agent_decision($1,'approve',0,'L4',false,null)`, [ids.dA2])))
      .rejects.toThrow(/Bestätigung/);
  });

  it('Routinen: Läufe nur via service_role, append-only, Status-View', async () => {
    await expect(as(ids.uA, () => q(`SELECT public.record_routine_run($1,'daily.drift-check','success')`, [ids.tA]))).rejects.toThrow(/permission denied|service_role/);
    await expect(as(ids.uA, () => q(`INSERT INTO public.agent_routine_runs(tenant_id, routine_id, status) VALUES ($1,$2,'success')`, [ids.tA, ids.rA]))).rejects.toThrow(/permission denied|row-level/);
    await asKeep(null, () => q(`SELECT public.record_routine_run($1,'daily.drift-check','failure', now() - interval '1 hour', now() - interval '59 minutes', NULL, '[]', 'Timeout')`, [ids.tA]), 'service_role');
    await asKeep(null, () => q(`SELECT public.record_routine_run($1,'daily.drift-check','success', now(), now(), 'ok', '[{"kind":"log","ref":"run-1"}]')`, [ids.tA]), 'service_role');
    await expect(as(null, () => q(`SELECT public.record_routine_run($1,'unbekannt','success')`, [ids.tA]), 'service_role')).rejects.toThrow(/nicht registriert/);
    const st = await as(ids.uE, async () => (await q<{ last_status: string; failures_7d: string; source: string }>(
      `SELECT source, last_status, failures_7d FROM public.agent_routine_status_v WHERE tenant_id=$1`, [ids.tA])).rows);
    expect(st).toEqual([{ source: 'routine', last_status: 'success', failures_7d: '1' }]);
    expect((await as(ids.uB, () => q(`SELECT 1 FROM public.agent_routine_status_v WHERE tenant_id=$1`, [ids.tA]))).rowCount).toBe(0);
    await expect(q(`UPDATE public.agent_routine_runs SET status='success' WHERE routine_id=$1`, [ids.rA])).rejects.toThrow(/append-only/);
  });

  it('Routinen anlegen nur Owner/Admin', async () => {
    await expect(as(ids.uE, () => q(`INSERT INTO public.agent_routines(tenant_id, routine_key, label) VALUES ($1,'x.y','X')`, [ids.tA]))).rejects.toThrow(/row-level/);
    const ok = await as(ids.uA, () => q(`INSERT INTO public.agent_routines(tenant_id, routine_key, label) VALUES ($1,'x.y','X')`, [ids.tA]));
    expect(ok.rowCount).toBe(1);
  });

  it('cron_execution_logs: anon/authenticated ohne Zugriff', async () => {
    await expect(as(null, () => q(`SELECT 1 FROM public.cron_execution_logs`), 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(ids.uA, () => q(`INSERT INTO public.cron_execution_logs(function_name, status) VALUES ('scheduler-dispatch','success')`))).rejects.toThrow(/permission denied/);
  });
});
