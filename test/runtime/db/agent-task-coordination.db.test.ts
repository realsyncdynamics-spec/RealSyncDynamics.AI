/**
 * M6 agent_tasks Koordination — Doppelbearbeitung, Delegationszyklen, Abhängigkeiten, Kanban-RPC.
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_tasks coordination', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M6 agent_tasks Koordination', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; uE: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);
  async function tryq(sql: string, p: unknown[] = []) {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try { return await q(sql, p); } finally { await q(`ROLLBACK TO SAVEPOINT ${sp}`); }
  }
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
  const task = async (agent: string, extra: { parent?: string; deps?: string[]; corr?: string; tenant?: string } = {}) =>
    (await q<{ id: string }>(
      `INSERT INTO public.agent_tasks(tenant_id, agent, task, parent_task_id, depends_on, correlation_id)
       VALUES ($1,$2,'t',$3,$4::uuid[],$5) RETURNING id`,
      [extra.tenant ?? ids.tA, agent, extra.parent ?? null, extra.deps ?? [], extra.corr ?? null])).rows[0]!.id;

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `atc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`atc-A-${Date.now()}`); ids.tB = await tenant(`atc-B-${Date.now()}`);
    ids.uA = await user(); ids.uB = await user(); ids.uE = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner'),($1,$5,'editor')`,
      [ids.tA, ids.uA, ids.tB, ids.uB, ids.uE]);
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('bestehende Inserts ohne neue Felder funktionieren weiter', async () => {
    const id = await task('a');
    const r = await q(`SELECT board_status, depends_on, evidence FROM public.agent_tasks WHERE id=$1`, [id]);
    expect(r.rows[0]).toEqual({ board_status: null, depends_on: [], evidence: [] });
  });

  it('Korrelations-ID: dieselbe Nachricht nur einmal offen je Agent', async () => {
    const corr = '11111111-1111-4111-8111-111111111111';
    await task('a', { corr });
    await expect(tryq(`INSERT INTO public.agent_tasks(tenant_id, agent, task, correlation_id) VALUES ($1,'a','t',$2)`, [ids.tA, corr]))
      .rejects.toThrow(/agent_tasks_correlation_open_uniq/);
    await task('b', { corr }); // anderer Agent erlaubt
  });

  it('zirkuläre Delegation A→B→A wird abgewiesen; Selbst-Unteraufgabe erlaubt', async () => {
    const a = await task('a');
    const b = await task('b', { parent: a });
    await expect(tryq(`INSERT INTO public.agent_tasks(tenant_id, agent, task, parent_task_id) VALUES ($1,'a','t',$2)`, [ids.tA, b]))
      .rejects.toThrow(/Zirkuläre Delegation/);
    await task('b', { parent: b });
  });

  it('Elternzyklus per UPDATE und mandantenübergreifende Delegation abgewiesen', async () => {
    const a = await task('a');
    const b = await task('b', { parent: a });
    await expect(tryq(`UPDATE public.agent_tasks SET parent_task_id=$1 WHERE id=$2`, [b, a])).rejects.toThrow(/zyklus/i);
    await expect(tryq(`UPDATE public.agent_tasks SET parent_task_id=id WHERE id=$1`, [a])).rejects.toThrow(/eigener Elternteil/);
    await expect(tryq(`INSERT INTO public.agent_tasks(tenant_id, agent, task, parent_task_id) VALUES ($1,'c','t',$2)`, [ids.tB, a]))
      .rejects.toThrow(/Mandantengrenzen/);
  });

  it('Kettenlänge begrenzt (10 Ebenen)', async () => {
    let p = await task('x0');
    for (let i = 1; i < 10; i++) p = await task(`x${i}`, { parent: p });
    await expect(tryq(`INSERT INTO public.agent_tasks(tenant_id, agent, task, parent_task_id) VALUES ($1,'x10','t',$2)`, [ids.tA, p]))
      .rejects.toThrow(/zu lang/);
  });

  it('Abhängigkeitszyklen und fremde Abhängigkeiten abgewiesen', async () => {
    const a = await task('a');
    const b = await task('b', { deps: [a] });
    await expect(tryq(`UPDATE public.agent_tasks SET depends_on=ARRAY[$1::uuid] WHERE id=$2`, [b, a])).rejects.toThrow(/Abhängigkeitszyklus/);
    await expect(tryq(`UPDATE public.agent_tasks SET depends_on=ARRAY[id] WHERE id=$1`, [a])).rejects.toThrow(/von sich selbst/);
    const foreign = await task('z', { tenant: ids.tB });
    await expect(tryq(`UPDATE public.agent_tasks SET depends_on=ARRAY[$1::uuid] WHERE id=$2`, [foreign, a])).rejects.toThrow(/nicht im selben Mandanten/);
  });

  it('claim: nur ein Agent gleichzeitig, Lease-Ablauf und Release; Ereignisse protokolliert', async () => {
    const t = await task('a');
    const claim = (agent: string) => asKeep(null, async () =>
      (await q<{ ok: boolean }>(`SELECT public.claim_agent_task($1,$2,60) ok`, [t, agent])).rows[0]!.ok, 'service_role');
    expect(await claim('a')).toBe(true);
    expect(await claim('b')).toBe(false);
    expect(await claim('a')).toBe(true); // Verlängerung
    await q(`UPDATE public.agent_tasks SET claim_expires_at = now() - interval '1 second' WHERE id=$1`, [t]);
    expect(await claim('b')).toBe(true);
    const rel = await asKeep(null, async () => (await q<{ ok: boolean }>(`SELECT public.release_agent_task($1,'a') ok`, [t])).rows[0]!.ok, 'service_role');
    expect(rel).toBe(false);
    const ev = await q<{ event_type: string }>(`SELECT event_type FROM public.agent_events WHERE subject_id=$1 ORDER BY id`, [t]);
    expect(ev.rows.map((r) => r.event_type)).toEqual(['task.claimed', 'task.claim_rejected', 'task.claimed', 'task.claimed']);
    const st = await q(`SELECT status, board_status, claimed_by FROM public.agent_tasks WHERE id=$1`, [t]);
    expect(st.rows[0]).toEqual({ status: 'in_progress', board_status: 'in_progress', claimed_by: 'b' });
  });

  it('claim/move: Editor, fremder Owner und anon abgewiesen', async () => {
    const t = await task('a');
    await expect(as(ids.uE, () => q(`SELECT public.claim_agent_task($1,'a',60)`, [t]))).rejects.toThrow(/Owner\/Admin/);
    await expect(as(ids.uB, () => q(`SELECT public.move_agent_task($1,'planned')`, [t]))).rejects.toThrow(/Owner\/Admin/);
    await expect(as(null, () => q(`SELECT public.move_agent_task($1,'planned')`, [t]), 'anon')).rejects.toThrow(/permission denied/);
  });

  it('move: ERLEDIGT nur mit Prüfnachweis; Status-Mapping und Ereignis', async () => {
    const t = await task('a');
    await expect(as(ids.uA, () => q(`SELECT public.move_agent_task($1,'done')`, [t]))).rejects.toThrow(/Prüfnachweis/);
    await asKeep(ids.uA, () => q(`SELECT public.move_agent_task($1,'awaiting_decision',NULL,'wartet auf L4')`, [t]));
    expect((await q(`SELECT status, blocker_reason FROM public.agent_tasks WHERE id=$1`, [t])).rows[0])
      .toEqual({ status: 'blocked', blocker_reason: 'wartet auf L4' });
    await asKeep(ids.uA, () => q(`SELECT public.move_agent_task($1,'done',$2::jsonb)`, [t, JSON.stringify([{ kind: 'pr', ref: '#1' }])]));
    const r = await q<{ status: string; board_status: string; n: number }>(
      `SELECT status, board_status, jsonb_array_length(evidence) n FROM public.agent_tasks WHERE id=$1`, [t]);
    expect(r.rows[0]).toEqual({ status: 'done', board_status: 'done', n: 1 });
    await expect(tryq(`UPDATE public.agent_tasks SET evidence='[]' WHERE id=$1`, [t])).rejects.toThrow(/done_needs_evidence/);
    const ev = await q(`SELECT 1 FROM public.agent_events WHERE subject_id=$1 AND event_type='task.moved'`, [t]);
    expect(ev.rowCount).toBe(2);
  });
});
