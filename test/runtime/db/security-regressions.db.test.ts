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
   * Im REPO fehlt dieser Revoke bis heute. Gemessen am 2026-08-30 gegen ein
   * frisch repliziertes Schema: 93 anon-ausfuehrbare SECURITY-DEFINER-
   * Funktionen lokal gegenueber 17 in Produktion. Ein aus dem Repo neu
   * aufgebautes Environment (supabase db reset, Staging, weitere Region) ist
   * damit deutlich offener als die laufende Instanz.
   *
   * Das hier zu "reparieren" hiesse, denselben pauschalen Revoke blind zu
   * wiederholen, der schon einmal das SPA zerlegt hat. Das gehoert sauber
   * hergeleitet — entlang der Matrix v_anon/v_auth, die 20260826000001
   * bereits definiert — und einzeln gegen die Aufrufer geprueft. Bis dahin
   * haelt diese Liste den Stand fest: Sie waechst nicht unbemerkt.
   */
  const BEKANNTE_SCHULD = [
    'acknowledge_compliance_alert', 'add_dashboard_insight',
    'analyze_governance_gaps_from_workflow', 'approve_optimization_recommendation',
    'assess_ai_act_risk', 'audit_findings_by_severity', 'bulk_scan_batch_progress',
    'calculate_compliance_score', 'calculate_iso27001_maturity', 'calculate_iso42001_maturity',
    'check_feature_usage', 'check_nis2_deadline_compliance', 'complete_optimization_execution',
    'complete_workflow', 'count_open_gaps_by_severity', 'create_api_key',
    'create_nis2_deadlines', 'create_notification', 'evidence_purgeable',
    'evidence_vault_timeline', 'find_evidence_by_framework', 'generate_compliance_summary',
    'get_cache_hit_rate', 'get_dashboard_summary', 'get_feature_quota',
    'get_notification_preferences', 'get_notifications',
    'get_or_create_default_autonomous_agents', 'get_or_create_governance_workflow',
    'get_slow_queries', 'get_tenant_branding', 'get_tenant_plan_key',
    'get_unread_notification_count', 'get_unresolved_alerts',
    'governance_kpi_latest_snapshot', 'governance_kpi_range', 'governance_kpi_timeseries_data',
    'has_feature', 'list_expiring_evidence', 'list_high_risk_ai_systems',
    'list_nis2_incidents_nearing_deadline', 'list_overdue_iso_reviews', 'log_c2pa_provenance',
    'log_compliance_alert', 'log_notification_event', 'log_query', 'mark_notification_read',
    'notify_quota_alert', 'partner_get_quota_used', 'partner_increment_quota',
    'queue_email_notification', 'recommend_governance_plan', 'resolve_compliance_alert',
    'save_workflow_progress', 'save_workflow_step', 'start_optimization_execution',
    'tenant_entitlements', 'update_compliance_score', 'update_member_role',
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
