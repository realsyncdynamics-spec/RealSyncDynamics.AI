/**
 * Sicherheits-Regressionen — DB-Integration.
 *
 * Deckt die drei Befunde ab, die in diesem Durchgang behoben wurden:
 *   C-02  Stripe-Upsert lief auf stripe_subscription_id statt tenant_id
 *   IDOR  get_compliance_timeline ohne Mitgliedschaftspruefung, anon-ausfuehrbar
 *   M-03  SECURITY-DEFINER-Funktionen ohne gesetzten search_path
 *
 * Warum als DB-Test und nicht als Unit-Test: Alle drei sind Eigenschaften des
 * erzeugten Schemas, nicht des TypeScript-Codes. Ein Unit-Test kann eine
 * Migration nicht widerlegen. Die Invarianten sind bewusst ueber das GESAMTE
 * Schema formuliert statt als Namensliste — eine neu hinzukommende Funktion
 * mit demselben Fehler laesst den Test fallen, ohne dass jemand ihn pflegt.
 *
 * Laeuft nur mit gesetztem TEST_DB_URL; ohne DB wird die Suite uebersprungen
 * (siehe db-helpers). In CI setzt der db-Job die Variable — siehe
 * .github/workflows/ci.yml.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, createTenantWithMember, getDbUrl, openDb, type DbCtx } from './db-helpers';

const dbUrl = getDbUrl();

/**
 * Ohne TEST_DB_URL ueberspringen sich DB-Tests still — bequem lokal, fatal in
 * CI. Genau so konnten eine gruene Suite und offene Sicherheitsluecken
 * nebeneinander bestehen: Die einzige RLS-Suite lief dort nie.
 *
 * REQUIRE_DB_TESTS=1 dreht das Verhalten um: Fehlt die Datenbank, faellt der
 * Lauf laut aus, statt leise nichts zu pruefen. Der db-Job in
 * .github/workflows/ci.yml setzt die Variable.
 */
const mussLaufen = process.env.REQUIRE_DB_TESTS === '1';

if (!dbUrl && mussLaufen) {
  describe('DB-Sicherheitstests', () => {
    it('TEST_DB_URL muss gesetzt sein, wenn REQUIRE_DB_TESTS=1', () => {
      throw new Error(
        'REQUIRE_DB_TESTS=1, aber TEST_DB_URL fehlt. Die Sicherheits-Regressionstests ' +
        'waeren still uebersprungen worden — genau der Zustand, den diese Datei verhindert.',
      );
    });
  });
}

const d = dbUrl ? describe : describe.skip;

