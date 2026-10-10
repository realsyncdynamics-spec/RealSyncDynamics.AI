/**
 * ai_act_risk_inventory — Schreiben nur über die Edge Function
 * (Migration 20261005120000_ai_act_risk_inventory_writes_via_function.sql).
 *
 * Vorher durfte jedes Mitglied — auch viewer_auditor — direkt per PostgREST
 * anlegen, ändern und löschen, am Entitlement-Gate der Function vorbei.
 * Geprüft wird die WIRKUNG unter echten Rollen, nicht die Policy-Liste.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('ai_act_risk_inventory RLS', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = { kind: 'anon' } | { kind: 'service' } | { kind: 'user'; userId: string };
type Outcome = 'allow' | 'deny';

d('ai_act_risk_inventory RLS', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { tA: string; tB: string; owner: string; editor: string; viewer: string; ownerB: string; rowA: string };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  /** Zeilen betroffen/gelesen → allow; RLS-/Rechtefehler oder 0 Zeilen → deny. Jede Prüfung im Savepoint. */
  async function attempt(actor: Actor, sql: string, params: unknown[] = []): Promise<Outcome> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      if (actor.kind === 'anon') {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
        await q(`SET LOCAL ROLE anon`);
      } else if (actor.kind === 'service') {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
        await q(`SET LOCAL ROLE service_role`);
      } else {
        await q(`SELECT set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: actor.userId, role: 'authenticated' }),
        ]);
        await q(`SET LOCAL ROLE authenticated`);
      }
      const res = await q(sql, params);
      return (res.rowCount ?? 0) > 0 ? 'allow' : 'deny';
    } catch (err) {
      if (/row-level security|permission denied/i.test(String((err as Error).message))) return 'deny';
      throw err;
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  const user = (userId: string): Actor => ({ kind: 'user', userId });

  beforeEach(async () => {
    ctx = await openDb();
    const tenant = async (name: string) =>
      (await q<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [name])).rows[0]!.id;
    const mkUser = async () =>
      (await q<{ id: string }>(
        `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
        [`inv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;
    const member = async (tenantId: string, userId: string, role: string) => {
      await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,$3)`, [tenantId, userId, role]);
    };

    ids.tA = await tenant(`inv-A-${Date.now()}`);
    ids.tB = await tenant(`inv-B-${Date.now()}`);
    for (const k of ['owner', 'editor', 'viewer', 'ownerB'] as const) ids[k] = await mkUser();
    await member(ids.tA, ids.owner, 'owner');
    await member(ids.tA, ids.editor, 'editor');
    await member(ids.tA, ids.viewer, 'viewer_auditor');
    await member(ids.tB, ids.ownerB, 'owner');

    ids.rowA = (await q<{ id: string }>(
      `INSERT INTO public.ai_act_risk_inventory(tenant_id, name, severity) VALUES ($1, 'HR-Screening', 'high') RETURNING id`,
      [ids.tA],
    )).rows[0]!.id;
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('Lesen: Mitglieder des eigenen Mandanten — nicht fremde Mandanten, nicht anon', async () => {
    const sel = `SELECT 1 FROM public.ai_act_risk_inventory WHERE id = $1`;
    for (const who of [ids.owner, ids.editor, ids.viewer]) expect(await attempt(user(who), sel, [ids.rowA])).toBe('allow');
    expect(await attempt(user(ids.ownerB), sel, [ids.rowA])).toBe('deny');
    expect(await attempt({ kind: 'anon' }, sel, [ids.rowA])).toBe('deny');
  });

  it('kein direktes Anlegen — auch nicht für Owner oder Editor (nur über die Function)', async () => {
    const ins = `INSERT INTO public.ai_act_risk_inventory(tenant_id, name, severity) VALUES ($1, 'x', 'minimal')`;
    for (const who of [ids.owner, ids.editor, ids.viewer]) expect(await attempt(user(who), ins, [ids.tA])).toBe('deny');
    expect(await attempt({ kind: 'anon' }, ins, [ids.tA])).toBe('deny');
  });

  it('kein direktes Ändern oder Löschen — vorher konnte viewer_auditor beides', async () => {
    const upd = `UPDATE public.ai_act_risk_inventory SET severity = 'minimal' WHERE id = $1`;
    const del = `DELETE FROM public.ai_act_risk_inventory WHERE id = $1`;
    for (const who of [ids.owner, ids.editor, ids.viewer]) {
      expect(await attempt(user(who), upd, [ids.rowA])).toBe('deny');
      expect(await attempt(user(who), del, [ids.rowA])).toBe('deny');
    }
    const [{ severity }] = (await q<{ severity: string }>(
      `SELECT severity FROM public.ai_act_risk_inventory WHERE id = $1`, [ids.rowA],
    )).rows as Array<{ severity: string }>;
    expect(severity).toBe('high');
  });

  it('service_role (die Edge Function) schreibt weiter', async () => {
    expect(await attempt({ kind: 'service' },
      `INSERT INTO public.ai_act_risk_inventory(tenant_id, name, severity) VALUES ($1, 'y', 'limited')`, [ids.tA])).toBe('allow');
    expect(await attempt({ kind: 'service' },
      `UPDATE public.ai_act_risk_inventory SET severity = 'minimal' WHERE id = $1`, [ids.rowA])).toBe('allow');
    expect(await attempt({ kind: 'service' },
      `DELETE FROM public.ai_act_risk_inventory WHERE id = $1`, [ids.rowA])).toBe('allow');
  });
});
