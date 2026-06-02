-- Security: SECURITY DEFINER Views auf SECURITY INVOKER umstellen (Advisor ERROR x7).
-- Materialized-View-Grants normalisieren (Advisor materialized_view_in_api WARN x6).
--
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md
-- Idempotent: ALTER VIEW SET / GRANT / REVOKE sind wiederholbar.
--
-- [hotfix] Alle MV/View-Objekte werden erst in 20260605000000_economic_intelligence_mvs.sql
-- erstellt. Grants und ALTER VIEW daher mit IF EXISTS / Exception-Handling absichern,
-- damit die Migration in einem frischen DB-Setup nicht scheitert.

-- 1) Materialized-View-Grants normalisieren (konditionell — MVs evtl. noch nicht vorhanden):
DO $$
DECLARE
  mv text;
  mv_names text[] := ARRAY[
    'mv_cost_per_agent',
    'mv_cost_per_tenant',
    'mv_cost_per_feature',
    'mv_tenant_risk_cost_quadrant',
    'mv_tenant_risk_score',
    'mv_compliance_signals_open'
  ];
BEGIN
  FOREACH mv IN ARRAY mv_names LOOP
    BEGIN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', mv);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE format('REVOKE SELECT ON public.%I FROM anon', mv);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- 2) Views auf SECURITY INVOKER umstellen (konditionell — Views evtl. noch nicht vorhanden):
DO $$
DECLARE
  vw text;
  view_names text[] := ARRAY[
    'v_cost_per_agent',
    'v_cost_per_tenant',
    'v_cost_per_feature',
    'v_tenant_risk_cost_quadrant',
    'v_tenant_risk_score',
    'v_compliance_signals_open'
  ];
BEGIN
  FOREACH vw IN ARRAY view_names LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', vw);
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- ai_evidence_retention_status existiert seit 20260510 — direkt setzen:
ALTER VIEW public.ai_evidence_retention_status SET (security_invoker = on);
