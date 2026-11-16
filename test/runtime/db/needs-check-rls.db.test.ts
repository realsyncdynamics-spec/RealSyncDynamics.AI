/**
 * Bedarfs-Check: Zugriffsregeln gegen echtes Postgres
 * (20261115200000_needs_check_results.sql).
 *
 *   - Nutzer liest, speichert und löscht nur eigene Ergebnisse
 *   - fremde Ergebnisse: nicht lesbar, nicht löschbar
 *   - anon: kein Zugriff
 *   - kein UPDATE
 *   - ungültige Werte scheitern an den CHECK-Constraints
 *   - höchstens 20 Ergebnisse je Nutzer und 24 Stunden
 */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';
import { describe } from 'vitest';

const d = requireDbOrFail('needs-check-rls') ? describe : describe.skip;

type Outcome = 'allow' | 'deny';

d('needs_check_results RLS', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  async function as(role: 'authenticated' | 'anon', userId: string | null, sql: string, params: unknown[] = []): Promise<{ outcome: Outcome; rows: number; error?: string }> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await ctx!.client.query(`SAVEPOINT ${sp}`);
    try {
      await ctx!.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      await ctx!.client.query(`SET LOCAL ROLE ${role}`);
      const res = await ctx!.client.query(sql, params);
      return { outcome: (res.rowCount ?? 0) > 0 ? 'allow' : 'deny', rows: res.rowCount ?? 0 };
    } catch (err) {
      const msg = String((err as Error).message);
      if (/row-level security|permission denied|violates check constraint|needs_check_rate_limited/i.test(msg)) {
        return { outcome: 'deny', rows: 0, error: msg };
      }
      throw err;
    } finally {
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await ctx!.client.query(`RESET ROLE`);
    }
  }

  async function mkUser(tag: string): Promise<string> {
    const r = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
      [`nc_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`],
    );
    return r.rows[0]!.id;
  }

  async function seedRow(userId: string): Promise<string> {
    const r = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.needs_check_results(user_id, goal, area, has_website, recommendation_ids)
       VALUES ($1, 'website', 'handwerk', false, ARRAY['build.new_site']) RETURNING id`,
      [userId],
    );
    return r.rows[0]!.id;
  }

  const INSERT_OWN = `INSERT INTO public.needs_check_results(goal, area, has_website, recommendation_ids)
                      VALUES ('rules', 'kanzlei', false, ARRAY['govern.runtime']) RETURNING id`;

  it('eigener Nutzer: speichern und lesen erlaubt', async () => {
    const u = await mkUser('own');
    expect((await as('authenticated', u, INSERT_OWN)).outcome).toBe('allow');
    const id = await seedRow(u);
    expect((await as('authenticated', u, `SELECT id FROM public.needs_check_results WHERE id = $1`, [id])).outcome).toBe('allow');
  });

  it('fremder Nutzer: lesen und löschen abgewiesen', async () => {
    const owner = await mkUser('owner');
    const other = await mkUser('other');
    const id = await seedRow(owner);
    expect((await as('authenticated', other, `SELECT id FROM public.needs_check_results WHERE id = $1`, [id])).outcome).toBe('deny');
    expect((await as('authenticated', other, `DELETE FROM public.needs_check_results WHERE id = $1`, [id])).outcome).toBe('deny');
    expect((await as('authenticated', owner, `DELETE FROM public.needs_check_results WHERE id = $1`, [id])).outcome).toBe('allow');
  });

  it('fremde user_id beim Speichern wird abgewiesen', async () => {
    const me = await mkUser('me');
    const victim = await mkUser('victim');
    const r = await as('authenticated', me,
      `INSERT INTO public.needs_check_results(user_id, goal, area, has_website, recommendation_ids)
       VALUES ($1, 'rules', 'kanzlei', false, ARRAY['govern.runtime']) RETURNING id`, [victim]);
    expect(r.outcome).toBe('deny');
  });

  it('anon: weder lesen noch speichern', async () => {
    const u = await mkUser('anon-target');
    await seedRow(u);
    expect((await as('anon', null, `SELECT id FROM public.needs_check_results`)).outcome).toBe('deny');
    expect((await as('anon', null, INSERT_OWN)).outcome).toBe('deny');
  });

  it('kein UPDATE, auch nicht für den Eigentümer', async () => {
    const u = await mkUser('upd');
    const id = await seedRow(u);
    const r = await as('authenticated', u, `UPDATE public.needs_check_results SET goal = 'rules' WHERE id = $1`, [id]);
    expect(r.outcome).toBe('deny');
  });

  it('ungültige Werte scheitern an den CHECK-Constraints', async () => {
    const u = await mkUser('chk');
    const bad = [
      `INSERT INTO public.needs_check_results(goal, area, has_website, recommendation_ids) VALUES ('hack', 'kanzlei', false, ARRAY['govern.runtime'])`,
      `INSERT INTO public.needs_check_results(goal, area, has_website, recommendation_ids) VALUES ('rules', 'kanzlei', false, ARRAY['evil'])`,
      `INSERT INTO public.needs_check_results(goal, area, has_website, recommendation_ids) VALUES ('rules', 'kanzlei', false, ARRAY[]::text[])`,
      `INSERT INTO public.needs_check_results(goal, area, has_website, website_url, recommendation_ids) VALUES ('rules', 'kanzlei', false, 'https://x.de', ARRAY['govern.runtime'])`,
      `INSERT INTO public.needs_check_results(goal, area, has_website, website_url, recommendation_ids) VALUES ('rules', 'kanzlei', true, 'javascript:alert(1)', ARRAY['govern.runtime'])`,
      `INSERT INTO public.needs_check_results(goal, area, has_website, recommendation_ids, result_basis) VALUES ('rules', 'kanzlei', false, ARRAY['govern.runtime'], 'answers_and_scan')`,
    ];
    for (const sql of bad) expect((await as('authenticated', u, sql)).outcome).toBe('deny');
  });

  it('Tageslimit: das 21. Ergebnis innerhalb von 24 Stunden wird abgewiesen', async () => {
    const u = await mkUser('rate');
    for (let i = 0; i < 20; i += 1) await seedRow(u);
    const r = await as('authenticated', u, INSERT_OWN);
    expect(r.outcome).toBe('deny');
    expect(r.error).toMatch(/needs_check_rate_limited/);
  });
});
