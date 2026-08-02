-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02).
-- Direkt auf Prod angewendet, nie ins Repo committet (Drift). Inhalt 1:1 aus
-- supabase_migrations.schema_migrations (Version 20260720123325).

-- Fix auth_rls_initplan WARN: wrap auth.<fn>() calls in (select ...) so Postgres
-- evaluates them once per query instead of once per row. Pure perf fix, no
-- behavioral/access change.

ALTER POLICY "user_own_consents" ON public.user_consents
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "service_role_all_snapshots" ON public.governance_kpi_snapshots
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "service_role_all_timeseries" ON public.governance_kpi_timeseries
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "users_own_filters_all" ON public.governance_kpi_filters
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY "users_select_own_filters" ON public.governance_kpi_filters
  USING (
    (SELECT is_tenant_member(governance_kpi_filters.tenant_id))
    AND (user_id = (select auth.uid()))
  );

ALTER POLICY "generated_documents super_admin_read" ON public.generated_documents
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.is_super_admin = true
    )
  );

-- Fix duplicate_index WARN: governance_events had two identical btree
-- indexes on risk_level. Drop the redundant one.
DROP INDEX IF EXISTS public.idx_governance_events_risk;

-- Fix function_search_path_mutable WARN: pin search_path so the trigger
-- function can't be hijacked via a mutable search_path.
ALTER FUNCTION public.bots_touch_updated_at() SET search_path = '';
