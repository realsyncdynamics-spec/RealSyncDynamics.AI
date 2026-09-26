/**
 * D5 (ADR 0011) — `platform_operators` ist die einzige schreibbare Quelle der
 * Plattform-Rolle; `profiles.is_super_admin` ist ihre Projektion.
 *
 * Warum als DB-Test: Alles hier ist eine Eigenschaft des Schemas — Grants,
 * SECURITY-Modus, Trigger-Richtung. Kein Unit-Test kann eine Migration
 * widerlegen.
 *
 * Die Suite prueft vier Zusagen getrennt, damit beim Wegfall einer genau ihr
 * Test rot wird:
 *
 *   1. Die Quelle ist fuer Clients dicht (keine Policy, keine Grants).
 *   2. is_platform_operator() antwortet richtig und verraet nichts.
 *   3. Die Projektion folgt der Quelle — in beide Richtungen, auch bei
 *      `active = false` und DELETE.
 *   4. Die Projektion laesst sich nicht umgehen: is_super_admin ist direkt
 *      nicht setzbar, auch nicht per service_role.
 *
 * Laeuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('D5 — platform_operators', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error(
        'REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt. Die D5-Tests waeren still ' +
        'uebersprungen worden — genau der Zustand, den diese Datei verhindert.',
      );
    });
  });
}

const d = dbUrl ? describe : describe.skip;

d('D5 — platform_operators als einzige Quelle der Plattform-Rolle', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  /** Nutzer samt Profilzeile. Setup laeuft als Testrolle und umgeht RLS. */
  async function seedNutzer() {
    const u = await createTenantWithMember(ctx!);
    await ctx!.client.query(
      `INSERT INTO public.profiles (id, full_name) VALUES ($1, 'Test')
       ON CONFLICT (id) DO NOTHING`,
      [u.userId],
    );
    return u;
  }

  async function flag(userId: string): Promise<boolean> {
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT is_super_admin AS v FROM public.profiles WHERE id = $1`, [userId],
    );
    return rows[0]!.v;
  }

  // ── 1. Die Quelle ist fuer Clients dicht ────────────────────────────────

  it('platform_operators traegt RLS und KEINE einzige Policy', async () => {
    // Eine Policy hier waere der Rueckweg zu B1 — die Rechteausweitung waere
    // nur eine Tabelle weitergewandert.
    const { rows } = await ctx!.client.query<{ rls: boolean; n: string }>(
      `SELECT c.relrowsecurity AS rls,
              (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid)::int AS n
         FROM pg_class c WHERE c.oid = 'public.platform_operators'::regclass`,
    );
    expect(rows[0]!.rls).toBe(true);
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('weder anon noch authenticated duerfen die Quelle lesen oder schreiben', async () => {
    for (const rolle of ['anon', 'authenticated']) {
      for (const recht of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const { rows } = await ctx!.client.query<{ v: boolean }>(
          `SELECT has_table_privilege($1, 'public.platform_operators', $2) AS v`,
          [rolle, recht],
        );
        expect(rows[0]!.v, `${rolle} darf ${recht} nicht`).toBe(false);
      }
    }
  });

  it('service_role darf die Quelle pflegen — sonst gaebe es keinen Vergabeweg', async () => {
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_table_privilege('service_role', 'public.platform_operators', 'INSERT') AS v`,
    );
    expect(rows[0]!.v).toBe(true);
  });

  // ── 2. Die Abfrage ──────────────────────────────────────────────────────

  it('is_platform_operator() ist SECURITY DEFINER mit gesetztem search_path', async () => {
    // DEFINER, weil der Aufrufer die Tabelle nicht lesen darf. Ohne gesetzten
    // search_path waere eine DEFINER-Funktion angreifbar (Befund M-03).
    const { rows } = await ctx!.client.query<{ sec: boolean; cfg: string[] | null }>(
      `SELECT prosecdef AS sec, proconfig AS cfg FROM pg_proc
        WHERE oid = 'public.is_platform_operator()'::regprocedure`,
    );
    expect(rows[0]!.sec).toBe(true);
    expect((rows[0]!.cfg ?? []).join(',')).toMatch(/search_path=/);
  });

  it('anon darf sie ausfuehren — sonst bricht die Policy-Auswertung ab', async () => {
    // Fehlt das Recht, liefert die Policy nicht `false`, sondern einen Fehler
    // auf jeder Seite. Lehre aus dem ACL-Vorfall 2026-08-23.
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_function_privilege('anon', 'public.is_platform_operator()', 'EXECUTE') AS v`,
    );
    expect(rows[0]!.v).toBe(true);
  });

  it('antwortet true fuer einen aktiven Operator und false sonst', async () => {
    const operator = await seedNutzer();
    const normal = await seedNutzer();
    await ctx!.client.query(
      `INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [operator.userId],
    );

    await ctx!.withClaims({ sub: operator.userId }, async () => {
      const { rows } = await ctx!.client.query<{ v: boolean }>(`SELECT public.is_platform_operator() AS v`);
      expect(rows[0]!.v).toBe(true);
    });
    await ctx!.withClaims({ sub: normal.userId }, async () => {
      const { rows } = await ctx!.client.query<{ v: boolean }>(`SELECT public.is_platform_operator() AS v`);
      expect(rows[0]!.v).toBe(false);
    });
  });

  it('ohne Sitzung ist die Antwort false, nicht ein Fehler', async () => {
    await ctx!.withClaims({}, async () => {
      const { rows } = await ctx!.client.query<{ v: boolean }>(`SELECT public.is_platform_operator() AS v`);
      expect(rows[0]!.v).toBe(false);
    });
  });

  // ── 3. Die Projektion folgt der Quelle ──────────────────────────────────

  it('ein neuer Operator bekommt das Flag', async () => {
    const u = await seedNutzer();
    expect(await flag(u.userId)).toBe(false);

    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [u.userId]);
    expect(await flag(u.userId)).toBe(true);
  });

  it('Stilllegen per active=false nimmt das Flag zurueck', async () => {
    const u = await seedNutzer();
    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [u.userId]);
    expect(await flag(u.userId)).toBe(true);

    await ctx!.client.query(`UPDATE public.platform_operators SET active = false WHERE user_id = $1`, [u.userId]);
    expect(await flag(u.userId)).toBe(false);

    // und wieder zurueck — die Projektion folgt in beide Richtungen
    await ctx!.client.query(`UPDATE public.platform_operators SET active = true WHERE user_id = $1`, [u.userId]);
    expect(await flag(u.userId)).toBe(true);
  });

  it('DELETE nimmt das Flag ebenfalls zurueck', async () => {
    // Beim AFTER-DELETE ist die Zeile bereits fort; die Projektion muss das
    // aushalten und darf nicht auf NEW zugreifen.
    const u = await seedNutzer();
    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1)`, [u.userId]);
    expect(await flag(u.userId)).toBe(true);

    await ctx!.client.query(`DELETE FROM public.platform_operators WHERE user_id = $1`, [u.userId]);
    expect(await flag(u.userId)).toBe(false);
  });

  it('ein zweiter Operator laesst den ersten unberuehrt', async () => {
    const a = await seedNutzer();
    const b = await seedNutzer();
    await ctx!.client.query(`INSERT INTO public.platform_operators (user_id) VALUES ($1), ($2)`, [a.userId, b.userId]);
    await ctx!.client.query(`DELETE FROM public.platform_operators WHERE user_id = $1`, [b.userId]);

    expect(await flag(a.userId)).toBe(true);
    expect(await flag(b.userId)).toBe(false);
  });

  // ── 4. Die Projektion laesst sich nicht umgehen ─────────────────────────

  it('ein eingeloggter Nutzer kann das Flag weiterhin nicht setzen (B1 bleibt)', async () => {
    const u = await seedNutzer();
    await expect(
      ctx!.withClaims({ sub: u.userId }, async () => {
        await ctx!.client.query(`UPDATE public.profiles SET is_super_admin = true WHERE id = $1`, [u.userId]);
      }),
    ).rejects.toThrow();
    expect(await flag(u.userId)).toBe(false);
  });

  it('auch service_role kann es nicht mehr direkt setzen — nur ueber die Quelle', async () => {
    // Das ist die Verschaerfung gegenueber B1: Dort war service_role der
    // administrative Weg. Jetzt ist es platform_operators, und ein direkter
    // Schreibvorgang wuerde die Projektion von der Quelle abkoppeln.
    const u = await seedNutzer();
    await expect(
      ctx!.withClaims({ sub: u.userId, role: 'service_role' }, async () => {
        await ctx!.client.query(`UPDATE public.profiles SET is_super_admin = true WHERE id = $1`, [u.userId]);
      }),
    ).rejects.toThrow(/platform_operators/);
    expect(await flag(u.userId)).toBe(false);
  });

  it('eine erlaubte Profilaenderung bleibt moeglich, solange das Flag gleich bleibt', async () => {
    // Gegenprobe zum Waechter: Er darf nur is_super_admin sperren, nicht jedes
    // UPDATE auf profiles.
    const u = await seedNutzer();
    await ctx!.withClaims({ sub: u.userId }, async () => {
      await ctx!.client.query(`UPDATE public.profiles SET full_name = 'Neu' WHERE id = $1`, [u.userId]);
    });
    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT full_name AS n FROM public.profiles WHERE id = $1`, [u.userId],
    );
    expect(rows[0]!.n).toBe('Neu');
  });

  it('Quelle und Projektion stimmen ueberein — keine verwaiste Plattformrolle', async () => {
    // Die Invariante als Ganzes, ueber alle Zeilen. Sie faellt auch dann, wenn
    // jemand kuenftig einen Weg am Trigger vorbei einbaut.
    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*)::int AS n
         FROM public.profiles p
         FULL JOIN public.platform_operators po
           ON po.user_id = p.id AND po.active
        WHERE coalesce(p.is_super_admin, false) IS DISTINCT FROM (po.user_id IS NOT NULL)`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
