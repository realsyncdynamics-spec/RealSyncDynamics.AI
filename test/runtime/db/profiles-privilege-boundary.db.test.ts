/**
 * B1 — `profiles.is_super_admin` darf clientseitig nicht setzbar sein.
 *
 * Warum als DB-Test: Der Befund ist eine Eigenschaft des erzeugten Schemas
 * (Grants, Policy, Trigger), nicht des TypeScript-Codes. Kein Unit-Test kann
 * eine Migration widerlegen.
 *
 * Die Suite prueft drei Schichten EINZELN, nicht nur das Endergebnis. Das ist
 * Absicht: Faellt spaeter eine Schicht weg, soll genau ihr Test rot werden und
 * nicht ein Sammeltest, der weiterhin gruen bleibt, weil eine andere Schicht
 * den Fall zufaellig mit abdeckt.
 *
 *   1. Spalten-Grant — die eigentliche Grenze
 *   2. Trigger       — haelt sie, wenn Grants von aussen zurueckgesetzt werden
 *
 * Bewusst NICHT geprueft: die Abwesenheit eines Tabellen-Grants als solche.
 * Der db-Job stellt Rechte fuer Objekte ohne ACL wieder her; ein Test auf
 * "kein Grant vorhanden" haette dort scheitern koennen, ohne dass an der
 * Sperre etwas falsch ist. Geprueft wird deshalb die WIRKUNG: Das UPDATE
 * scheitert.
 *
 * Laeuft nur mit gesetztem TEST_DB_URL; in CI setzt der db-Job die Variable.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('B1 — Rechtegrenze auf profiles', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error(
        'REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt. Die B1-Regressionstests waeren ' +
        'still uebersprungen worden — genau der Zustand, den diese Datei verhindert.',
      );
    });
  });
}

const d = dbUrl ? describe : describe.skip;

d('B1 — profiles.is_super_admin ist clientseitig unveraenderlich', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  /**
   * Legt Mandant, Nutzer und das zugehoerige Profil an. Der Insert laeuft als
   * Testrolle (Superuser) und umgeht RLS — das Fixture soll nicht von den
   * Policies abhaengen, die hier gerade geprueft werden.
   */
  async function seedProfil(email?: string) {
    const u = await createTenantWithMember(ctx!, opts(email));
    await ctx!.client.query(
      `INSERT INTO public.profiles (id, full_name, is_super_admin)
       VALUES ($1, 'Vorher', false)
       ON CONFLICT (id) DO UPDATE SET full_name = 'Vorher', is_super_admin = false`,
      [u.userId],
    );
    return u;
  }

  function opts(email?: string) {
    return email ? { userEmail: email } : {};
  }

  async function istSuperAdmin(userId: string): Promise<boolean> {
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT is_super_admin AS v FROM public.profiles WHERE id = $1`,
      [userId],
    );
    return rows[0]!.v;
  }

  // ── Schicht 1: Spalten-Grant ─────────────────────────────────────────────

  it('authenticated hat KEIN UPDATE-Recht auf is_super_admin', async () => {
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.profiles', 'is_super_admin', 'UPDATE') AS v`,
    );
    expect(rows[0]!.v).toBe(false);
  });

  it('authenticated hat UPDATE-Recht auf die sechs echten Schreibspalten', async () => {
    // Die Liste stammt aus den gemessenen Schreibpfaden der SPA. Faellt eine
    // Spalte hier weg, bricht eine Oberflaeche — Prioritaet 2 des Auftrags.
    const erlaubt = [
      'full_name', 'organization_name', 'ai_data_residency',
      'onboarding_step', 'onboarding_completed_at', 'onboarding_dismissed_at',
    ];
    for (const spalte of erlaubt) {
      const { rows } = await ctx!.client.query<{ v: boolean }>(
        `SELECT has_column_privilege('authenticated', 'public.profiles', $1, 'UPDATE') AS v`,
        [spalte],
      );
      expect(rows[0]!.v, `Spalte ${spalte} muss schreibbar bleiben`).toBe(true);
    }
  });

  it('anon hat ueberhaupt kein UPDATE-Recht mehr', async () => {
    const { rows } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_column_privilege('anon', 'public.profiles', 'full_name', 'UPDATE') AS v`,
    );
    expect(rows[0]!.v).toBe(false);
  });

  it('service_role darf weiterhin alles schreiben', async () => {
    // welcome-email/index.ts:107 schreibt welcome_email_sent_at per Service-Role.
    for (const spalte of ['welcome_email_sent_at', 'is_super_admin']) {
      const { rows } = await ctx!.client.query<{ v: boolean }>(
        `SELECT has_column_privilege('service_role', 'public.profiles', $1, 'UPDATE') AS v`,
        [spalte],
      );
      expect(rows[0]!.v, `service_role braucht ${spalte}`).toBe(true);
    }
  });

  // ── Wirkung: das eigentliche Angriffsszenario ────────────────────────────

  it('ein eingeloggter Nutzer kann sich NICHT selbst zum Plattform-Admin machen', async () => {
    const u = await seedProfil();

    await expect(
      ctx!.withClaims({ sub: u.userId }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET is_super_admin = true WHERE id = $1`,
          [u.userId],
        );
      }),
    ).rejects.toThrow();

    expect(await istSuperAdmin(u.userId)).toBe(false);
  });

  it('auch getarnt neben einer erlaubten Spalte nicht', async () => {
    // Der naheliegende Umgehungsversuch: die verbotene Spalte in einem sonst
    // legitimen Speichern-Vorgang mitschicken.
    const u = await seedProfil();

    await expect(
      ctx!.withClaims({ sub: u.userId }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET full_name = 'Neu', is_super_admin = true WHERE id = $1`,
          [u.userId],
        );
      }),
    ).rejects.toThrow();

    expect(await istSuperAdmin(u.userId)).toBe(false);
  });

  // ── Prioritaet 2: legitime Schreibpfade bleiben funktionsfaehig ──────────

  it('das echte Profil-Speichern aus SettingsView funktioniert weiter', async () => {
    const u = await seedProfil();

    await ctx!.withClaims({ sub: u.userId }, async () => {
      await ctx!.client.query(
        `UPDATE public.profiles SET full_name = $2, organization_name = $3 WHERE id = $1`,
        [u.userId, 'Dominik', 'RealSync'],
      );
    });

    const { rows } = await ctx!.client.query<{ n: string; o: string }>(
      `SELECT full_name AS n, organization_name AS o FROM public.profiles WHERE id = $1`,
      [u.userId],
    );
    expect(rows[0]!.n).toBe('Dominik');
    expect(rows[0]!.o).toBe('RealSync');
  });

  it('die KI-Datenresidenz laesst sich weiter setzen', async () => {
    const u = await seedProfil();

    await ctx!.withClaims({ sub: u.userId }, async () => {
      await ctx!.client.query(
        `UPDATE public.profiles SET ai_data_residency = 'eu_local' WHERE id = $1`,
        [u.userId],
      );
    });

    const { rows } = await ctx!.client.query<{ v: string }>(
      `SELECT ai_data_residency AS v FROM public.profiles WHERE id = $1`,
      [u.userId],
    );
    expect(rows[0]!.v).toBe('eu_local');
  });

  it('der Onboarding-Fortschritt laesst sich weiter fortschreiben', async () => {
    const u = await seedProfil();

    await ctx!.withClaims({ sub: u.userId }, async () => {
      await ctx!.client.query(
        `UPDATE public.profiles
            SET onboarding_step = 3, onboarding_completed_at = now()
          WHERE id = $1`,
        [u.userId],
      );
    });

    const { rows } = await ctx!.client.query<{ s: number }>(
      `SELECT onboarding_step AS s FROM public.profiles WHERE id = $1`,
      [u.userId],
    );
    expect(Number(rows[0]!.s)).toBe(3);
  });

  // ── Schicht 2: der Trigger haelt auch ohne Spaltenrechte ────────────────

  it('der Trigger sperrt auch dann, wenn die Spalten-Grants zurueckgesetzt werden', async () => {
    // Stellt den Vorfall vom 2026-08-23 nach: ein Bulk-Grant hebt die
    // Spaltenrechte auf. Danach ist der Trigger die einzige verbliebene
    // Grenze — und muss halten.
    const u = await seedProfil();
    await ctx!.client.query(`GRANT UPDATE ON public.profiles TO authenticated`);

    const { rows: g } = await ctx!.client.query<{ v: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.profiles', 'is_super_admin', 'UPDATE') AS v`,
    );
    expect(g[0]!.v, 'Vorbedingung: Grant ist wieder offen').toBe(true);

    await expect(
      ctx!.withClaims({ sub: u.userId }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET is_super_admin = true WHERE id = $1`,
          [u.userId],
        );
      }),
    ).rejects.toThrow(/42501|unveraenderlich|platform_operators/);

    expect(await istSuperAdmin(u.userId)).toBe(false);
  });

  it('der Trigger laeuft als SECURITY INVOKER — sonst waere er wirkungslos', async () => {
    // Als DEFINER waere current_user immer der Eigentuemer und die Bedingung
    // nie erfuellt. Der Test prueft die Eigenschaft, nicht das Verhalten,
    // weil ein DEFINER-Trigger still nichts tut statt sichtbar zu scheitern.
    const { rows } = await ctx!.client.query<{ sec: boolean }>(
      `SELECT prosecdef AS sec FROM pg_proc
        WHERE oid = 'public.profiles_guard_privileged_columns()'::regprocedure`,
    );
    expect(rows[0]!.sec).toBe(false);
  });

  it('der administrative Weg fuehrt ueber platform_operators, nicht ueber profiles', async () => {
    // GEAENDERT am 2026-09-26 durch D5 (20260926120000). Bis dahin pruefte
    // dieser Test das Gegenteil: dass `service_role` das Flag direkt setzen
    // DARF — damals richtig, weil das der administrative Weg war.
    //
    // Seit D5 ist `profiles.is_super_admin` eine Projektion von
    // `platform_operators`. Ein direkter Schreibvorgang wuerde die Projektion
    // von ihrer Quelle abkoppeln und ist deshalb auch fuer `service_role`
    // gesperrt. Die Zusage „es gibt einen administrativen Weg" bleibt — sie
    // zeigt nur woandershin. Genau das wird hier geprueft, statt die alte
    // Erwartung stillschweigend zu streichen.
    const u = await seedProfil();

    await expect(
      ctx!.withClaims({ sub: u.userId, role: 'service_role' }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET is_super_admin = true WHERE id = $1`,
          [u.userId],
        );
      }),
    ).rejects.toThrow(/platform_operators/);
    expect(await istSuperAdmin(u.userId)).toBe(false);

    // Und der Weg, der gilt:
    await ctx!.client.query(
      `INSERT INTO public.platform_operators (user_id) VALUES ($1)`,
      [u.userId],
    );
    expect(await istSuperAdmin(u.userId)).toBe(true);
  });

  // ── Bestehende Invariante der Policy ─────────────────────────────────────

  it('ein Profil laesst sich nicht an ein fremdes Konto uebergeben', async () => {
    const a = await seedProfil();
    // Das Ziel ist bewusst ein Nutzer OHNE Profilzeile. Mit Profil scheiterte
    // das UPDATE am Primaerschluessel — der Test haette die Sperre dann nur
    // vorgetaeuscht (beim Gegenprobelauf aufgefallen).
    //
    // Dies prueft KEINE Aenderung dieser Migration, sondern eine bestehende
    // Eigenschaft: PostgreSQL nutzt bei UPDATE den USING-Ausdruck auch als
    // WITH CHECK, solange keiner definiert ist. Der Test haelt genau das fest,
    // damit ein spaeteres Umschreiben der Policy nicht unbemerkt eine
    // Uebergabe erlaubt.
    const fremd = await createTenantWithMember(ctx!);

    // Ohne Spalten-Grant auf `id` scheitert die Uebergabe schon dort. Der
    // Grant wird deshalb absichtlich geoeffnet, damit wirklich WITH CHECK
    // geprueft wird und nicht die Schicht davor.
    await ctx!.client.query(`GRANT UPDATE ON public.profiles TO authenticated`);

    await expect(
      ctx!.withClaims({ sub: a.userId }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET id = $2 WHERE id = $1`,
          [a.userId, fremd.userId],
        );
      }),
    ).rejects.toThrow(/row-level security/);

    // Die Zeile gehoert weiterhin dem urspruenglichen Konto.
    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM public.profiles WHERE id = $1`,
      [a.userId],
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });
});
