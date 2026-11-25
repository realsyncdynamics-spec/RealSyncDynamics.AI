/**
 * bot_appointments — Migration 20261125190000_bot_appointments_writer_policy_dedupe.sql
 *
 * 1. Ändern nur für schreibende Rollen (is_tenant_writer: owner, admin, dpo,
 *    editor). Vorher durfte jedes Mitglied ändern, auch viewer_auditor.
 * 2. Partieller Unique-Index: eine offene Anfrage je Konversation, Name und
 *    Wunschtermin. Folgetermine, Anfragen ohne Konversation und erneute
 *    Anfragen nach Bestätigung/Absage bleiben möglich.
 *
 * Geprüft wird die WIRKUNG unter echten Rollen gegen das voll migrierte
 * Schema. Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die
 * Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('bot_appointments writer policy + dedupe', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = { kind: 'anon' } | { kind: 'service' } | { kind: 'user'; userId: string };
type Outcome = 'allow' | 'deny';

d('bot_appointments writer policy + dedupe', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as {
    tA: string; tB: string; botA: string; convA: string; appt: string;
    owner: string; admin: string; dpo: string; editor: string; viewer: string; ownerB: string;
  };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

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

  /** Insert als Service-Role; liefert 'ok' oder 'duplicate' (23505). */
  async function insertAsService(conv: string | null, name: string, at: string | null): Promise<'ok' | 'duplicate'> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
      await q(`SET LOCAL ROLE service_role`);
      await q(
        `INSERT INTO public.bot_appointments (tenant_id, bot_id, conversation_id, customer_name, requested_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [ids.tA, ids.botA, conv, name, at],
      );
      await q(`RELEASE SAVEPOINT ${sp}`);
      return 'ok';
    } catch (err) {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      if ((err as { code?: string }).code === '23505') return 'duplicate';
      throw err;
    } finally {
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
        [`appt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;
    const member = async (tenantId: string, userId: string, role: string) => {
      await q(`INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,$3)`, [tenantId, userId, role]);
    };

    ids.tA = await tenant(`appt-A-${Date.now()}`);
    ids.tB = await tenant(`appt-B-${Date.now()}`);
    for (const k of ['owner', 'admin', 'dpo', 'editor', 'viewer', 'ownerB'] as const) ids[k] = await mkUser();
    await member(ids.tA, ids.owner, 'owner');
    await member(ids.tA, ids.admin, 'admin');
    await member(ids.tA, ids.dpo, 'dpo');
    await member(ids.tA, ids.editor, 'editor');
    await member(ids.tA, ids.viewer, 'viewer_auditor');
    await member(ids.tB, ids.ownerB, 'owner');

    ids.botA = (await q<{ id: string }>(
      `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Termin-Bot') RETURNING id`, [ids.tA],
    )).rows[0]!.id;
    ids.convA = (await q<{ id: string }>(
      `INSERT INTO public.bot_conversations (tenant_id, bot_id) VALUES ($1, $2) RETURNING id`, [ids.tA, ids.botA],
    )).rows[0]!.id;
    ids.appt = (await q<{ id: string }>(
      `INSERT INTO public.bot_appointments (tenant_id, bot_id, customer_name) VALUES ($1, $2, 'Max') RETURNING id`,
      [ids.tA, ids.botA],
    )).rows[0]!.id;
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('Ändern: owner, admin, dpo, editor dürfen — viewer_auditor, fremder Mandant und anon nicht', async () => {
    const upd = `UPDATE public.bot_appointments SET status = 'confirmed' WHERE id = $1`;
    for (const who of [ids.owner, ids.admin, ids.dpo, ids.editor]) {
      expect(await attempt(user(who), upd, [ids.appt]), who).toBe('allow');
    }
    expect(await attempt(user(ids.viewer), upd, [ids.appt])).toBe('deny');
    expect(await attempt(user(ids.ownerB), upd, [ids.appt])).toBe('deny');
    expect(await attempt({ kind: 'anon' }, upd, [ids.appt])).toBe('deny');
  });

  it('Lesen bleibt für alle Mitglieder des Mandanten, nicht für fremde', async () => {
    const sel = `SELECT 1 FROM public.bot_appointments WHERE id = $1`;
    for (const who of [ids.owner, ids.editor, ids.viewer]) expect(await attempt(user(who), sel, [ids.appt])).toBe('allow');
    expect(await attempt(user(ids.ownerB), sel, [ids.appt])).toBe('deny');
  });

  it('ein Termin lässt sich nicht in einen fremden Mandanten verschieben', async () => {
    const move = `UPDATE public.bot_appointments SET tenant_id = $2 WHERE id = $1`;
    expect(await attempt(user(ids.editor), move, [ids.appt, ids.tB])).toBe('deny');
  });

  it('kein direktes Anlegen durch Nutzer — nur über die Service-Role', async () => {
    const ins = `INSERT INTO public.bot_appointments (tenant_id, bot_id, customer_name) VALUES ($1, $2, 'X')`;
    for (const who of [ids.owner, ids.editor, ids.viewer]) {
      expect(await attempt(user(who), ins, [ids.tA, ids.botA])).toBe('deny');
    }
  });

  it('gleiche offene Anfrage derselben Konversation → 23505', async () => {
    const at = '2026-12-01T09:00:00Z';
    expect(await insertAsService(ids.convA, 'Max', at)).toBe('ok');
    expect(await insertAsService(ids.convA, 'Max', at)).toBe('duplicate');
    expect(await insertAsService(ids.convA, 'Max', null)).toBe('ok');
    expect(await insertAsService(ids.convA, 'Max', null)).toBe('duplicate');
  });

  it('Folgetermine, andere Namen und Anfragen ohne Konversation bleiben möglich', async () => {
    expect(await insertAsService(ids.convA, 'Max', '2026-12-01T09:00:00Z')).toBe('ok');
    expect(await insertAsService(ids.convA, 'Max', '2026-12-08T09:00:00Z')).toBe('ok');
    expect(await insertAsService(ids.convA, 'Erika', '2026-12-01T09:00:00Z')).toBe('ok');
    expect(await insertAsService(null, 'Max', '2026-12-01T09:00:00Z')).toBe('ok');
    expect(await insertAsService(null, 'Max', '2026-12-01T09:00:00Z')).toBe('ok');
  });

  it('nach Bestätigung oder Absage ist dieselbe Anfrage erneut möglich', async () => {
    const at = '2026-12-01T09:00:00Z';
    expect(await insertAsService(ids.convA, 'Max', at)).toBe('ok');
    await q(`UPDATE public.bot_appointments SET status = 'cancelled' WHERE conversation_id = $1`, [ids.convA]);
    expect(await insertAsService(ids.convA, 'Max', at)).toBe('ok');
    await q(`UPDATE public.bot_appointments SET status = 'confirmed' WHERE conversation_id = $1 AND status = 'requested'`, [ids.convA]);
    expect(await insertAsService(ids.convA, 'Max', at)).toBe('ok');
  });

  it('der Index ist partiell und trägt die erwartete Regel', async () => {
    const { rows } = await q<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'bot_appointments_open_conversation_uniq'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.indexdef).toMatch(/UNIQUE/);
    expect(rows[0]!.indexdef).toMatch(/status = 'requested'/);
    expect(rows[0]!.indexdef).toMatch(/conversation_id IS NOT NULL/);
  });
});

