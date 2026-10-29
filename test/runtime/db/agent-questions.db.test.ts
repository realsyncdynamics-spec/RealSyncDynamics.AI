/**
 * agent_questions / agent_question_events (M2 Decision Inbox) — RLS & Historie.
 * Geprüft unter echten Rollen (authenticated mit JWT-Claims, anon).
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_questions RLS', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('agent_questions RLS & Historie', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; uA: string; uB: string; qA: string };
  const q = <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, p: unknown[] = []) =>
    ctx!.client.query<T>(sql, p);

  async function as<T>(role: 'anon' | 'authenticated', sub: string | null, fn: () => Promise<T>): Promise<T> {
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
  const denied = /row-level security|permission denied/i;

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (n: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [n])).rows[0]!.id;
    const user = async () =>
      (await q<{ id: string }>(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [
        `aq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`,
      ])).rows[0]!.id;
    ids.tA = await tenant(`aq-A-${Date.now()}`);
    ids.tB = await tenant(`aq-B-${Date.now()}`);
    ids.uA = await user();
    ids.uB = await user();
    await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'),($3,$4,'owner')`,
      [ids.tA, ids.uA, ids.tB, ids.uB]);
    ids.qA = (await q<{ id: string }>(
      `INSERT INTO public.agent_questions(tenant_id, agent_ref, question, priority, dedupe_key)
       VALUES ($1, 'grok:github-bot', 'Soll PR X gemergt werden?', 'P1', '') RETURNING id`, [ids.tA],
    )).rows[0]!.id;
  });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('Mitglied A liest eigene Frage, Mitglied B nicht, anon gar nicht', async () => {
    const sel = `SELECT id FROM public.agent_questions WHERE id = $1`;
    expect((await as('authenticated', ids.uA, () => q(sel, [ids.qA]))).rowCount).toBe(1);
    expect((await as('authenticated', ids.uB, () => q(sel, [ids.qA]))).rowCount).toBe(0);
    await expect(as('anon', null, () => q(sel, [ids.qA]))).rejects.toThrow(denied);
  });

  it('B kann keine Frage im Mandanten A anlegen', async () => {
    await expect(as('authenticated', ids.uB, () => q(
      `INSERT INTO public.agent_questions(tenant_id, agent_ref, question) VALUES ($1,'x','Fremde Frage?')`, [ids.tA],
    ))).rejects.toThrow(denied);
  });

  it('B kann Frage von A nicht ändern; niemand (authenticated) kann löschen', async () => {
    const upd = await as('authenticated', ids.uB, () =>
      q(`UPDATE public.agent_questions SET status='deferred' WHERE id=$1`, [ids.qA]));
    expect(upd.rowCount).toBe(0);
    await expect(as('authenticated', ids.uA, () =>
      q(`DELETE FROM public.agent_questions WHERE id=$1`, [ids.qA]))).rejects.toThrow(denied);
  });

  it('dedupe_key wird aus normalisierter Frage gesetzt; Inhalt unveränderlich', async () => {
    const other = (await q<{ dedupe_key: string }>(
      `INSERT INTO public.agent_questions(tenant_id, agent_ref, question) VALUES ($1,'grok:rsd-backend','  soll pr x   GEMERGT werden? ')
       RETURNING dedupe_key`, [ids.tA])).rows[0]!.dedupe_key;
    const orig = (await q<{ dedupe_key: string }>(`SELECT dedupe_key FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!.dedupe_key;
    expect(other).toBe(orig);
    await as('authenticated', ids.uA, () =>
      q(`UPDATE public.agent_questions SET question='geändert', tenant_id=$2 WHERE id=$1`, [ids.qA, ids.tB]));
    const row = (await q<{ question: string; tenant_id: string }>(`SELECT question, tenant_id FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!;
    expect(row.question).toBe('Soll PR X gemergt werden?');
    expect(row.tenant_id).toBe(ids.tA);
  });

  it('Historie: created + status_changed, für B unsichtbar, nicht direkt beschreibbar', async () => {
    await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ids.uA, role: 'authenticated' })]);
    await q(`SET LOCAL ROLE authenticated`);
    await q(`UPDATE public.agent_questions SET status='deferred' WHERE id=$1`, [ids.qA]);
    await q(`RESET ROLE`);
    const ev = await as('authenticated', ids.uA, () => q<{ event_type: string; to_value: string }>(
      `SELECT event_type, to_value FROM public.agent_question_events WHERE question_id=$1 ORDER BY created_at, event_type`, [ids.qA]));
    expect(ev.rows.map((r) => `${r.event_type}:${r.to_value}`).sort()).toEqual(['created:open', 'status_changed:deferred']);
    const resolved = (await q<{ resolved_by: string | null }>(`SELECT resolved_by FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!;
    expect(resolved.resolved_by).toBe(ids.uA);
    expect((await as('authenticated', ids.uB, () =>
      q(`SELECT 1 FROM public.agent_question_events WHERE question_id=$1`, [ids.qA]))).rowCount).toBe(0);
    await expect(as('authenticated', ids.uA, () => q(
      `INSERT INTO public.agent_question_events(question_id, tenant_id, event_type) VALUES ($1,$2,'created')`, [ids.qA, ids.tA],
    ))).rejects.toThrow(denied);
  });

  it('neue Fragen starten immer als open (kein vorab "answered")', async () => {
    const s = (await q<{ status: string }>(
      `INSERT INTO public.agent_questions(tenant_id, agent_ref, question, status) VALUES ($1,'x','Vorab beantwortet?','answered') RETURNING status`,
      [ids.tA])).rows[0]!.status;
    expect(s).toBe('open');
  });
});