d('IDOR — get_compliance_timeline', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function seedScan(tenantId: string, domain: string) {
    // risk_level ist eine generierte Spalte und darf nicht gesetzt werden.
    await ctx!.client.query(
      `INSERT INTO public.audit_monitor_results (tenant_id, domain, risk_score, scanned_at)
       VALUES ($1, $2, 42, now())`,
      [tenantId, domain],
    );
  }

  it('anon darf die Funktion nicht ausfuehren', async () => {
    const { rows } = await ctx!.client.query<{ anon: boolean }>(
      `SELECT has_function_privilege('anon',
         'public.get_compliance_timeline(text,uuid,integer)', 'EXECUTE') AS anon`,
    );
    expect(rows[0]!.anon).toBe(false);
  });

  it('authenticated darf sie ausfuehren', async () => {
    const { rows } = await ctx!.client.query<{ ok: boolean }>(
      `SELECT has_function_privilege('authenticated',
         'public.get_compliance_timeline(text,uuid,integer)', 'EXECUTE') AS ok`,
    );
    expect(rows[0]!.ok).toBe(true);
  });

  it('ein Mitglied sieht die Timeline des eigenen Mandanten', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ct-A', userEmail: 'ct-a@example.com' });
    await seedScan(A.tenantId, 'kunde-a.de');

    await ctx!.withClaims({ sub: A.userId }, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM public.get_compliance_timeline('kunde-a.de', $1, 30)`,
        [A.tenantId],
      );
      expect(Number(rows[0]!.n)).toBe(1);
    });
  });

  it('ein Nicht-Mitglied sieht dieselbe Timeline NICHT', async () => {
    // Der eigentliche Befund: p_tenant_id kam ungeprueft vom Aufrufer, und
    // SECURITY DEFINER umgeht die RLS auf audit_monitor_results.
    const A = await createTenantWithMember(ctx!, { tenantName: 'ct-A2', userEmail: 'ct-a2@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ct-B2', userEmail: 'ct-b2@example.com' });
    await seedScan(A.tenantId, 'kunde-a.de');

    await ctx!.withClaims({ sub: B.userId }, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM public.get_compliance_timeline('kunde-a.de', $1, 30)`,
        [A.tenantId],
      );
      expect(Number(rows[0]!.n)).toBe(0);
    });
  });

  it('ohne Session ist die Timeline leer', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ct-A3', userEmail: 'ct-a3@example.com' });
    await seedScan(A.tenantId, 'kunde-a.de');

    await ctx!.withClaims({}, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*)::int AS n FROM public.get_compliance_timeline('kunde-a.de', $1, 30)`,
        [A.tenantId],
      );
      expect(Number(rows[0]!.n)).toBe(0);
    });
  });
});

d('C-02 — Free-Tier- und Kaufpfad auf subscriptions', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('subscriptions traegt UNIQUE(tenant_id) — die Regel, an der der Upsert scheiterte', async () => {
    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname = 'subscriptions_tenant_id_key' AND contype = 'u'`,
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it('der Free-Tier-Trigger legt beim Tenant-Anlegen eine Zeile mit NULL-Stripe-ID an', async () => {
    // Die Vorbedingung des Befunds. Faellt sie weg, testet der naechste Fall
    // nichts mehr — deshalb wird sie eigens geprueft statt vorausgesetzt.
    const A = await createTenantWithMember(ctx!, { tenantName: 'bill-A', userEmail: 'bill-a@example.com' });
    const { rows } = await ctx!.client.query<{ plan_key: string; sid: string | null }>(
      `SELECT plan_key, stripe_subscription_id AS sid FROM public.subscriptions WHERE tenant_id = $1`,
      [A.tenantId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sid).toBeNull();
  });

  it('der Upsert auf tenant_id ersetzt die Free-Tier-Zeile durch das bezahlte Abo', async () => {
    // Bildet exakt nach, was syncSubscription() im Webhook schickt.
    // Mit onConflict 'stripe_subscription_id' waere das ein INSERT geworden
    // (NULLs gelten in Unique-Indizes als verschieden) und an
    // subscriptions_tenant_id_key mit 23505 gescheitert.
    const A = await createTenantWithMember(ctx!, { tenantName: 'bill-B', userEmail: 'bill-b@example.com' });

    await ctx!.client.query(
      `INSERT INTO public.subscriptions
         (tenant_id, stripe_customer_id, stripe_subscription_id, plan_key, status, billing_interval)
       VALUES ($1, 'cus_test', 'sub_test', 'growth', 'active', 'month')
       ON CONFLICT (tenant_id) DO UPDATE SET
         stripe_customer_id     = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan_key               = EXCLUDED.plan_key,
         status                 = EXCLUDED.status`,
      [A.tenantId],
    );

    const { rows } = await ctx!.client.query<{ plan_key: string; sid: string }>(
      `SELECT plan_key, stripe_subscription_id AS sid FROM public.subscriptions WHERE tenant_id = $1`,
      [A.tenantId],
    );
    expect(rows).toHaveLength(1);            // "genau ein Abo pro Tenant" bleibt gewahrt
    expect(rows[0]!.plan_key).toBe('growth');
    expect(rows[0]!.sid).toBe('sub_test');
  });
});

