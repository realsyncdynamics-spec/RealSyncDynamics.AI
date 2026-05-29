-- Rollback fuer 20260620000005_advisor_cost_cap_hardening.sql
--
-- ZWECK: Nur fuer Notfall-Reversion (z.B. wenn die security_invoker-
-- Umstellung legitime Frontend-Reads bricht). Wiederholtes Anwenden
-- ist sicher.
--
-- WICHTIG: Das Rollback macht die Berechtigungen LIBERALER. Es sollte
-- nicht im Normalbetrieb laufen, sondern nur als Brueckenmassnahme,
-- wenn die Hardening-Migration Anwendungs-Regressionen verursacht.
--
-- NICHT in supabase/migrations/ deployen — diese Datei dient als
-- Referenz/CLI-Script fuer den manuellen Rollback-Fall.

BEGIN;

-- 1) Cost-Cap RPCs: anon/authenticated wieder erlauben
GRANT EXECUTE ON FUNCTION public.cost_check_and_reserve(uuid, text, numeric, numeric, jsonb)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cost_writer_settle(uuid, text, numeric, numeric)
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cost_sweep_expired_reservations()
    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.propagate_cost_attribution(uuid, uuid)
    TO anon;

-- 2) Wrapper-Views zurueck auf SECURITY DEFINER (PG-Default)
ALTER VIEW public.v_cost_per_tenant            SET (security_invoker = false);
ALTER VIEW public.v_cost_per_feature           SET (security_invoker = false);
ALTER VIEW public.v_cost_per_agent             SET (security_invoker = false);
ALTER VIEW public.v_tenant_risk_score          SET (security_invoker = false);
ALTER VIEW public.v_tenant_risk_cost_quadrant  SET (security_invoker = false);
ALTER VIEW public.v_compliance_signals_open    SET (security_invoker = false);
ALTER VIEW public.ai_evidence_retention_status SET (security_invoker = false);

-- 3) Materialized Views wieder fuer anon/authenticated oeffnen
GRANT SELECT ON public.mv_cost_per_tenant            TO anon, authenticated;
GRANT SELECT ON public.mv_cost_per_feature           TO anon, authenticated;
GRANT SELECT ON public.mv_cost_per_agent             TO anon, authenticated;
GRANT SELECT ON public.mv_tenant_risk_score          TO anon, authenticated;
GRANT SELECT ON public.mv_tenant_risk_cost_quadrant  TO anon, authenticated;
GRANT SELECT ON public.mv_compliance_signals_open    TO anon, authenticated;

-- 4) ai_evidence_retention_status: anon-Grant restaurieren
GRANT SELECT ON public.ai_evidence_retention_status TO anon, authenticated;

-- 5) Trigger search_path zuruecksetzen
ALTER FUNCTION public.tenant_cost_ledger_block_settled_mutation() RESET search_path;

COMMIT;
