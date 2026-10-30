/**
 * agent_questions / agent_question_events (M2 Decision Inbox) — RLS & Historie.
 * Geprüft unter echten Rollen (authenticated mit JWT-Claims, anon).
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_decisions proposals RLS', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('agent_decisions Vorschläge (M3) über agent_questions', () => {
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

  const proposal = (tenant: string) => q<{ id: string }>(
    `INSERT INTO public.agent_decisions(tenant_id, decision_title, problem, options, recommendation, reason, proposed_by)
     VALUES ($1, 'Merge?', 'Soll PR X gemergt werden?', $2::jsonb, 'CI prüfen', 'Checks fehlen', 'grok:github-bot') RETURNING id`,
    [tenant, JSON.stringify([{ label: 'CI prüfen', rationale: 'Checks fehlen', recommended: true }])]);

  it('Owner A legt Vorschlag an (Status proposed) und verknüpft ihn mit der Frage', async () => {
    const out = await as('authenticated', ids.uA, async () => {
      const dec = (await proposal(ids.tA)).rows[0]!.id;
      await q(`UPDATE public.agent_questions SET decision_id=$2 WHERE id=$1`, [ids.qA, dec]);
      return (await q<{ decision_id: string; status: string }>(
        `SELECT q.decision_id, d.status FROM public.agent_questions q JOIN public.agent_decisions d ON d.id=q.decision_id WHERE q.id=$1`, [ids.qA])).rows[0];
    });
    expect(out?.status).toBe('proposed');
  });

  it('B kann keinen Vorschlag im Mandanten A anlegen und sieht As Vorschläge nicht', async () => {
    await expect(as('authenticated', ids.uB, () => proposal(ids.tA))).rejects.toThrow(denied);
    const dec = (await proposal(ids.tA)).rows[0]!.id;
    expect((await as('authenticated', ids.uB, () => q(`SELECT 1 FROM public.agent_decisions WHERE id=$1`, [dec]))).rowCount).toBe(0);
  });

  it('Verknüpfen einer Frage ändert ihren Status nicht (kein Auto-Answer)', async () => {
    const st = await as('authenticated', ids.uA, async () => {
      const dec = (await proposal(ids.tA)).rows[0]!.id;
      await q(`UPDATE public.agent_questions SET decision_id=$2 WHERE id=$1`, [ids.qA, dec]);
      return (await q<{ status: string }>(`SELECT status FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!.status;
    });
    expect(st).toBe('open');
  });
});
