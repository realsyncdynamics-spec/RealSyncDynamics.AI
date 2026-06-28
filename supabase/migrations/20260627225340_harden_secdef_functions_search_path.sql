-- harden_secdef_functions_search_path
--
-- Reconcile: Diese Migration wurde bereits auf die Remote-DB angewendet
-- (schema_migrations 20260627225340, 2026-06-27), lag aber nicht im Repo und
-- erzeugte damit Migrations-Drift. Hier verbatim aus dem angewendeten Stand
-- nachgereicht (kein neuer Schema-Eingriff).
--
-- Inhalt: pinnt den search_path der governance_kpi_* RPCs (aus
-- 20260625000000_governance_analytics_schema) — Security-Hardening in der
-- Reihe von 20260530210241_pin_remaining_function_search_paths.

ALTER FUNCTION public.governance_kpi_latest_snapshot(p_tenant_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.governance_kpi_range(p_tenant_id uuid, p_start_date date, p_end_date date) SET search_path = public, pg_temp;
ALTER FUNCTION public.governance_kpi_timeseries_data(p_tenant_id uuid, p_start_date date, p_end_date date, p_group_by text) SET search_path = public, pg_temp;
