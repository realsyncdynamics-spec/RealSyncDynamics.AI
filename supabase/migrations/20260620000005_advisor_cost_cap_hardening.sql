-- Advisor-Hardening fuer Cost-Cap, Cost-Views, Materialized Views und Trigger-Funktionen.
--
-- Kontext (Verifikation 2026-05-29, vorangegangener Systemcheck):
-- Der Supabase-Security-Advisor flaggte nach den Cap-Enforcement- und
-- Economic-Intelligence-Migrationen mehrere Findings, die durch die
-- vorherigen REVOKE-Statements NICHT erfasst wurden:
--
--   ERRORS:
--     - security_definer_view (7x): cost/risk/compliance Wrapper-Views
--       laufen als Owner statt als Caller und umgehen so die RLS, die
--       sie eigentlich schuetzen sollen.
--
--   WARNS:
--     - anon/authenticated_security_definer_function_executable:
--       cost_check_and_reserve, cost_writer_settle,
--       cost_sweep_expired_reservations, propagate_cost_attribution
--       sind via /rest/v1/rpc/* von anon/authenticated aufrufbar.
--       Die fruehere REVOKE ALL ... FROM PUBLIC greift NICHT, wenn
--       anon/authenticated explizite Grants haben (Supabase-Default).
--     - materialized_view_in_api: mv_cost_per_*, mv_compliance_signals_open
--       sind anon zugaenglich, obwohl REVOKE FROM PUBLIC, authenticated
--       in 20260605000000 das verhindern sollte.
--     - function_search_path_mutable: tenant_cost_ledger_block_settled_mutation
--       (Trigger-Funktion) hat keinen expliziten search_path.
--
-- Ziel:
--   - cost_check_and_reserve / cost_writer_settle / cost_sweep_expired_reservations
--     ausschliesslich via service_role aufrufbar (Edge-Functions).
--   - propagate_cost_attribution behaelt authenticated (interne
--     has_tenant_membership-Pruefung), aber nicht anon.
--   - Wrapper-Views auf security_invoker=true, damit die RLS der
--     darunterliegenden Tabellen + has_tenant_membership-Filter
--     greifen statt Owner-Bypass.
--   - Materialized Views komplett aus der REST-API entfernen (auch
--     fuer anon), Zugriff nur ueber den security_invoker-Wrapper.
--   - tenant_cost_ledger_block_settled_mutation: expliziter search_path.
--
-- NICHT angefasst:
--   - resolve_ai_residency  (bereits gehaertet in 20260620000000_lockdown_internal_functions.sql)
--   - cost_check_and_reserve search_path (bereits SET search_path=public)
--   - has_tenant_membership-Filter in den Wrapper-Views (bleibt
--     Defense-in-Depth zusaetzlich zu security_invoker)
--   - SECURITY DEFINER auf den RPCs (gewollt, damit der Aufruf via
--     service_role-only Postgres-Funktionen die Ledger-Tabellen
--     schreiben darf)
--
-- Idempotent: alle Statements sind wiederholbar (REVOKE/GRANT/ALTER VIEW
-- SET / CREATE OR REPLACE / ALTER FUNCTION ... SET).
-- Rollback: 20260620000005_advisor_cost_cap_hardening_DOWN.sql

BEGIN;

-- ============================================================
-- 1) Cost-Cap RPCs: anon/authenticated EXECUTE entziehen
-- ============================================================
-- REVOKE FROM PUBLIC entfernt nur den PUBLIC-Pseudo-Grant. Supabase
-- vergibt anon/authenticated explizite Grants via Schema-Defaults, die
-- davon nicht erfasst werden. Daher hier explizit REVOKE FROM anon, authenticated.

REVOKE EXECUTE ON FUNCTION public.cost_check_and_reserve(uuid, text, numeric, numeric, jsonb)
    FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cost_check_and_reserve(uuid, text, numeric, numeric, jsonb)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.cost_writer_settle(uuid, text, numeric, numeric)
    FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cost_writer_settle(uuid, text, numeric, numeric)
    TO service_role;

REVOKE EXECUTE ON FUNCTION public.cost_sweep_expired_reservations()
    FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cost_sweep_expired_reservations()
    TO service_role;

-- propagate_cost_attribution: behaelt authenticated (Funktion hat
-- internen has_tenant_membership-Check), nur anon entfernen.
REVOKE EXECUTE ON FUNCTION public.propagate_cost_attribution(uuid, uuid)
    FROM anon;

-- ============================================================
-- 2) Cost/Risk/Compliance Wrapper-Views auf SECURITY INVOKER
-- ============================================================
-- Default in PG ist SECURITY DEFINER (view-Owner = postgres). Bei
-- security_invoker=true laeuft die View als Caller und respektiert die
-- RLS-Policies der darunterliegenden Objekte. Der zusaetzliche
-- has_tenant_membership-Filter in der View bleibt als Belt-and-Suspenders
-- erhalten — er deckt auch den Fall ab, dass die darunterliegende MV
-- (keine RLS auf MV in PG16) ohne RLS-Schutz auskommen muss.

ALTER VIEW public.v_cost_per_tenant            SET (security_invoker = true);
ALTER VIEW public.v_cost_per_feature           SET (security_invoker = true);
ALTER VIEW public.v_cost_per_agent             SET (security_invoker = true);
ALTER VIEW public.v_tenant_risk_score          SET (security_invoker = true);
ALTER VIEW public.v_tenant_risk_cost_quadrant  SET (security_invoker = true);
ALTER VIEW public.v_compliance_signals_open    SET (security_invoker = true);

-- ai_evidence_retention_status wurde in 20260524100000 bereits auf
-- security_invoker=true gesetzt. Hier nur idempotent absichern, falls
-- ein spaeterer CREATE OR REPLACE die Einstellung wieder ueberschrieben hat.
ALTER VIEW public.ai_evidence_retention_status SET (security_invoker = true);

-- ============================================================
-- 3) Materialized Views aus der REST-API entfernen
-- ============================================================
-- Der REVOKE FROM PUBLIC, authenticated in 20260605000000 entfernte
-- nicht den Default-anon-Grant. Hier explizit entfernen.
-- Die security_invoker-Wrapper-Views (Schritt 2) bleiben der einzige
-- legitime Lesepfad fuer Frontend-Caller.

REVOKE ALL ON public.mv_cost_per_tenant            FROM anon, authenticated;
REVOKE ALL ON public.mv_cost_per_feature           FROM anon, authenticated;
REVOKE ALL ON public.mv_cost_per_agent             FROM anon, authenticated;
REVOKE ALL ON public.mv_tenant_risk_score          FROM anon, authenticated;
REVOKE ALL ON public.mv_tenant_risk_cost_quadrant  FROM anon, authenticated;
REVOKE ALL ON public.mv_compliance_signals_open    FROM anon, authenticated;

GRANT SELECT ON public.mv_cost_per_tenant            TO service_role;
GRANT SELECT ON public.mv_cost_per_feature           TO service_role;
GRANT SELECT ON public.mv_cost_per_agent             TO service_role;
GRANT SELECT ON public.mv_tenant_risk_score          TO service_role;
GRANT SELECT ON public.mv_tenant_risk_cost_quadrant  TO service_role;
GRANT SELECT ON public.mv_compliance_signals_open    TO service_role;

-- ============================================================
-- 4) ai_evidence_retention_status: anon-Grant entfernen
-- ============================================================
-- Migration 20260524100000 hat die View auf security_invoker umgestellt,
-- aber den default-Grant fuer anon nicht entzogen. Die View ist im
-- Frontend nicht referenziert (nur in einer Description-String); kein
-- Caller-Risiko durch den REVOKE.

REVOKE ALL ON public.ai_evidence_retention_status FROM anon, authenticated;
GRANT SELECT ON public.ai_evidence_retention_status TO service_role;

-- ============================================================
-- 5) Trigger-Funktion search_path pinnen
-- ============================================================
-- tenant_cost_ledger_block_settled_mutation feuert als Trigger-Owner
-- (Schema-Owner), nicht via EXECUTE-Grant. search_path-Hijacking ist
-- daher zwar weniger akut, der Advisor flaggt es aber konsequent.
-- Pinnen schliesst die Klasse pauschal.

ALTER FUNCTION public.tenant_cost_ledger_block_settled_mutation()
    SET search_path = public, pg_temp;

COMMIT;
