/**
 * agent_questions / agent_question_events (M2 Decision Inbox) — RLS & Historie.
 * Geprüft unter echten Rollen (authenticated mit JWT-Claims, anon).
 * Läuft nur mit gesetztem TEST_DB_URL.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('agent_decisions approval gate', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}
const d = dbUrl ? describe : describe.skip;

d('M4 Freigabe-Gate agent_decisions', () => {
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
  /** Wie as(), aber Wirkung bleibt bestehen (kein Rollback) — für Erfolgsfälle. */
  async function asKeep<T>(sub: string, fn: () => Promise<T>): Promise<T> {
    await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: 'authenticated' })]);
    await q(`SET LOCAL ROLE authenticated`);
    try { return await fn(); } finally { await q(`RESET ROLE`); }
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

  const proposal = async () => (await q<{ id: string }>(
    `INSERT INTO public.agent_decisions(tenant_id, decision_title, problem, options, recommendation, reason, proposed_by)
     VALUES ($1, 'Merge?', 'Soll PR X gemergt werden?', $2::jsonb, 'CI prüfen', 'Checks fehlen', 'grok:github-bot') RETURNING id`,
    [ids.tA, JSON.stringify([
      { label: 'CI prüfen', rationale: 'Checks fehlen', recommended: true },
      { label: 'Zurückstellen', rationale: 'offen' },
    ])])).rows[0]!.id;
  const link = (dec: string) => q(`UPDATE public.agent_questions SET decision_id=$2 WHERE id=$1`, [ids.qA, dec]);
  const rpc = (dec: string, action: string, opt: number | null, confirm: boolean) =>
    q(`SELECT * FROM public.resolve_agent_decision($1, $2, $3, 'L4', $4, 'Test')`, [dec, action, opt, confirm]);
  const decStatus = async (dec: string) =>
    (await q<{ status: string; approved_by: string | null }>(`SELECT status, approved_by FROM public.agent_decisions WHERE id=$1`, [dec])).rows[0]!;

  it('Owner kann NICHT direkt per UPDATE freigeben', async () => {
    const dec = await proposal();
    await expect(as('authenticated', ids.uA, () =>
      q(`UPDATE public.agent_decisions SET status='approved' WHERE id=$1`, [dec]))).rejects.toThrow(/resolve_agent_decision|permission/i);
    expect((await decStatus(dec)).status).toBe('proposed');
  });

  it('Owner kann keinen bereits freigegebenen Vorschlag anlegen', async () => {
    const st = await as('authenticated', ids.uA, async () => (await q<{ status: string }>(
      `INSERT INTO public.agent_decisions(tenant_id, decision_title, problem, options, recommendation, reason, proposed_by, status)
       VALUES ($1,'x','x','[]','x','x','x','approved') RETURNING status`, [ids.tA])).rows[0]!.status);
    expect(st).toBe('proposed');
  });

  it('Freigabe ohne Bestätigung wird abgelehnt', async () => {
    const dec = await proposal();
    await expect(as('authenticated', ids.uA, () => rpc(dec, 'approve', 0, false))).rejects.toThrow(/Bestätigung/);
    expect((await decStatus(dec)).status).toBe('proposed');
  });

  it('Freigabe über resolve_agent_decision: Status, Audit, Rückmeldung an Frage + Historie', async () => {
    const dec = await proposal();
    await link(dec);
    await asKeep(ids.uA, () => rpc(dec, 'approve', 0, true));
    const s = await decStatus(dec);
    expect(s.status).toBe('approved');
    expect(s.approved_by).toBe(ids.uA);
    const audit = (await q<{ action: string; chosen_label: string; actor: string; question_id: string; approval_level: string }>(
      `SELECT action, chosen_label, actor, question_id, approval_level FROM public.agent_decision_approvals WHERE decision_id=$1`, [dec])).rows;
    expect(audit).toEqual([{ action: 'approve', chosen_label: 'CI prüfen', actor: ids.uA, question_id: ids.qA, approval_level: 'L4' }]);
    const qs = (await q<{ status: string; resolution_note: string }>(`SELECT status, resolution_note FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!;
    expect(qs.status).toBe('answered');
    expect(qs.resolution_note).toBe('Test');
    const ev = (await q(`SELECT 1 FROM public.agent_question_events WHERE question_id=$1 AND event_type='status_changed' AND to_value='answered'`, [ids.qA])).rowCount;
    expect(ev).toBe(1);
  });

  it('Zurückstellen: Entscheidung bleibt offen, Frage deferred, Audit vorhanden', async () => {
    const dec = await proposal();
    await link(dec);
    await asKeep(ids.uA, () => rpc(dec, 'defer', null, false));
    expect((await decStatus(dec)).status).toBe('proposed');
    expect((await q<{ status: string }>(`SELECT status FROM public.agent_questions WHERE id=$1`, [ids.qA])).rows[0]!.status).toBe('deferred');
    expect((await q(`SELECT 1 FROM public.agent_decision_approvals WHERE decision_id=$1 AND action='defer'`, [dec])).rowCount).toBe(1);
  });

  it('Fremder Mandant (B) kann nicht freigeben; anon kann die Funktion nicht aufrufen', async () => {
    const dec = await proposal();
    await expect(as('authenticated', ids.uB, () => rpc(dec, 'approve', 0, true))).rejects.toThrow(/Owner\/Admin|nicht gefunden/);
    await expect(as('anon', null, () => rpc(dec, 'approve', 0, true))).rejects.toThrow(/permission denied/i);
    expect((await decStatus(dec)).status).toBe('proposed');
  });

  it('Doppelte Freigabe ist nicht möglich; ungültige Option wird abgelehnt', async () => {
    const dec = await proposal();
    await expect(as('authenticated', ids.uA, () => rpc(dec, 'approve', 5, true))).rejects.toThrow(/Option/);
    await asKeep(ids.uA, () => rpc(dec, 'approve', 1, true));
    await expect(as('authenticated', ids.uA, () => rpc(dec, 'approve', 0, true))).rejects.toThrow(/nicht mehr offen/);
  });

  it('Audit ist für Clients nicht schreibbar', async () => {
    const dec = await proposal();
    await expect(as('authenticated', ids.uA, () => q(
      `INSERT INTO public.agent_decision_approvals(tenant_id, decision_id, action, approval_level, actor) VALUES ($1,$2,'approve','L1',$3)`,
      [ids.tA, dec, ids.uA]))).rejects.toThrow(denied);
  });
});
