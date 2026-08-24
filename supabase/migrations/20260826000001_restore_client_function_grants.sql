-- Wiederherstellung der Client-EXECUTE-Grants nach Out-of-Band-Revoke.
--
-- Befund (gemessen 2026-08-23 direkt gegen RealSyncDynamicsLive, ebljyceifhnlzhjfyxup):
-- ~160 Funktionen in `public` hatten die ACL `{postgres=X,service_role=X}` —
-- EXECUTE fuer `anon`/`authenticated`/PUBLIC war entzogen. Kein Repo-Migration
-- enthaelt diesen Revoke; er wurde ausserhalb des Repos direkt gegen Prod
-- ausgefuehrt (Zeitpunkt >24h vor Messung, in den Postgres-Logs nicht mehr
-- greifbar). Zusaetzlich war `update_onboarding_progress` komplett gedroppt,
-- obwohl `20260508010000` im Ledger steht.
--
-- Sichtbares Symptom: "permission denied for function is_tenant_member" auf
-- /welcome (Schritt 2, api_keys-Query) — und damit jede RLS-Policy, die die
-- SECURITY-DEFINER-Helper aufruft, fuer eingeloggte Nutzer kaputt.
--
-- Diese Migration stellt NICHT den alten Default (PUBLIC-EXECUTE auf allem)
-- wieder her, sondern gezielt nur, was Client-Rollen nachweislich brauchen:
--   1. Die vier RLS-Helper (anon + authenticated — anon liefert via
--      auth.uid() = NULL schlicht false, Policies ohne TO-Klausel duerfen
--      nicht mit 42501 abbrechen).
--   2. Die vom SPA per supabase.rpc()/REST aufgerufenen Funktionen
--      (authenticated; anon nur fuer die bewusst oeffentlichen).
--   3. `update_onboarding_progress` — verbatim aus 20260508010000 neu
--      angelegt samt Grants.
-- Alles andere (Cron-, Trigger-, Worker-Funktionen) bleibt auf
-- postgres/service_role beschraenkt — das entspricht dem Security-Advisor
-- und den bestehenden Lockdown-Migrationen (20260620000000 u. a.).
--
-- Idempotent: CREATE OR REPLACE + wiederholbare GRANTs; auf frischem Postgres
-- (CI, `db reset`) sind alle Funktionen durch fruehere Migrationen vorhanden,
-- fehlende Namen werden uebersprungen.

-- ── 1. update_onboarding_progress wiederherstellen (verbatim 20260508010000) ──

create or replace function public.update_onboarding_progress(
    p_step             int,
    p_api_key_id       uuid default null,
    p_domain_connected text default null
)
returns table (id uuid, step int, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_email text;
begin
    select u.email into v_user_email
    from auth.users u
    where u.id = auth.uid();

    if v_user_email is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;

    if p_step < 1 or p_step > 4 then
        raise exception 'step out of range (1..4)' using errcode = '22023';
    end if;

    return query
    update public.customer_onboarding
       set step             = p_step,
           api_key_id       = coalesce(p_api_key_id, api_key_id),
           domain_connected = coalesce(p_domain_connected, domain_connected),
           completed_at     = case when p_step >= 4 then now() else completed_at end
     where email = v_user_email
    returning customer_onboarding.id, customer_onboarding.step, customer_onboarding.completed_at;
end;
$$;

revoke all on function public.update_onboarding_progress(int, uuid, text) from public;
grant execute on function public.update_onboarding_progress(int, uuid, text) to authenticated;

comment on function public.update_onboarding_progress(int, uuid, text) is
    'Allow the authenticated user to advance their own customer_onboarding row''s wizard state. Updates are scoped to (step, api_key_id, domain_connected, completed_at); other columns remain controlled by the stripe-webhook. Returns one row per match (zero rows if no onboarding row exists for the user''s email).';

-- ── 2. Client-Grants wiederherstellen ────────────────────────────────────────

do $$
declare
    fn record;
    -- Oeffentlich (anon + authenticated): RLS-Helper und bewusst oeffentliche
    -- Endpunkte (Share-Links, Tracker-Meldung, Health, Landing-Statistiken).
    v_anon text[] := array[
        'is_tenant_member',
        'is_tenant_owner_or_admin',
        'is_tenant_admin',
        'has_tenant_membership',
        'audit_share_get',
        'report_unknown_tracker',
        'affiliate_validate',
        'platform_stats',
        'health_ping',
        'log_seo_dashboard_operation'
    ];
    -- Nur authenticated: alles, was das SPA hinter Login per rpc() aufruft.
    -- admin_*/analytics_* self-gaten via profiles.is_super_admin
    -- (siehe 20260620000000); die Grants entsprechen den urspruenglichen
    -- Migrationen bzw. dem Default vor dem Revoke.
    v_auth text[] := array[
        'admin_customers_list',
        'admin_system_health',
        'adjust_worker_pool',
        'analytics_funnel',
        'analytics_pageviews_daily',
        'analytics_sources',
        'analytics_top_pages',
        'bulk_scan_batch_progress',
        'compute_racpo',
        'compute_tenant_quadrant',
        'create_api_key',
        'create_oauth2_app',
        'create_workflow',
        'evidence_vault_timeline',
        'get_compliance_timeline',
        'get_rate_limit_status',
        'get_worker_pool_metrics',
        'governance_24h_summary',
        'governance_alerts_list',
        'governance_kpi_latest_snapshot',
        'governance_kpi_range',
        'governance_kpi_timeseries_data',
        'incident_correlation_export',
        'retry_failed_batch_items',
        'revoke_oauth2_token',
        'rotate_oauth2_secret',
        'runtime_events_verify_chain',
        'siteos_site_overview',
        'sync_workflow_status',
        'tenant_entitlements',
        'update_onboarding_progress',
        'update_workflow'
    ];
begin
    for fn in
        select p.proname,
               format('public.%I(%s)', p.proname,
                      pg_get_function_identity_arguments(p.oid)) as sig
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = any (v_anon || v_auth)
    loop
        execute format('grant execute on function %s to authenticated', fn.sig);
        if fn.proname = any (v_anon) then
            execute format('grant execute on function %s to anon', fn.sig);
        end if;
    end loop;
end $$;
