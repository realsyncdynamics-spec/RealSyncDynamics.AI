/**
 * Bedarfs-Check: Zugriffsregeln und Kontingent gegen echtes Postgres nach
 * 20261115200000_needs_check_results.sql (Erstfassung, #2262) und
 * 20261117190000_needs_check_results_hardening.sql (Härtung). Ersetzt den
 * früheren needs-check-rls.db.test.ts, der die Erstfassung prüfte (Client
 * setzt Empfehlungen, Limit zählt Zeilen) und deren Verhalten jetzt gewollt
 * abgelehnt wird.
 *
 *   - user_id, created_at, model_version, Empfehlungen und id setzt der Server;
 *     der Client darf nur die vier Angaben schreiben
 *   - keine Scan-Referenz: audit_id / result_basis nicht beschreibbar, per
 *     Trigger und CHECK auf „keine Prüfung“ festgelegt
 *   - fremde Ergebnisse: nicht lesbar, nicht löschbar; anon: kein Zugriff; kein UPDATE
 *   - Protokoll und Sperrzeile des Kontingents: für Nutzer unsichtbar
 *   - 20 erfolgreiche Speicherungen in rollierenden 24 h; Löschen gibt nichts frei;
 *     fehlgeschlagene Speicherungen zählen nicht
 *   - parallele Speicherungen (eigene Verbindungen, committed): genau 20
 *   - Parität needs_check_recommend() ↔ recommendIds() für alle Kombinationen
 *
 * Lokaler Zwilling ohne Node-Abhängigkeiten: scripts/test-db/needs-check-results.sh
 */
