-- Security: SECURITY DEFINER Views auf SECURITY INVOKER umstellen (Advisor ERROR x7).
-- Materialized-View-Grants normalisieren (Advisor materialized_view_in_api WARN x6).
--
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md
-- Idempotent: ALTER VIEW SET / GRANT / REVOKE sind wiederholbar.

-- 1) Materialized-View-Grants normalisieren:
--    authenticated bekommt SELECT (noetig fuer SECURITY INVOKER auf den daruebergelegten Views).
--    anon verliert den direkten MV-Zugriff (war nie beabsichtigt; PostgREST-Exponierung entfernen).
grant  select on public.mv_cost_per_agent             to authenticated;
grant  select on public.mv_cost_per_tenant            to authenticated;
grant  select on public.mv_cost_per_feature           to authenticated;
grant  select on public.mv_tenant_risk_cost_quadrant  to authenticated;
grant  select on public.mv_tenant_risk_score          to authenticated;
grant  select on public.mv_compliance_signals_open    to authenticated;

revoke select on public.mv_cost_per_agent             from anon;
revoke select on public.mv_cost_per_tenant            from anon;
revoke select on public.mv_cost_per_feature           from anon;
revoke select on public.mv_tenant_risk_cost_quadrant  from anon;
revoke select on public.mv_tenant_risk_score          from anon;
revoke select on public.mv_compliance_signals_open    from anon;

-- 2) Views auf SECURITY INVOKER umstellen (Advisor security_definer_view, ERROR x7).
--    Die WHERE-Klauseln (has_tenant_membership / RLS auf Basis-Tabellen) bleiben als
--    Zugriffskontrolle erhalten — SECURITY DEFINER ist nicht mehr noetig.
alter view public.v_cost_per_agent             set (security_invoker = on);
alter view public.v_cost_per_tenant            set (security_invoker = on);
alter view public.v_cost_per_feature           set (security_invoker = on);
alter view public.v_tenant_risk_cost_quadrant  set (security_invoker = on);
alter view public.v_tenant_risk_score          set (security_invoker = on);
alter view public.ai_evidence_retention_status set (security_invoker = on);
alter view public.v_compliance_signals_open    set (security_invoker = on);