d('Schema-weite Invarianten fuer SECURITY DEFINER', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  /**
   * Funktionen, die anon ausfuehren DARF, weil das kein Befund ist:
   *  - Helfer, die selbst gegen auth.uid() pruefen (is_tenant_member & Co.)
   *  - Endpunkte, bei denen der Parameter das Geheimnis IST (Token, Key)
   *  - Funktionen mit eigener Autorisierung im Koerper
   */
  const UNBEDENKLICH = [
    'is_tenant_member', 'is_tenant_admin', 'is_tenant_owner_or_admin', 'has_tenant_membership',
    'audit_share_get', 'get_rebuild_status_by_token',
    'asset_lifecycle_state', 'onboarding_tenant_policy_packs',
  ];

  /**
   * BEKANNTE SCHULD — kein Freibrief, sondern eine sichtbare Liste.
   *
   * Postgres vergibt EXECUTE auf jede neue Funktion per Default an PUBLIC.
   * Ein vergessenes REVOKE genuegt also, damit ein anonymer Aufrufer eine
   * RLS-umgehende Funktion mit fremder Mandanten-ID starten kann.
   *
   * In PRODUKTION sind diese Grants groesstenteils entzogen — allerdings
   * durch einen Eingriff ausserhalb des Repos. 20260826000001 dokumentiert
   * ihn ("Out-of-Band-Revoke ... ausserhalb des Repos direkt gegen Prod")
   * und musste danach Client-Grants wiederherstellen, weil der pauschale
   * Entzug Funktionen des SPA mitgerissen hatte.
   *
   * Im REPO fehlte dieser Revoke lange. Gemessen am 2026-08-30 gegen ein
   * frisch repliziertes Schema: 93 anon-ausfuehrbare SECURITY-DEFINER-
   * Funktionen lokal gegenueber 17 in Produktion. Ein aus dem Repo neu
   * aufgebautes Environment (supabase db reset, Staging, weitere Region) war
   * damit deutlich offener als die laufende Instanz.
   *
   * ABGETRAGEN am 2026-09-01 durch
   * 20260903044500_align_repo_function_grants_with_prod.sql. Der Zielzustand
   * wurde NICHT hergeleitet, sondern aus Produktion uebernommen: Fuer die 59
   * Namen, die hier frueher als Schuld standen, wurde gemessen, welche Rolle
   * sie dort hat (alle 59 ohne anon; 52 auch ohne authenticated; 7 mit
   * authenticated; alle 59 mit service_role). Ein Entzug, der in einem seit
   * dem 2026-08-23 laufenden System gilt, kann im Repo nichts brechen, was
   * dort nicht schon gebrochen waere — das ist der Grund, warum der zweite
   * Anlauf zulaessig war und der pauschale erste es nicht gewesen waere.
   *
   * Die Liste bleibt bewusst als LEERES Array stehen statt zu verschwinden:
   * Sie ist die Stelle, an der die naechste Schuld sichtbar wuerde, und der
   * Test darunter faellt um, sobald jemand sie wieder fuellt, ohne zu messen.
   */
  const BEKANNTE_SCHULD: string[] = [];

  // Die 59 Namen, die hier bis zum 2026-09-01 standen. Sie bleiben als
  // Pruefliste erhalten: Der Test weiter unten belegt positiv, dass der
  // Entzug gegriffen hat, statt sich darauf zu verlassen, dass eine leere
  // Ausnahmeliste schon das Richtige bedeutet.
  const ABGETRAGEN = [
    'acknowledge_compliance_alert', 'add_dashboard_insight', 'analyze_governance_gaps_from_workflow',
    'approve_optimization_recommendation', 'assess_ai_act_risk', 'audit_findings_by_severity',
    'bulk_scan_batch_progress', 'calculate_compliance_score', 'calculate_iso27001_maturity',
    'calculate_iso42001_maturity', 'check_feature_usage', 'check_nis2_deadline_compliance',
    'complete_optimization_execution', 'complete_workflow', 'count_open_gaps_by_severity',
    'create_api_key', 'create_nis2_deadlines', 'create_notification',
    'evidence_purgeable', 'evidence_vault_timeline', 'find_evidence_by_framework',
    'generate_compliance_summary', 'get_cache_hit_rate', 'get_dashboard_summary',
    'get_feature_quota', 'get_notification_preferences', 'get_notifications',
    'get_or_create_default_autonomous_agents', 'get_or_create_governance_workflow', 'get_slow_queries',
    'get_tenant_branding', 'get_tenant_plan_key', 'get_unread_notification_count',
    'get_unresolved_alerts', 'governance_kpi_latest_snapshot', 'governance_kpi_range',
    'governance_kpi_timeseries_data', 'has_feature', 'list_expiring_evidence',
    'list_high_risk_ai_systems', 'list_nis2_incidents_nearing_deadline', 'list_overdue_iso_reviews',
    'log_c2pa_provenance', 'log_compliance_alert', 'log_notification_event',
    'log_query', 'mark_notification_read', 'notify_quota_alert',
    'partner_get_quota_used', 'partner_increment_quota', 'queue_email_notification',
    'recommend_governance_plan', 'resolve_compliance_alert', 'save_workflow_progress',
    'save_workflow_step', 'start_optimization_execution', 'tenant_entitlements',
    'update_compliance_score', 'update_member_role',
  ];

  it('kein NEUES tenant-parametrisiertes SECURITY-DEFINER-RPC wird fuer anon geoeffnet', async () => {
    const { rows } = await ctx!.client.query<{ proname: string; args: string }>(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND pg_get_function_identity_arguments(p.oid) ILIKE '%uuid%'
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
        AND NOT (p.proname = ANY ($1::text[]))
      ORDER BY p.proname
    `, [[...UNBEDENKLICH, ...BEKANNTE_SCHULD]]);

    expect(rows.map((r) => `${r.proname}(${r.args})`)).toEqual([]);
  });

  it('die abgetragenen 59 sind fuer anon wirklich gesperrt', async () => {
    // Positivbeleg statt Schluss aus einer leeren Ausnahmeliste. Der Test
    // darueber wuerde auch dann gruen, wenn die Funktionen verschwaenden;
    // dieser hier zeigt, dass sie existieren UND entzogen sind.
    const { rows } = await ctx!.client.query<{ proname: string; args: string }>(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname = ANY ($1::text[])
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ORDER BY p.proname
    `, [ABGETRAGEN]);

    expect(rows.map((r) => `${r.proname}(${r.args})`)).toEqual([]);
  });

  it('service_role behaelt EXECUTE auf allen abgetragenen Funktionen', async () => {
    // Die Gegenrichtung, und der eigentliche Grund fuer den Vorfall vom
    // 2026-08-23: `REVOKE ... FROM PUBLIC` nimmt auch service_role das Recht,
    // wenn es dort nur ueber PUBLIC bestand. Edge Functions rufen 11 dieser
    // Funktionen auf — faellt das Recht, faellt der Cron-Pfad still aus.
    const { rows } = await ctx!.client.query<{ proname: string }>(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname = ANY ($1::text[])
        AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      ORDER BY p.proname
    `, [ABGETRAGEN]);

    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it('die sieben Client-RPCs behalten authenticated — sonst waere es der 23.08. erneut', async () => {
    // Diese sieben stehen auch in REQUIRED_AUTHENTICATED von
    // scripts/check-function-acl-drift.mjs. Wer sie mitentzieht, wiederholt
    // den Fehler, den 20260826000001 reparieren musste.
    const CLIENT_RPCS = [
      'bulk_scan_batch_progress', 'create_api_key', 'evidence_vault_timeline',
      'governance_kpi_latest_snapshot', 'governance_kpi_range',
      'governance_kpi_timeseries_data', 'tenant_entitlements',
    ];
    const { rows } = await ctx!.client.query<{ proname: string }>(`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname = ANY ($1::text[])
        AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
      ORDER BY p.proname
    `, [CLIENT_RPCS]);

    expect(rows.map((r) => r.proname)).toEqual([]);
  });

  it('get_compliance_timeline steht NICHT auf der Schuldenliste — es ist behoben', async () => {
    // Gegenprobe zum Test darueber: Die Ausnahmeliste darf nicht zur
    // bequemen Ablage fuer neue Befunde werden. Der in diesem Durchgang
    // behobene Fall muss auch tatsaechlich verschwunden sein.
    expect([...UNBEDENKLICH, ...BEKANNTE_SCHULD]).not.toContain('get_compliance_timeline');
    const { rows } = await ctx!.client.query<{ anon: boolean }>(
      `SELECT has_function_privilege('anon',
         'public.get_compliance_timeline(text,uuid,integer)', 'EXECUTE') AS anon`,
    );
    expect(rows[0]!.anon).toBe(false);
  });

  it('get_compliance_timeline hat einen gesetzten search_path', async () => {
    const { rows } = await ctx!.client.query<{ cfg: string[] | null }>(
      `SELECT proconfig AS cfg FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='get_compliance_timeline'`,
    );
    expect(rows[0]!.cfg?.some((c) => c.startsWith('search_path='))).toBe(true);
  });
});

/**
 * B1 — Rechteausweitung ueber profiles.is_super_admin (ADR 0011).
 *
 * Der Befund war nicht, dass eine Policy fehlte, sondern dass die vorhandene
 * die falsche Frage stellte: Sie prueft, WELCHE ZEILE geschrieben wird, nie
 * WELCHE SPALTEN. Ein Test auf "es gibt eine UPDATE-Policy" waere gruen
 * gewesen und haette nichts bewiesen. Deshalb hier der Angriff selbst.
 *
 * Bewusst NICHT ueber Spalten-Grants geprueft: Der db-Job in ci.yml fuehrt
 * nach den Migrationen ein `GRANT ... ON ALL TABLES IN SCHEMA public` aus und
 * stellt den tabellenweiten Grant wieder her. Ein Test auf fehlende Grants
 * waere dort rot, obwohl Produktion in Ordnung ist — und genau diese
 * Bulk-Grant-Klasse ist der Grund, warum der Trigger die primaere
 * Verteidigung ist und nicht die Grants.
 */
d('B1 — profiles.is_super_admin ist clientseitig unveraenderlich', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function seedProfil(email: string): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email],
    );
    const userId = rows[0]!.id;
    await ctx!.client.query(`INSERT INTO public.profiles(id) VALUES ($1)`, [userId]);
    return userId;
  }

  it('ein eingeloggter Nutzer kann sich nicht selbst zum Plattform-Admin machen', async () => {
    const userId = await seedProfil('b1-angreifer@example.com');

    await expect(
      ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `UPDATE public.profiles SET is_super_admin = true WHERE id = $1`, [userId],
        );
      }),
    ).rejects.toThrow(/unveraenderlich|permission denied|denied/i);

    const { rows } = await ctx!.client.query<{ is_super_admin: boolean }>(
      `SELECT is_super_admin FROM public.profiles WHERE id = $1`, [userId],
    );
    expect(rows[0]!.is_super_admin).toBe(false);
  });

  it('die harmlosen Profilfelder bleiben schreibbar — der Fix darf nichts zumauern', async () => {
    const userId = await seedProfil('b1-normal@example.com');

    await ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      await ctx!.client.query(
        `UPDATE public.profiles SET full_name = 'Neuer Name', onboarding_step = 2 WHERE id = $1`,
        [userId],
      );
    });

    const { rows } = await ctx!.client.query<{ full_name: string; onboarding_step: number }>(
      `SELECT full_name, onboarding_step FROM public.profiles WHERE id = $1`, [userId],
    );
    expect(rows[0]!.full_name).toBe('Neuer Name');
    expect(rows[0]!.onboarding_step).toBe(2);
  });

  it('service_role darf die Rolle weiterhin vergeben — serverseitig, wie vorgesehen', async () => {
    const userId = await seedProfil('b1-serverseitig@example.com');

    await ctx!.withClaims({ sub: userId, role: 'service_role' }, async () => {
      await ctx!.client.query(
        `UPDATE public.profiles SET is_super_admin = true WHERE id = $1`, [userId],
      );
    });

    const { rows } = await ctx!.client.query<{ is_super_admin: boolean }>(
      `SELECT is_super_admin FROM public.profiles WHERE id = $1`, [userId],
    );
    expect(rows[0]!.is_super_admin).toBe(true);
  });

  it('der Schutz-Trigger ist SECURITY INVOKER — als DEFINER waere er wirkungslos', async () => {
    // Als SECURITY DEFINER saehe die Funktion immer 'postgres' in current_user
    // und liesse jede Aenderung durch. Der Test haelt genau diese Eigenschaft
    // fest, weil sie beim Lesen des Codes nicht ins Auge springt.
    const { rows } = await ctx!.client.query<{ prosecdef: boolean }>(
      `SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='profiles_guard_privileged_columns'`,
    );
    expect(rows[0]!.prosecdef).toBe(false);
  });
});

/**
 * ADR 0011, D5 — platform_operators als eigene Quelle der Plattform-Berechtigung.
 *
 * Der Sinn der Tabelle ist, dass der Beaufsichtigte sie nicht beschreiben kann.
 * Genau das wird hier geprueft — sonst waere die Rechteausweitung aus B1 nur
 * um eine Tabelle weitergewandert.
 */
d('D5 — platform_operators ist fuer Clients gesperrt', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function seedNutzer(email: string): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email],
    );
    return rows[0]!.id;
  }

  it('RLS ist aktiv und es gibt bewusst keine einzige Policy', async () => {
    const { rows } = await ctx!.client.query<{ rls: boolean; policies: string }>(`
      SELECT c.relrowsecurity AS rls,
             (SELECT count(*) FROM pg_policy WHERE polrelid = c.oid) AS policies
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'platform_operators'
    `);
    expect(rows[0]!.rls).toBe(true);
    expect(Number(rows[0]!.policies)).toBe(0);
  });

  it('ein eingeloggter Nutzer kann sich nicht selbst eintragen', async () => {
    const userId = await seedNutzer('d5-angreifer@example.com');

    await expect(
      ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.platform_operators(user_id) VALUES ($1)`, [userId],
        );
      }),
    ).rejects.toThrow();

    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.platform_operators WHERE user_id = $1`, [userId],
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it('ein eingeloggter Nutzer sieht die Tabelle nicht', async () => {
    const userId = await seedNutzer('d5-leser@example.com');
    await ctx!.client.query(`INSERT INTO public.platform_operators(user_id) VALUES ($1)`, [userId]);

    const sichtbar = await ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ n: string }>(
        `SELECT count(*) AS n FROM public.platform_operators`,
      );
      return Number(rows[0]!.n);
    }).catch(() => 0);
    expect(sichtbar).toBe(0);
  });

  it('is_platform_operator() trennt Eingetragene von Nicht-Eingetragenen', async () => {
    const operator = await seedNutzer('d5-operator@example.com');
    const normal = await seedNutzer('d5-normal@example.com');
    await ctx!.client.query(`INSERT INTO public.platform_operators(user_id) VALUES ($1)`, [operator]);

    const alsOperator = await ctx!.withClaims({ sub: operator, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ ok: boolean }>(`SELECT public.is_platform_operator() AS ok`);
      return rows[0]!.ok;
    });
    const alsNormal = await ctx!.withClaims({ sub: normal, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ ok: boolean }>(`SELECT public.is_platform_operator() AS ok`);
      return rows[0]!.ok;
    });

    expect(alsOperator).toBe(true);
    expect(alsNormal).toBe(false);
  });

  it('active=false entzieht die Berechtigung, ohne die Zeile zu loeschen', async () => {
    // Der Pruefpfad soll erhalten bleiben: Wer die Berechtigung hatte, bleibt
    // sichtbar — nur wirkt sie nicht mehr.
    const operator = await seedNutzer('d5-entzogen@example.com');
    await ctx!.client.query(
      `INSERT INTO public.platform_operators(user_id, active) VALUES ($1, false)`, [operator],
    );

    const ok = await ctx!.withClaims({ sub: operator, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ ok: boolean }>(`SELECT public.is_platform_operator() AS ok`);
      return rows[0]!.ok;
    });
    expect(ok).toBe(false);

    const { rows } = await ctx!.client.query<{ n: string }>(
      `SELECT count(*) AS n FROM public.platform_operators WHERE user_id = $1`, [operator],
    );
    expect(Number(rows[0]!.n)).toBe(1);
  });

  it('anon darf is_platform_operator() ausfuehren — sonst bricht jede Policy-Auswertung ab', async () => {
    // Lehre aus dem ACL-Vorfall vom 2026-08-23: Fehlt das EXECUTE-Recht,
    // liefert die Policy keinen false-Wert, sondern einen Fehler.
    const { rows } = await ctx!.client.query<{ anon: boolean; auth: boolean }>(`
      SELECT has_function_privilege('anon',          'public.is_platform_operator()', 'EXECUTE') AS anon,
             has_function_privilege('authenticated', 'public.is_platform_operator()', 'EXECUTE') AS auth
    `);
    expect(rows[0]!.anon).toBe(true);
    expect(rows[0]!.auth).toBe(true);
  });
});

/**
 * ADR 0011, D4 — org_units: die drei Scope-Fälle, ausdrücklich geprüft.
 *
 * Der Kern der Entscheidung ist, dass es DREI Fälle gibt und nicht zwei. Ein
 * Test, der nur „Mandant A sieht B nicht" prüft, würde den dritten übersehen —
 * und genau dort liegt das Risiko: eine Platform-Zeile (`tenant_id IS NULL`),
 * die durch die Lücke zwischen zwei Policies sichtbar wird.
 */
d('D4 — org_units trennt Platform Scope, eigenen und fremden Mandanten', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  /** Legt eine Einheit als Superuser an (Fixture, an RLS vorbei). */
  async function seedUnit(tenantId: string | null, key: string, parentId: string | null = null): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.org_units(tenant_id, key, name, parent_id)
       VALUES ($1, $2, $2, $3) RETURNING id`,
      [tenantId, key, parentId],
    );
    return rows[0]!.id;
  }

  /**
   * Fuehrt fn in einem SAVEPOINT aus. Noetig, weil ein erwarteter Fehler
   * (Unique-Verletzung, Trigger-Raise) sonst die ganze Testtransaktion
   * abbricht und jede weitere Anweisung mit "current transaction is aborted"
   * scheitert — der Test wuerde dann an der Mechanik fallen, nicht an der
   * Sache. withClaims macht dasselbe fuer die RLS-Faelle.
   */
  async function mitSavepoint<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_ou_${Math.random().toString(36).slice(2, 10)}`;
    await ctx!.client.query(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await ctx!.client.query(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (err) {
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw err;
    }
  }

  async function sichtbareKeys(userId: string): Promise<string[]> {
    return ctx!.withClaims({ sub: userId, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ key: string }>(
        `SELECT key FROM public.org_units ORDER BY key`,
      );
      return rows.map((r) => r.key);
    });
  }

  it('ein normaler Mandantennutzer sieht die Platform-Zeile nicht', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A', userEmail: 'ou-a@example.com' });
    await seedUnit(null, 'plattform-intern');
    await seedUnit(A.tenantId, 'mandant-a');

    expect(await sichtbareKeys(A.userId)).toEqual(['mandant-a']);
  });

  it('ein Plattform-Operator sieht die Platform-Zeile', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-op', userEmail: 'ou-op@example.com' });
    await ctx!.client.query(`INSERT INTO public.platform_operators(user_id) VALUES ($1)`, [A.userId]);
    await seedUnit(null, 'plattform-intern');
    await seedUnit(A.tenantId, 'mandant-a');

    expect(await sichtbareKeys(A.userId)).toEqual(['mandant-a', 'plattform-intern']);
  });

  it('ein fremder Mandant bleibt unsichtbar', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A2', userEmail: 'ou-a2@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ou-B2', userEmail: 'ou-b2@example.com' });
    await seedUnit(A.tenantId, 'einheit-a');
    await seedUnit(B.tenantId, 'einheit-b');

    expect(await sichtbareKeys(A.userId)).toEqual(['einheit-a']);
    expect(await sichtbareKeys(B.userId)).toEqual(['einheit-b']);
  });

  it('ein Mitglied ohne Verwaltungsrolle darf nicht anlegen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-editor', userEmail: 'ou-editor@example.com' });
    // createTenantWithMember vergibt 'owner' — hier auf 'editor' herunterstufen.
    await ctx!.client.query(
      `UPDATE public.memberships SET role='editor' WHERE tenant_id=$1 AND user_id=$2`,
      [A.tenantId, A.userId],
    );

    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.org_units(tenant_id, key, name) VALUES ($1,'schmuggel','Schmuggel')`,
          [A.tenantId],
        );
      }),
    ).rejects.toThrow();
  });

  it('ein Admin kann eine Einheit im eigenen Mandanten nicht in einen fremden schieben', async () => {
    // Ohne WITH CHECK auf der UPDATE-Policy waere genau das moeglich — derselbe
    // Fehler wie in Befund B1, nur mit tenant_id statt is_super_admin.
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A3', userEmail: 'ou-a3@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ou-B3', userEmail: 'ou-b3@example.com' });
    const unit = await seedUnit(A.tenantId, 'wandert');

    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `UPDATE public.org_units SET tenant_id = $1 WHERE id = $2`, [B.tenantId, unit],
        );
      }),
    ).rejects.toThrow();

    const { rows } = await ctx!.client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM public.org_units WHERE id = $1`, [unit],
    );
    expect(rows[0]!.tenant_id).toBe(A.tenantId);
  });

  it('die Hierarchie darf den Scope nicht überschreiten', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A4', userEmail: 'ou-a4@example.com' });
    const platform = await seedUnit(null, 'plattform-wurzel');

    await expect(
      mitSavepoint(() => seedUnit(A.tenantId, 'kind-am-falschen-baum', platform)),
    ).rejects.toThrow(/anderen Scope/);
  });

  it('ein Zyklus in der Hierarchie wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A5', userEmail: 'ou-a5@example.com' });
    const oben = await seedUnit(A.tenantId, 'oben');
    const unten = await seedUnit(A.tenantId, 'unten', oben);

    await expect(
      mitSavepoint(() =>
        ctx!.client.query(`UPDATE public.org_units SET parent_id = $1 WHERE id = $2`, [unten, oben]),
      ),
    ).rejects.toThrow(/Zyklus/);
  });

  it('key ist je Scope eindeutig, aber zwei Mandanten dürfen denselben key führen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ou-A6', userEmail: 'ou-a6@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ou-B6', userEmail: 'ou-b6@example.com' });

    await seedUnit(A.tenantId, 'vertrieb');
    await expect(mitSavepoint(() => seedUnit(B.tenantId, 'vertrieb'))).resolves.toBeTruthy();
    await expect(mitSavepoint(() => seedUnit(A.tenantId, 'vertrieb'))).rejects.toThrow();

    await seedUnit(null, 'vertrieb');
    await expect(mitSavepoint(() => seedUnit(null, 'vertrieb'))).rejects.toThrow();
  });
});

/**
 * ADR 0011, D4 (Option A) — agents und agent_roles.
 *
 * Der Entscheid vom 2026-09-04 trennt zwei Dinge, die vorher eines waren:
 * `agent_profiles` bleibt der globale Katalog interner Agenten, `agents` nimmt
 * die mandantenbezogenen auf. Die Tests prüfen genau die Grenze zwischen
 * beiden — denn wenn sie nicht hält, ist Befund B6 nur umgezogen.
 */
d('D4 — agents ist mandantengetrennt, agent_roles ist Katalog', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  async function mitSavepoint<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_ag_${Math.random().toString(36).slice(2, 10)}`;
    await ctx!.client.query(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await ctx!.client.query(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (err) {
      await ctx!.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw err;
    }
  }

  async function seedAgent(
    tenantId: string, name: string,
    opts: { orgUnitId?: string | null; role?: string } = {},
  ): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.agents(tenant_id, name, role_key, org_unit_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, name, opts.role ?? 'MonitoringAgent', opts.orgUnitId ?? null],
    );
    return rows[0]!.id;
  }

  async function seedUnit(tenantId: string | null, key: string): Promise<string> {
    const { rows } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO public.org_units(tenant_id, key, name) VALUES ($1,$2,$2) RETURNING id`,
      [tenantId, key],
    );
    return rows[0]!.id;
  }

  it('ein Mandant sieht nur die eigenen Agenten', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A', userEmail: 'ag-a@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ag-B', userEmail: 'ag-b@example.com' });
    await seedAgent(A.tenantId, 'Wächter A');
    await seedAgent(B.tenantId, 'Wächter B');

    const sichtbar = await ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ name: string }>(`SELECT name FROM public.agents`);
      return rows.map((r) => r.name);
    });
    expect(sichtbar).toEqual(['Wächter A']);
  });

  it('ein Mitglied ohne Verwaltungsrolle darf keinen Agenten anlegen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-ed', userEmail: 'ag-ed@example.com' });
    await ctx!.client.query(
      `UPDATE public.memberships SET role='editor' WHERE tenant_id=$1 AND user_id=$2`,
      [A.tenantId, A.userId],
    );

    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.agents(tenant_id, name, role_key) VALUES ($1,'Schmuggler','OutputAgent')`,
          [A.tenantId],
        );
      }),
    ).rejects.toThrow();
  });

  it('ein Admin kann einen Agenten nicht in einen fremden Mandanten umhängen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A2', userEmail: 'ag-a2@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ag-B2', userEmail: 'ag-b2@example.com' });
    const agent = await seedAgent(A.tenantId, 'Wandersmann');

    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(`UPDATE public.agents SET tenant_id=$1 WHERE id=$2`, [B.tenantId, agent]);
      }),
    ).rejects.toThrow();

    const { rows } = await ctx!.client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM public.agents WHERE id=$1`, [agent],
    );
    expect(rows[0]!.tenant_id).toBe(A.tenantId);
  });

  it('eine Organisationseinheit aus einem fremden Mandanten wird abgewiesen', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A3', userEmail: 'ag-a3@example.com' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ag-B3', userEmail: 'ag-b3@example.com' });
    const fremd = await seedUnit(B.tenantId, 'fremde-einheit');

    await expect(
      mitSavepoint(() => seedAgent(A.tenantId, 'Fehlzuordnung', { orgUnitId: fremd })),
    ).rejects.toThrow(/anderen Scope/);
  });

  it('auch eine Platform-Einheit ist für einen Mandanten-Agenten kein gültiger Ort', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A4', userEmail: 'ag-a4@example.com' });
    const plattform = await seedUnit(null, 'plattform-einheit');

    await expect(
      mitSavepoint(() => seedAgent(A.tenantId, 'Grenzgänger', { orgUnitId: plattform })),
    ).rejects.toThrow(/anderen Scope/);
  });

  it('eine unbekannte Rolle wird vom Katalog abgewiesen', async () => {
    // Der Fremdschlüssel auf agent_roles ist der Grund, warum der
    // Paritätstest zwischen SQL und TypeScript existiert: Eine Rolle, die es
    // nur in TypeScript gibt, scheitert genau hier — zur Laufzeit.
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A5', userEmail: 'ag-a5@example.com' });
    await expect(
      mitSavepoint(() => seedAgent(A.tenantId, 'Erfundene Rolle', { role: 'ErfundenerAgent' })),
    ).rejects.toThrow();
  });

  it('agent_roles trägt die neun Rollen und ist für Eingeloggte lesbar', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A6', userEmail: 'ag-a6@example.com' });
    const keys = await ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
      const { rows } = await ctx!.client.query<{ key: string }>(
        `SELECT key FROM public.agent_roles ORDER BY key`,
      );
      return rows.map((r) => r.key);
    });
    expect(keys).toHaveLength(9);
    expect(keys).toContain('TrainerAgent');
  });

  it('agent_roles ist für Clients nicht schreibbar — das Vokabular kommt per Migration', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ag-A7', userEmail: 'ag-a7@example.com' });
    await expect(
      ctx!.withClaims({ sub: A.userId, role: 'authenticated' }, async () => {
        await ctx!.client.query(
          `INSERT INTO public.agent_roles(key, description) VALUES ('SchattenAgent','geschmuggelt')`,
        );
      }),
    ).rejects.toThrow();
  });

  it('agent_profiles bleibt der globale Katalog — die Trennung aus Option A hält', async () => {
    // Wenn jemand agents und agent_profiles wieder zusammenlegt, faellt dieser
    // Test: agent_profiles hat bewusst keine tenant_id, agents hat sie zwingend.
    const { rows } = await ctx!.client.query<{ tabelle: string; nullable: string | null }>(`
      SELECT c.table_name AS tabelle, c.is_nullable AS nullable
        FROM information_schema.columns c
       WHERE c.table_schema='public' AND c.column_name='tenant_id'
         AND c.table_name IN ('agents','agent_profiles')
    `);
    const nachTabelle = Object.fromEntries(rows.map((r) => [r.tabelle, r.nullable]));
    expect(nachTabelle['agents']).toBe('NO');
    expect(nachTabelle['agent_profiles']).toBeUndefined();
  });
});