// Gleichzeitige Inserts brauchen getrennte Verbindungen (eigene Transaktionen);
// die Testdaten werden deshalb hier committet und am Ende wieder entfernt.
d('bot_appointments dedupe unter Parallelität', () => {
  it('10 gleichzeitige identische Inserts → genau 1 Zeile, 9 × 23505', async () => {
    const setup = new Client({ connectionString: dbUrl! });
    await setup.connect();
    const tag = `appt-par-${Date.now()}`;
    const t = (await setup.query<{ id: string }>(`INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`, [tag])).rows[0]!.id;
    try {
      const bot = (await setup.query<{ id: string }>(
        `INSERT INTO public.bots (tenant_id, name) VALUES ($1, 'Par-Bot') RETURNING id`, [t],
      )).rows[0]!.id;
      const conv = (await setup.query<{ id: string }>(
        `INSERT INTO public.bot_conversations (tenant_id, bot_id) VALUES ($1, $2) RETURNING id`, [t, bot],
      )).rows[0]!.id;

      const clients = await Promise.all(Array.from({ length: 10 }, async () => {
        const c = new Client({ connectionString: dbUrl! });
        await c.connect();
        return c;
      }));
      const results = await Promise.all(clients.map(async (c) => {
        try {
          await c.query(
            `INSERT INTO public.bot_appointments (tenant_id, bot_id, conversation_id, customer_name, requested_at)
             VALUES ($1, $2, $3, 'Para', '2026-12-24T10:00:00Z')`,
            [t, bot, conv],
          );
          return 'ok';
        } catch (err) {
          return (err as { code?: string }).code === '23505' ? 'duplicate' : String((err as Error).message);
        } finally {
          await c.end();
        }
      }));
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(results.filter((r) => r === 'duplicate')).toHaveLength(9);
      const { rows } = await setup.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM public.bot_appointments WHERE tenant_id = $1`, [t],
      );
      expect(rows[0]!.n).toBe('1');
    } finally {
      await setup.query(`DELETE FROM public.tenants WHERE id = $1`, [t]);
      await setup.end();
    }
  }, 30_000);
});
