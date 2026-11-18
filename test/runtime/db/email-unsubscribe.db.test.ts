/**
 * Issue #2282 — `public.email_unsubscribe_by_token(text, uuid)`
 * (20261117220000_email_unsubscribe_by_token.sql).
 *
 * Belegt gegen echtes Postgres:
 *  - sp:   POST setzt `unsubscribed_at`, wiederholter Aufruf ändert den Zeitstempel nicht.
 *  - drip: POST setzt `unsubscribed = true` und `next_send_at = NULL` für die Adresse.
 *  - Versandsperre sofort: die Auswahl der Sender (`unsubscribed_at IS NULL` bzw.
 *    `audit_email_drip_due`, das `unsubscribed = false` verlangt) enthält die Zeile nicht mehr.
 *  - Unbekannter Token / unbekannte Liste: 0 geänderte Zeilen, kein Fehler, Rückgabe void.
 *  - anon darf die Funktion ausführen, aber keine der Tabellen direkt lesen/schreiben
 *    (sofern die Migrationen die Rechte gesetzt haben).
 *
 * Ohne TEST_DB_URL wird übersprungen; mit REQUIRE_DB_TESTS=1 (CI) ist das ein Fehler.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, openDb, requireDbOrFail, type DbCtx } from './db-helpers';

const d = requireDbOrFail('email-unsubscribe') ? describe : describe.skip;

d('email_unsubscribe_by_token — Abmeldung per Mail-Token', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function asAnon(sql: string, params: unknown[]): Promise<void> {
    const c = ctx!.client;
    await c.query('SAVEPOINT anon_call');
    await c.query('SET LOCAL ROLE anon');
    try {
      await c.query(sql, params);
      await c.query('RESET ROLE');
      await c.query('RELEASE SAVEPOINT anon_call');
    } catch (err) {
      await c.query('ROLLBACK TO SAVEPOINT anon_call');
      await c.query('RESET ROLE');
      throw err;
    }
  }

  async function unsubscribe(list: string, token: string): Promise<void> {
    await asAnon('SELECT public.email_unsubscribe_by_token($1, $2::uuid)', [list, token]);
  }

  async function tableExists(name: string): Promise<boolean> {
    const { rows } = await ctx!.client.query<{ r: string | null }>('SELECT to_regclass($1)::text AS r', [name]);
    return rows[0]!.r !== null;
  }

  it('ist SECURITY DEFINER mit leerem search_path und für anon ausführbar', async () => {
    const { rows } = await ctx!.client.query<{ secdef: boolean; cfg: string[] | null; anon: boolean; pub: boolean }>(
      `SELECT p.prosecdef AS secdef, p.proconfig AS cfg,
              has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
              EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS pub
         FROM pg_proc p
        WHERE p.oid = 'public.email_unsubscribe_by_token(text, uuid)'::regprocedure`,
    );
    expect(rows[0]!.secdef).toBe(true);
    expect(rows[0]!.cfg).toContain('search_path=""');
    expect(rows[0]!.anon).toBe(true);
    expect(rows[0]!.pub).toBe(false);
  });

  it('sp: setzt unsubscribed_at, idempotent, Versandauswahl schließt sofort aus', async () => {
    if (!(await tableExists('public.sub_processor_subscriptions'))) return;
    const c = ctx!.client;
    const token = randomUUID();
    const other = randomUUID();
    const { rows: ins } = await c.query<{ id: string }>(
      `INSERT INTO public.sub_processor_subscriptions (email, unsub_token)
       VALUES ($1, $2), ($3, $4) RETURNING id`,
      [`sp_${token}@example.com`, token, `sp_${other}@example.com`, other],
    );
    // Verifiziert markieren, falls die Spalte existiert (RSD-015).
    await c.query(
      `DO $$ BEGIN
         IF EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='sub_processor_subscriptions'
                       AND column_name='verified_at') THEN
           EXECUTE 'UPDATE public.sub_processor_subscriptions SET verified_at = now() WHERE verified_at IS NULL';
         END IF;
       END $$`,
    );

    const active = async () =>
      (await c.query<{ unsub_token: string }>(
        `SELECT unsub_token::text FROM public.sub_processor_subscriptions
          WHERE unsubscribed_at IS NULL AND id = ANY($1::uuid[])`,
        [ins.map((r) => r.id)],
      )).rows.map((r) => r.unsub_token);
    expect(await active()).toEqual(expect.arrayContaining([token, other]));

    await unsubscribe('sp', token);
    const first = await c.query<{ at: Date }>(
      'SELECT unsubscribed_at AS at FROM public.sub_processor_subscriptions WHERE unsub_token = $1', [token],
    );
    expect(first.rows[0]!.at).not.toBeNull();
    expect(await active()).toEqual([other]); // sub-processor-notify-Filter

    await c.query("SELECT pg_sleep(0.01)");
    await unsubscribe('sp', token);
    const second = await c.query<{ at: Date }>(
      'SELECT unsubscribed_at AS at FROM public.sub_processor_subscriptions WHERE unsub_token = $1', [token],
    );
    expect(second.rows[0]!.at.getTime()).toBe(first.rows[0]!.at.getTime());
  });

  it('drip: setzt unsubscribed + stoppt next_send_at für die Adresse, idempotent', async () => {
    if (!(await tableExists('public.audit_email_drip'))) return;
    const c = ctx!.client;
    const email = `Drip_${randomUUID()}@Example.com`;
    const bystander = `drip_${randomUUID()}@example.com`;
    const { rows } = await c.query<{ id: string; unsubscribe_token: string }>(
      `INSERT INTO public.audit_email_drip (audit_id, email, current_step, next_send_at)
       VALUES (NULL, $1, 0, now() - interval '1 minute'),
              (NULL, lower($1), 1, now() - interval '1 minute'),
              (NULL, $2, 0, now() - interval '1 minute')
       RETURNING id, unsubscribe_token::text`,
      [email, bystander],
    );
    const ids = rows.map((r) => r.id);
    const token = rows[0]!.unsubscribe_token;

    await unsubscribe('drip', token);
    const after = await c.query<{ id: string; unsubscribed: boolean; next_send_at: Date | null; updated_at: Date }>(
      'SELECT id, unsubscribed, next_send_at, updated_at FROM public.audit_email_drip WHERE id = ANY($1::uuid[])', [ids],
    );
    const byId = new Map(after.rows.map((r) => [r.id, r]));
    for (const id of ids.slice(0, 2)) {
      expect(byId.get(id)!.unsubscribed).toBe(true);
      expect(byId.get(id)!.next_send_at).toBeNull();
    }
    expect(byId.get(ids[2]!)!.unsubscribed).toBe(false);

    // Versandsperre: die Fälligkeitsfunktion verlangt unsubscribed = false.
    const { rows: def } = await c.query<{ src: string }>(
      "SELECT pg_get_functiondef('public.audit_email_drip_due(integer)'::regprocedure) AS src",
    );
    expect(def[0]!.src).toMatch(/unsubscribed\s*=\s*false/);

    // Idempotent: zweiter Aufruf ändert updated_at nicht.
    await c.query("SELECT pg_sleep(0.01)");
    await unsubscribe('drip', token);
    const again = await c.query<{ updated_at: Date }>(
      'SELECT updated_at FROM public.audit_email_drip WHERE id = $1', [ids[0]],
    );
    expect(again.rows[0]!.updated_at.getTime()).toBe(byId.get(ids[0]!)!.updated_at.getTime());
  });

  it('unbekannter Token und unbekannte Liste ändern 0 Zeilen und werfen nicht', async () => {
    const c = ctx!.client;
    const snapshot = async () => {
      const parts: string[] = [];
      if (await tableExists('public.sub_processor_subscriptions')) {
        parts.push((await c.query("SELECT count(*) FILTER (WHERE unsubscribed_at IS NOT NULL) AS n FROM public.sub_processor_subscriptions")).rows[0].n);
      }
      if (await tableExists('public.audit_email_drip')) {
        parts.push((await c.query("SELECT count(*) FILTER (WHERE unsubscribed) AS n FROM public.audit_email_drip")).rows[0].n);
      }
      return parts.join('/');
    };
    const before = await snapshot();
    await unsubscribe('sp', randomUUID());
    await unsubscribe('drip', randomUUID());
    await unsubscribe('newsletter', randomUUID());
    expect(await snapshot()).toBe(before);
  });

  it('anon kann die Abo-Tabellen an der Funktion vorbei weder lesen noch ändern', async () => {
    const c = ctx!.client;
    for (const t of ['public.sub_processor_subscriptions', 'public.audit_email_drip']) {
      if (!(await tableExists(t))) continue;
      if (t.endsWith('drip')) {
        await c.query(`INSERT INTO public.audit_email_drip (audit_id, email) VALUES (NULL, $1)`, [`a_${randomUUID()}@example.com`]);
      } else {
        await c.query(`INSERT INTO public.sub_processor_subscriptions (email) VALUES ($1)`, [`a_${randomUUID()}@example.com`]);
      }
      const setter = t.endsWith('drip') ? 'unsubscribed = true' : 'unsubscribed_at = now()';
      await c.query('SAVEPOINT anon_direct');
      await c.query('SET LOCAL ROLE anon');
      let selected = 0;
      let updated = 0;
      try {
        selected = (await c.query(`SELECT 1 FROM ${t}`)).rowCount ?? 0;
        updated = (await c.query(`UPDATE ${t} SET ${setter}`)).rowCount ?? 0;
      } catch {
        // permission denied ist ebenso ein gültiges Ergebnis
      }
      await c.query('ROLLBACK TO SAVEPOINT anon_direct');
      await c.query('RESET ROLE');
      expect(selected, `${t}: anon darf nichts lesen`).toBe(0);
      expect(updated, `${t}: anon darf nichts ändern`).toBe(0);
    }
  });
});