import { Client } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOALS, recommendIds } from '../../../shared/needs-check';
import { closeDb, getDbUrl, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('needs-check-results') ? describe : describe.skip;

type Outcome = { ok: true; rows: Array<Record<string, unknown>> } | { ok: false; error: string };

const INSERT_OWN = `INSERT INTO public.needs_check_results (goal, area, has_website)
                    VALUES ('rules', 'kanzlei', false) RETURNING id`;

d('needs_check_results — Rechte und Kontingent', () => {
  let ctx: DbCtx | null = null;

  beforeEach(async () => {
    ctx = await openDb();
  });
  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  async function as(role: 'authenticated' | 'anon', userId: string | null, sql: string, params: unknown[] = []): Promise<Outcome> {
    const c = ctx!.client;
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await c.query(`SAVEPOINT ${sp}`);
    try {
      await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      await c.query(`SET LOCAL ROLE ${role}`);
      const res = await c.query(sql, params);
      await c.query('RESET ROLE');
      await c.query(`RELEASE SAVEPOINT ${sp}`);
      return { ok: true, rows: res.rows };
    } catch (err) {
      await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await c.query('RESET ROLE');
      return { ok: false, error: String((err as Error).message) };
    }
  }
  const asUser = (uid: string, sql: string, params: unknown[] = []) => as('authenticated', uid, sql, params);

  async function mkUser(): Promise<string> {
    const r = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
      [`nc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
    );
    return r.rows[0]!.id;
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const r = await ctx!.client.query<{ n: string }>(sql, params);
    return Number(r.rows[0]!.n);
  }

  it('Server setzt user_id, Zeit, Modellversion und Empfehlungen', async () => {
    const u = await mkUser();
    const res = await asUser(u, INSERT_OWN);
    expect(res.ok).toBe(true);
    const row = await ctx!.client.query(
      `SELECT user_id, model_version, recommendation_ids, abs(extract(epoch FROM now() - created_at)) < 60 AS fresh
       FROM public.needs_check_results WHERE user_id = $1`,
      [u],
    );
    expect(row.rows[0]).toEqual({
      user_id: u,
      model_version: 1,
      recommendation_ids: recommendIds({ goal: 'rules', hasWebsite: false }),
      fresh: true,
    });
  });

  it.each([
    ['fremde user_id', `INSERT INTO public.needs_check_results (user_id, goal, area, has_website) VALUES (gen_random_uuid(), 'rules', 'kanzlei', false)`],
    ['eigener Zeitstempel', `INSERT INTO public.needs_check_results (created_at, goal, area, has_website) VALUES (now() - interval '2 days', 'rules', 'kanzlei', false)`],
    ['eigene Empfehlungen', `INSERT INTO public.needs_check_results (recommendation_ids, goal, area, has_website) VALUES (ARRAY['govern.runtime'], 'website', 'kanzlei', false)`],
    ['eigene Modellversion', `INSERT INTO public.needs_check_results (model_version, goal, area, has_website) VALUES (2, 'rules', 'kanzlei', false)`],
    ['eigene id', `INSERT INTO public.needs_check_results (id, goal, area, has_website) VALUES (gen_random_uuid(), 'rules', 'kanzlei', false)`],
  ])('gefälscht: %s → permission denied', async (_name, sql) => {
    const u = await mkUser();
    const res = await asUser(u, sql);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/permission denied/i);
  });

  it('Scan-Referenzen: audit_id und result_basis sind nicht beschreibbar und festgelegt', async () => {
    const u = await mkUser();
    for (const [cols, vals] of [
      ['audit_id', 'gen_random_uuid()'],
      ['audit_id, result_basis', `gen_random_uuid(), 'answers_and_scan'`],
    ]) {
      const res = await asUser(u, `INSERT INTO public.needs_check_results (${cols}, goal, area, has_website) VALUES (${vals}, 'rules', 'kanzlei', false)`);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/permission denied/i);
    }
    expect((await asUser(u, INSERT_OWN)).ok).toBe(true);
    const row = await ctx!.client.query(`SELECT audit_id, result_basis FROM public.needs_check_results WHERE user_id = $1`, [u]);
    expect(row.rows[0]).toEqual({ audit_id: null, result_basis: 'answers' });
  });

  it('alte Kontingent-Logik der Erstfassung ist entfernt', async () => {
    expect(await count(`SELECT count(*) AS n FROM pg_proc WHERE proname = 'needs_check_results_rate_limit'`)).toBe(0);
  });

  it('ohne Identität wird nicht gespeichert', async () => {
    const res = await as('authenticated', null, INSERT_OWN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/needs_check_unauthenticated/);
  });

  it('ungültige Angaben scheitern an den CHECK-Constraints', async () => {
    const u = await mkUser();
    const cases: Array<[string, RegExp]> = [
      [`('alles', 'kanzlei', false, null)`, /goal_chk/],
      [`('rules', 'mars', false, null)`, /area_chk/],
      [`('rules', 'kanzlei', false, 'https://a.de')`, /url_chk/],
      [`('rules', 'kanzlei', true, 'https://user:pw@a.de')`, /url_chk/],
      [`('rules', 'kanzlei', true, 'javascript:alert(1)')`, /url_chk/],
    ];
    for (const [values, re] of cases) {
      const res = await asUser(u, `INSERT INTO public.needs_check_results (goal, area, has_website, website_url) VALUES ${values}`);
      expect(res.ok, values).toBe(false);
      if (!res.ok) expect(res.error).toMatch(re);
    }
  });

  it('fremde Ergebnisse: nicht lesbar, nicht löschbar; kein UPDATE', async () => {
    const a = await mkUser();
    const b = await mkUser();
    expect((await asUser(a, INSERT_OWN)).ok).toBe(true);
    const seen = await asUser(b, `SELECT id FROM public.needs_check_results`);
    expect(seen.ok && seen.rows.length).toBe(0);
    await asUser(b, `DELETE FROM public.needs_check_results WHERE user_id = $1`, [a]);
    expect(await count(`SELECT count(*) AS n FROM public.needs_check_results WHERE user_id = $1`, [a])).toBe(1);
    const upd = await asUser(a, `UPDATE public.needs_check_results SET goal = 'website'`);
    expect(upd.ok).toBe(false);
    if (!upd.ok) expect(upd.error).toMatch(/permission denied/i);
  });

  it('anon hat keinen Zugriff', async () => {
    for (const sql of [`SELECT count(*) FROM public.needs_check_results`, INSERT_OWN]) {
      const res = await as('anon', null, sql);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/permission denied/i);
    }
  });

  it('Protokoll und Sperrzeile sind für Nutzer unsichtbar und nicht fälschbar', async () => {
    const u = await mkUser();
    for (const sql of [
      `SELECT count(*) FROM public.needs_check_save_log`,
      `DELETE FROM public.needs_check_save_log`,
      `INSERT INTO public.needs_check_save_log (user_id, saved_at) VALUES ('${u}', now() - interval '3 days')`,
      `SELECT count(*) FROM public.needs_check_save_quota`,
      `DELETE FROM public.needs_check_save_quota`,
    ]) {
      const res = await asUser(u, sql);
      expect(res.ok, sql).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/permission denied/i);
    }
  });

  it('20 Speicherungen, die 21. scheitert; Löschen gibt nichts frei; danach rollierend', async () => {
    const u = await mkUser();
    for (let i = 0; i < 20; i++) expect((await asUser(u, INSERT_OWN)).ok).toBe(true);
    const over = await asUser(u, INSERT_OWN);
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/needs_check_rate_limited/);

    expect((await asUser(u, `DELETE FROM public.needs_check_results`)).ok).toBe(true);
    expect(await count(`SELECT count(*) AS n FROM public.needs_check_results WHERE user_id = $1`, [u])).toBe(0);
    const afterDelete = await asUser(u, INSERT_OWN);
    expect(afterDelete.ok).toBe(false);
    if (!afterDelete.ok) expect(afterDelete.error).toMatch(/needs_check_rate_limited/);

    await ctx!.client.query(
      `UPDATE public.needs_check_save_log SET saved_at = saved_at - interval '24 hours 1 second' WHERE user_id = $1`,
      [u],
    );
    expect((await asUser(u, INSERT_OWN)).ok).toBe(true);
    expect(await count(`SELECT count(*) AS n FROM public.needs_check_save_log WHERE user_id = $1`, [u])).toBe(1);
  });

  it('fehlgeschlagene Speicherungen zählen nicht', async () => {
    const u = await mkUser();
    for (let i = 0; i < 5; i++) {
      await asUser(u, `INSERT INTO public.needs_check_results (goal, area, has_website) VALUES ('alles', 'kanzlei', false)`);
    }
    expect(await count(`SELECT count(*) AS n FROM public.needs_check_save_log WHERE user_id = $1`, [u])).toBe(0);
  });

  it('CHECK hält falsche Empfehlungen auch ohne Trigger auf', async () => {
    const u = await mkUser();
    const c = ctx!.client;
    await c.query(`SAVEPOINT chk`);
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u, role: 'authenticated' })]);
    await c.query(`ALTER TABLE public.needs_check_results DISABLE TRIGGER needs_check_results_10_set_fields`);
    await expect(
      c.query(
        `INSERT INTO public.needs_check_results (user_id, model_version, goal, area, has_website, recommendation_ids)
         VALUES ($1, 1, 'website', 'kanzlei', false, ARRAY['govern.runtime'])`,
        [u],
      ),
    ).rejects.toThrow(/needs_check_results_recs_chk/);
    await c.query(`ROLLBACK TO SAVEPOINT chk`);
  });

  it('Parität: SQL-Logik = shared/needs-check.ts für alle Kombinationen', async () => {
    for (const goal of GOALS) {
      for (const hasWebsite of [true, false]) {
        const r = await ctx!.client.query<{ ids: string[] }>(
          `SELECT public.needs_check_recommend(1::smallint, $1, $2) AS ids`,
          [goal, hasWebsite],
        );
        expect(r.rows[0]!.ids, `${goal}/${hasWebsite}`).toEqual(recommendIds({ goal, hasWebsite }));
      }
    }
  });
});

d('needs_check_results — parallele Speicherungen (eigene Verbindungen)', () => {
  it('30 gleichzeitige Speicherungen desselben Nutzers: genau 20 gelingen', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    await admin.connect();
    const email = `nc_par_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const { rows } = await admin.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
    const uid = rows[0]!.id;
    const clients = Array.from({ length: 30 }, () => new Client({ connectionString: url }));
    try {
      await Promise.all(clients.map((c) => c.connect()));
      const results = await Promise.allSettled(
        clients.map(async (c) => {
          await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');
          try {
            await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
            await c.query('SET LOCAL ROLE authenticated');
            await c.query(INSERT_OWN);
            await c.query('SELECT pg_sleep(0.2)');
            await c.query('COMMIT');
          } catch (err) {
            await c.query('ROLLBACK');
            throw err;
          }
        }),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const limited = results.filter(
        (r) => r.status === 'rejected' && /needs_check_rate_limited/.test(String((r.reason as Error).message)),
      ).length;
      expect(ok).toBe(20);
      expect(limited).toBe(10);
      const saved = await admin.query<{ n: string }>(`SELECT count(*) AS n FROM public.needs_check_results WHERE user_id = $1`, [uid]);
      expect(Number(saved.rows[0]!.n)).toBe(20);
    } finally {
      await Promise.all(clients.map((c) => c.end().catch(() => undefined)));
      // ON DELETE CASCADE entfernt Ergebnisse, Protokoll und Sperrzeile.
      await admin.query(`DELETE FROM auth.users WHERE id = $1`, [uid]);
      await admin.end();
    }
  }, 30_000);
});
