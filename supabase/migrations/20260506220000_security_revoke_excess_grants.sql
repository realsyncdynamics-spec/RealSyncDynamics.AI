-- Revoke anon/authenticated EXECUTE on functions that should never be exposed
-- as public RPC endpoints. They retain SECURITY DEFINER + internal access
-- checks but are no longer reachable via /rest/v1/rpc/ for anon callers.

-- 1. Trigger-only functions (called by INSERT/UPDATE triggers, never as RPC)
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_usage_total_on_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_workflow_run_stats() FROM PUBLIC, anon, authenticated;

-- 2. Maintenance/admin functions (called from cron or Edge Functions only)
REVOKE ALL ON FUNCTION public.sweep_stale_workflow_runs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_usage_total(uuid, text, date, integer) FROM PUBLIC, anon, authenticated;

-- 3. CreatorSeal legacy functions (no current frontend caller)
REVOKE ALL ON FUNCTION public.creatorseal_insert_user_key(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.creatorseal_load_user_key(uuid, text) FROM PUBLIC, anon, authenticated;

-- 4. Admin-only RPCs: revoke anon (still authenticated required for super_admin gate)
REVOKE EXECUTE ON FUNCTION public.admin_customers_list() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_system_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_funnel(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_pageviews_daily(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_sources(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.analytics_top_pages(integer, integer) FROM anon;

-- 5. api_key_validate: only Edge Functions (service_role) call this
REVOKE EXECUTE ON FUNCTION public.api_key_validate(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_key_validate(text) TO service_role;
