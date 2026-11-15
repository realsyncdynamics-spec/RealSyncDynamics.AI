/**
 * needs_check_results — Bedarfs-Check, gespeicherte Antworten je Nutzer
 * (Migration 20261115203000_needs_check_results.sql).
 *
 * Geprüft wird die WIRKUNG unter echten Rollen: Ein Nutzer liest, legt an und
 * löscht nur eigene Zeilen; fremde Zeilen sind unsichtbar; anon hat keinen
 * Zugriff; ungültige Antworten und mehr als 20 Zeilen weist die Datenbank ab.
 *
 * Läuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

if (!dbUrl && process.env.REQUIRE_DB_TESTS === '1') {
  describe('needs_check_results RLS', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error('REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt.');
    });
  });
}

const d = dbUrl ? describe : describe.skip;

type Actor = { kind: 'anon' } | { kind: 'user'; userId: string };
type Outcome = 'allow' | 'deny';

const VALID = JSON.stringify({ goal: 'new_website', area: 'trade', website: 'no' });

d('needs_check_results RLS', () => {
  let ctx: DbCtx | null = null;
  const ids = {} as { a: string; b: string; rowA: string };

  async function q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return ctx!.client.query<T>(sql, params);
  }

  async function actAs(actor: Actor) {
    if (actor.kind === 'anon') {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
      await q(`SET LOCAL ROLE anon`);
    } else {
      await q(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: actor.userId, role: 'authenticated' }),
      ]);
      await q(`SET LOCAL ROLE authenticated`);
    }
  }

  /** Zeilen betroffen/gelesen → allow; RLS-/Rechte-/Prüffehler oder 0 Zeilen → deny. */
  async function attempt(actor: Actor, sql: string, params: unknown[] = []): Promise<Outcome> {
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await q(`SAVEPOINT ${sp}`);
    try {
      await actAs(actor);
      const res = await q(sql, params);
      return (res.rowCount ?? 0) > 0 ? 'allow' : 'deny';
    } catch (err) {
      if (/row-level security|permission denied|check constraint|needs_check_limit/i.test(String((err as Error).message))) {
        return 'deny';
      }
      throw err;
    } finally {
      await q(`ROLLBACK TO SAVEPOINT ${sp}`);
      await q(`RESET ROLE`);
    }
  }

  const user = (userId: string): Actor => ({ kind: 'user', userId });

  beforeEach(async () => {
    ctx = await openDb();
    const mkUser = async () =>
      (await q<{ id: string }>(
        `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
        [`needs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}@example.com`],
      )).rows[0]!.id;
    ids.a = await mkUser();
    ids.b = await mkUser();
    ids.rowA = (await q<{ id: string }>(
      `INSERT INTO public.needs_check_results(user_id, answers) VALUES ($1, $2::jsonb) RETURNING id`,
      [ids.a, VALID],
    )).rows[0]!.id;
  });

  afterEach(async () => {
    await closeDb(ctx);
    ctx = null;
  });

  it('der Besitzer liest die eigene Zeile, ein anderer Nutzer nicht', async () => {
    const read = `SELECT id FROM public.needs_check_results WHERE id = $1`;
    expect(await attempt(user(ids.a), read, [ids.rowA])).toBe('allow');
    expect(await attempt(user(ids.b), read, [ids.rowA])).toBe('deny');
  });

  it('anon hat weder Lese- noch Schreibzugriff', async () => {
    expect(await attempt({ kind: 'anon' }, `SELECT id FROM public.needs_check_results`)).toBe('deny');
    expect(
      await attempt({ kind: 'anon' }, `INSERT INTO public.needs_check_results(answers) VALUES ($1::jsonb)`, [VALID]),
    ).toBe('deny');
  });

  it('ein Nutzer legt nur für sich selbst an; user_id kommt aus der Sitzung', async () => {
    const own = `INSERT INTO public.needs_check_results(answers) VALUES ($1::jsonb) RETURNING id`;
    expect(await attempt(user(ids.b), own, [VALID])).toBe('allow');
    const foreign = `INSERT INTO public.needs_check_results(user_id, answers) VALUES ($1, $2::jsonb)`;
    expect(await attempt(user(ids.b), foreign, [ids.a, VALID])).toBe('deny');
  });

  it('fremde Zeilen lassen sich weder löschen noch ändern', async () => {
    expect(await attempt(user(ids.b), `DELETE FROM public.needs_check_results WHERE id = $1`, [ids.rowA])).toBe('deny');
    expect(
      await attempt(user(ids.a), `UPDATE public.needs_check_results SET version = 1 WHERE id = $1`, [ids.rowA]),
    ).toBe('deny');
    expect(await attempt(user(ids.a), `DELETE FROM public.needs_check_results WHERE id = $1`, [ids.rowA])).toBe('allow');
  });

  it.each([
    ['unbekanntes Ziel', { goal: 'x', area: 'trade', website: 'no' }],
    ['fehlendes Feld', { goal: 'new_website', area: 'trade' }],
    ['zusätzliches Feld', { goal: 'new_website', area: 'trade', website: 'no', note: 'frei' }],
    ['kein Objekt', ['new_website']],
  ])('ungültige Antworten werden abgewiesen (%s)', async (_label, value) => {
    expect(
      await attempt(user(ids.a), `INSERT INTO public.needs_check_results(answers) VALUES ($1::jsonb)`, [
        JSON.stringify(value),
      ]),
    ).toBe('deny');
  });

  it('mehr als 20 Zeilen je Nutzer sind nicht möglich', async () => {
    await q(
      `INSERT INTO public.needs_check_results(user_id, answers)
       SELECT $1, $2::jsonb FROM generate_series(1, 19)`,
      [ids.a, VALID],
    );
    expect(
      await attempt(user(ids.a), `INSERT INTO public.needs_check_results(answers) VALUES ($1::jsonb)`, [VALID]),
    ).toBe('deny');
    expect(
      await attempt(user(ids.b), `INSERT INTO public.needs_check_results(answers) VALUES ($1::jsonb)`, [VALID]),
    ).toBe('allow');
  });
});
