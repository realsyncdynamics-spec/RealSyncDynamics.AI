-- Repo-Funktions-Grants an den Produktionsstand angleichen.
--
-- BEFUND
--
-- Ein aus dem Repo neu aufgebautes Schema (`supabase db reset`, CI, Staging,
-- neue Region) ist deutlich offener als die laufende Produktion. Gemessen:
--
--   Produktion : 17 SECURITY-DEFINER-Funktionen sind fuer `anon` ausfuehrbar
--   Repo       : 93
--
-- Die Differenz stammt aus dem Out-of-Band-Revoke, den 20260826000001 in
-- seinem Kopf beschreibt: Er wurde direkt gegen Prod ausgefuehrt und nie als
-- Migration festgeschrieben. Prod ist seitdem eng, das Repo blieb weit.
--
-- Ursache ist der Postgres-Default: `CREATE FUNCTION` vergibt EXECUTE an
-- PUBLIC. Wer beim Anlegen kein REVOKE schreibt, oeffnet die Funktion fuer
-- `anon` — ohne dass irgendwo ein GRANT steht, an dem man es sehen wuerde.
--
-- WARUM DAS BISHER LIEGENGEBLIEBEN IST
--
-- Der pauschale Weg ist genau der Fehler vom 2026-08-23: Ein breiter Revoke
-- hatte ~160 Funktionen auf {postgres, service_role} reduziert und damit
-- `is_tenant_member()` fuer eingeloggte Nutzer gesperrt — jede RLS-Policy,
-- die den Helper aufruft, brach mit 42501. 20260826000001 existiert nur,
-- um das zu reparieren. Ein zweiter Blindschuss verbietet sich.
--
-- WAS DIESE MIGRATION STATTDESSEN TUT
--
-- Sie leitet den Zielzustand nicht her, sondern **uebernimmt ihn aus der
-- Produktion**. Gemessen am 2026-09-01 gegen RealSyncDynamicsLive
-- (ebljyceifhnlzhjfyxup) fuer die 59 Funktionen, die
-- security-regressions.db.test.ts als BEKANNTE_SCHULD fuehrt:
--
--   * alle 59 existieren in Prod, in genau einer Signatur (keine Overloads)
--   * alle 59 haben dort `anon`  = false
--   * 52 haben dort auch `authenticated` = false
--   *  7 haben dort `authenticated` = true
--   * alle 59 haben dort `service_role` = true
--
-- Das ist kein Entwurf, sondern der Zustand eines Systems, das seit dem
-- 2026-08-23 unter Last laeuft. Was hier entzogen wird, ist in Produktion
-- seit ueber einer Woche entzogen — die Migration kann folglich nichts
-- brechen, was nicht schon gebrochen waere.
--
-- Aufrufer einzeln gegengeprueft, wie im Audit verlangt:
--   * keiner der 52 wird aus `src/` aufgerufen — weder per rpc() noch sonst
--   * 11 der 52 werden aus `supabase/functions/` aufgerufen; Edge Functions
--     sprechen mit dem Service-Role-Key, und der behaelt EXECUTE
--   * die 7 mit `authenticated` stehen bereits in REQUIRED_AUTHENTICATED von
--     scripts/check-function-acl-drift.mjs — der Guard verlangt sie also
--     ohnehin und bleibt gruen
--   * keiner der 52 steht in einer Pflichtliste des Guards
--
-- WARUM service_role EXPLIZIT GRANTET WIRD
--
-- `REVOKE ... FROM PUBLIC` nimmt auch dem Service-Role das Recht, wenn es
-- dort nur ueber PUBLIC bestand. Genau so entstand der Vorfall vom
-- 2026-08-23. Deshalb bekommt jede beruehrte Funktion ihren eigenen
-- expliziten Service-Role-Grant, bevor der Entzug greift.
--
-- Additiv und idempotent: Es werden nur Rechte gesetzt, keine Funktion
-- geaendert, keine Signatur beruehrt, keine Daten angefasst. Namen, die im
-- jeweiligen Schema nicht existieren, ueberspringt die Schleife still —
-- dieselbe Eigenschaft, die 20260826000001 bereits nutzt.

BEGIN;

do $$
declare
    fn record;

    -- Nur service_role. In Produktion haben diese 59 minus der 7 unten
    -- weder anon noch authenticated. Aufrufer sind Cron-Jobs, Trigger und
    -- Edge Functions — alle mit Service-Role-Key.
    v_intern text[] := array[
        'acknowledge_compliance_alert',
        'add_dashboard_insight',
        'analyze_governance_gaps_from_workflow',
        'approve_optimization_recommendation',
        'assess_ai_act_risk',
        'audit_findings_by_severity',
        'calculate_compliance_score',
        'calculate_iso27001_maturity',
        'calculate_iso42001_maturity',
        'check_feature_usage',
        'check_nis2_deadline_compliance',
        'complete_optimization_execution',
        'complete_workflow',
        'count_open_gaps_by_severity',
        'create_nis2_deadlines',
        'create_notification',
        'evidence_purgeable',
        'find_evidence_by_framework',
        'generate_compliance_summary',
        'get_cache_hit_rate',
        'get_dashboard_summary',
        'get_feature_quota',
        'get_notification_preferences',
        'get_notifications',
        'get_or_create_default_autonomous_agents',
        'get_or_create_governance_workflow',
        'get_slow_queries',
        'get_tenant_branding',
        'get_tenant_plan_key',
        'get_unread_notification_count',
        'get_unresolved_alerts',
        'has_feature',
        'list_expiring_evidence',
        'list_high_risk_ai_systems',
        'list_nis2_incidents_nearing_deadline',
        'list_overdue_iso_reviews',
        'log_c2pa_provenance',
        'log_compliance_alert',
        'log_notification_event',
        'log_query',
        'mark_notification_read',
        'notify_quota_alert',
        'partner_get_quota_used',
        'partner_increment_quota',
        'queue_email_notification',
        'recommend_governance_plan',
        'resolve_compliance_alert',
        'save_workflow_progress',
        'save_workflow_step',
        'start_optimization_execution',
        'update_compliance_score',
        'update_member_role'
    ];

    -- Nur authenticated (plus service_role). Dieselbe Rolle wie in Prod und
    -- dieselbe Liste, die check-function-acl-drift.mjs als Pflicht fuehrt.
    v_auth text[] := array[
        'bulk_scan_batch_progress',
        'create_api_key',
        'evidence_vault_timeline',
        'governance_kpi_latest_snapshot',
        'governance_kpi_range',
        'governance_kpi_timeseries_data',
        'tenant_entitlements'
    ];
begin
    for fn in
        select p.oid::regprocedure as sig, p.proname
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.prokind = 'f'
           and p.proname = any (v_intern || v_auth)
    loop
        -- Erst der eigene Service-Role-Grant, dann der Entzug: Sonst haengt
        -- service_role zwischenzeitlich am PUBLIC-Recht, das gleich faellt.
        execute format('grant execute on function %s to service_role', fn.sig);

        if fn.proname = any (v_auth) then
            execute format('revoke all on function %s from public, anon', fn.sig);
            execute format('grant execute on function %s to authenticated', fn.sig);
        else
            execute format(
                'revoke all on function %s from public, anon, authenticated', fn.sig);
        end if;
    end loop;
end $$;

COMMIT;
