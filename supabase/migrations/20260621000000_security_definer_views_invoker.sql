-- Fix: seven views run with SECURITY DEFINER (creator) rights and therefore
-- bypass RLS of the querying user. Recreate-flag them with security_invoker = true
-- so each view respects the caller's RLS policies on the underlying tables.
--
-- Advisor: security_definer_view (ERROR) ×7
--   public.v_cost_per_agent
--   public.v_cost_per_tenant
--   public.v_cost_per_feature
--   public.v_tenant_risk_cost_quadrant
--   public.v_tenant_risk_score
--   public.v_compliance_signals_open
--   public.ai_evidence_retention_status
--
-- Background: the six economic-intelligence views were (re)created by
-- 20260604000000_economic_intelligence.sql without security_invoker; the evidence
-- view's earlier fix (20260524100000) was applied only via execute_sql at runtime
-- and was overwritten by a later `create or replace view`, so it regressed. This
-- migration is the DURABLE form — it survives the migration history and re-runs
-- idempotently (ALTER VIEW ... SET runs whether or not the flag is already set).
--
-- Note: search_path is irrelevant for a view body; the underlying tables are
-- fully schema-qualified (public.*). RLS on those tables now applies per querant.

alter view if exists public.v_cost_per_agent            set (security_invoker = true);
alter view if exists public.v_cost_per_tenant           set (security_invoker = true);
alter view if exists public.v_cost_per_feature          set (security_invoker = true);
alter view if exists public.v_tenant_risk_cost_quadrant set (security_invoker = true);
alter view if exists public.v_tenant_risk_score         set (security_invoker = true);
alter view if exists public.v_compliance_signals_open   set (security_invoker = true);
alter view if exists public.ai_evidence_retention_status set (security_invoker = true);
