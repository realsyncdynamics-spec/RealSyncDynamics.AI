-- Revoke anon/authenticated EXECUTE on functions that should never be exposed
-- as public RPC endpoints. Wrapped in DO/EXCEPTION blocks because some
-- functions are production-only (CreatorSeal legacy, agentos partition mgmt).

DO $$ BEGIN REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.sync_usage_total_on_event() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.bump_workflow_run_stats() FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.sweep_stale_workflow_runs(integer) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.upsert_usage_total(uuid, text, date, integer) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.creatorseal_insert_user_key(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.creatorseal_load_user_key(uuid, text) FROM PUBLIC, anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_customers_list() FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.admin_system_health() FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.analytics_funnel(integer) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.analytics_pageviews_daily(integer) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.analytics_sources(integer) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.analytics_top_pages(integer, integer) FROM anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.api_key_validate(text) FROM anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.api_key_validate(text) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
