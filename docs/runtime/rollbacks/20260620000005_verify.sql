-- Verifikations-SQL fuer 20260620000005_advisor_cost_cap_hardening.
--
-- Nach Anwendung der Migration im Supabase SQL Editor ausfuehren.
-- Erwartet: PASS auf allen Checks. Im PSQL-Stil reine SELECTs — kein DDL.

\echo === 1) Cost-Cap RPC EXECUTE-ACL (erwartet: kein anon/authenticated)
SELECT p.proname,
       (SELECT bool_or(acl LIKE 'anon=%')          FROM unnest(p.proacl::text[]) acl) AS anon_has_exec,
       (SELECT bool_or(acl LIKE 'authenticated=%') FROM unnest(p.proacl::text[]) acl) AS auth_has_exec,
       (SELECT bool_or(acl LIKE 'service_role=%')  FROM unnest(p.proacl::text[]) acl) AS svc_has_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('cost_check_and_reserve','cost_writer_settle',
                    'cost_sweep_expired_reservations','propagate_cost_attribution')
ORDER BY p.proname;
-- Erwartet:
--   cost_check_and_reserve:           anon=f auth=f svc=t
--   cost_sweep_expired_reservations:  anon=f auth=f svc=t
--   cost_writer_settle:               anon=f auth=f svc=t
--   propagate_cost_attribution:       anon=f auth=t svc=t

\echo === 2) Wrapper-Views auf security_invoker=true
SELECT c.relname,
       (SELECT bool_or(opt = 'security_invoker=true')
          FROM unnest(c.reloptions) opt) AS is_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN ('v_cost_per_tenant','v_cost_per_feature','v_cost_per_agent',
                    'v_tenant_risk_score','v_tenant_risk_cost_quadrant',
                    'v_compliance_signals_open','ai_evidence_retention_status')
ORDER BY c.relname;
-- Erwartet: alle 7 → is_invoker = true

\echo === 3) Materialized Views: kein anon/authenticated
SELECT c.relname,
       (SELECT bool_or(acl LIKE 'anon=%')          FROM unnest(c.relacl::text[]) acl) AS anon_has,
       (SELECT bool_or(acl LIKE 'authenticated=%') FROM unnest(c.relacl::text[]) acl) AS auth_has,
       (SELECT bool_or(acl LIKE 'service_role=%')  FROM unnest(c.relacl::text[]) acl) AS svc_has
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'm'
  AND c.relname IN ('mv_cost_per_tenant','mv_cost_per_feature','mv_cost_per_agent',
                    'mv_tenant_risk_score','mv_tenant_risk_cost_quadrant',
                    'mv_compliance_signals_open')
ORDER BY c.relname;
-- Erwartet: alle 6 → anon=f, auth=f, svc=t

\echo === 4) ai_evidence_retention_status View-ACL (kein anon/authenticated)
SELECT c.relname,
       (SELECT bool_or(acl LIKE 'anon=%')          FROM unnest(c.relacl::text[]) acl) AS anon_has,
       (SELECT bool_or(acl LIKE 'authenticated=%') FROM unnest(c.relacl::text[]) acl) AS auth_has,
       (SELECT bool_or(acl LIKE 'service_role=%')  FROM unnest(c.relacl::text[]) acl) AS svc_has
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'ai_evidence_retention_status';
-- Erwartet: anon=f auth=f svc=t

\echo === 5) Trigger search_path (tenant_cost_ledger_block_settled_mutation)
SELECT p.proname, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'tenant_cost_ledger_block_settled_mutation';
-- Erwartet: proconfig = {search_path=public, pg_temp}

\echo === 6) Negative-Probe: authenticated kann v_cost_per_feature noch lesen
-- (Manuell mit SET ROLE authenticated zu testen — Frontend muss weiter funktionieren.)
-- SET ROLE authenticated;
-- SELECT count(*) FROM public.v_cost_per_feature WHERE tenant_id = '<your_tenant_uuid>';
-- RESET ROLE;
