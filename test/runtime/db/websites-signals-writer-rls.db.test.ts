/**
 * websites und security_signals — Schreiben nur mit schreibender Rolle und nur
 * die Spalten, die die Oberfläche setzt
 * (Migration 20261005150000_websites_security_signals_writer_rls.sql).
 *
 * Vorher: jedes Mitglied (auch viewer_auditor) legte Websites an, änderte
 * jede Spalte — darunter governance_asset_id auf das Asset eines FREMDEN
 * Mandanten (der Insert-Trigger prüft das, ein UPDATE nicht) — und änderte
 * jede Spalte eines Security-Signals.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('websites/security_signals Schreibrollen', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = { kind: 'anon' } | { kind: 'service' } | { kind: 'user'; userId: string };
type Outcome = 'allow' | 'deny';

d('websites/security_signals Schreibrollen', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as {
    tA: string; tB: string; owner: string; editor: string; viewer: string;
    siteA: string; foreignAsset: string; signalA: string;
  };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  /** Zeilen betroffen → allow; RLS-/Rechtefehler oder 0 Zeilen → deny. Jede Prüfung im Savepoint. */
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
        [`ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;

    ids.tA = await tenant(`ws-A-${Date.now()}`);
    ids.tB = await tenant(`ws-B-${Date.now()}`);
    for (const k of ['owner', 'editor', 'viewer'] as const) ids[k] = await mkUser();
    await q(
      `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner'), ($1,$3,'editor'), ($1,$4,'viewer_auditor')`,
      [ids.tA, ids.owner, ids.editor, ids.viewer],
    );

    ids.siteA = (await q<{ id: string }>(
      `INSERT INTO public.websites(tenant_id, domain, plan_tier, status) VALUES ($1, 'a.example', 'audit', 'lead') RETURNING id`,
      [ids.tA],
    )).rows[0]!.id;
    ids.foreignAsset = (await q<{ id: string }>(
      `INSERT INTO public.governance_assets(tenant_id, asset_type, name) VALUES ($1, 'website', 'b.example') RETURNING id`,
      [ids.tB],
    )).rows[0]!.id;
    ids.signalA = (await q<{ id: string }>(
      `INSERT INTO public.security_signals(tenant_id, provider, external_id, title, severity) VALUES ($1, 'wazuh', 'x-1', 'Login-Anomalie', 'high') RETURNING id`,
      [ids.tA],
    )).rows[0]!.id;
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  describe('websites', () => {
    const insert = (domain: string, tier = 'audit', status = 'lead') =>
      [`INSERT INTO public.websites(tenant_id, domain, plan_tier, status) VALUES ($1, $2, $3, $4)`, domain, tier, status] as const;

    it('anlegen: owner/editor ja, viewer_auditor nein, anon nein', async () => {
      const [sql] = insert('x');
      expect(await attempt(user(ids.owner), sql, [ids.tA, 'o.example', 'audit', 'lead'])).toBe('allow');
      expect(await attempt(user(ids.editor), sql, [ids.tA, 'e.example', 'audit', 'lead'])).toBe('allow');
      expect(await attempt(user(ids.viewer), sql, [ids.tA, 'v.example', 'audit', 'lead'])).toBe('deny');
      expect(await attempt({ kind: 'anon' }, sql, [ids.tA, 'n.example', 'audit', 'lead'])).toBe('deny');
    });

    it('anlegen nur als audit/lead — kein bezahlter Tarif, kein anderer Status', async () => {
      const [sql] = insert('x');
      expect(await attempt(user(ids.owner), sql, [ids.tA, 'm.example', 'managed', 'lead'])).toBe('deny');
      expect(await attempt(user(ids.owner), sql, [ids.tA, 'l.example', 'audit', 'live'])).toBe('deny');
    });

    it('kein Asset und keine Server-Spalten beim Anlegen', async () => {
      expect(await attempt(user(ids.owner),
        `INSERT INTO public.websites(tenant_id, domain, plan_tier, status, deployment_ip) VALUES ($1,'d.example','audit','lead','10.0.0.1')`,
        [ids.tA])).toBe('deny');
    });

    it('kein Client-UPDATE — auch nicht das Umhängen auf ein fremdes Asset', async () => {
      for (const who of [ids.owner, ids.editor, ids.viewer]) {
        expect(await attempt(user(who), `UPDATE public.websites SET governance_asset_id = $2 WHERE id = $1`, [ids.siteA, ids.foreignAsset])).toBe('deny');
        expect(await attempt(user(who), `UPDATE public.websites SET plan_tier = 'managed' WHERE id = $1`, [ids.siteA])).toBe('deny');
      }
      expect(await attempt({ kind: 'service' }, `UPDATE public.websites SET status = 'audit_done' WHERE id = $1`, [ids.siteA])).toBe('allow');
    });

    it('löschen: schreibende Rollen ja, viewer_auditor nein', async () => {
      const del = `DELETE FROM public.websites WHERE id = $1`;
      expect(await attempt(user(ids.viewer), del, [ids.siteA])).toBe('deny');
      expect(await attempt(user(ids.editor), del, [ids.siteA])).toBe('allow');
    });

    it('lesen bleibt für alle Mitglieder', async () => {
      expect(await attempt(user(ids.viewer), `SELECT 1 FROM public.websites WHERE id = $1`, [ids.siteA])).toBe('allow');
    });
  });

  describe('security_signals', () => {
    it('Status setzen: schreibende Rollen ja, viewer_auditor nein', async () => {
      const upd = `UPDATE public.security_signals SET status = 'in_review' WHERE id = $1`;
      expect(await attempt(user(ids.viewer), upd, [ids.signalA])).toBe('deny');
      expect(await attempt(user(ids.editor), upd, [ids.signalA])).toBe('allow');
      expect(await attempt(user(ids.owner), upd, [ids.signalA])).toBe('allow');
    });

    it('andere Spalten nur der Server — Schwere, Payload, Mandant', async () => {
      for (const set of [`severity = 'info'`, `raw_payload = '{}'::jsonb`, `title = 'x'`]) {
        expect(await attempt(user(ids.owner), `UPDATE public.security_signals SET ${set} WHERE id = $1`, [ids.signalA])).toBe('deny');
      }
      expect(await attempt({ kind: 'service' }, `UPDATE public.security_signals SET severity = 'info' WHERE id = $1`, [ids.signalA])).toBe('allow');
    });
  });
});
