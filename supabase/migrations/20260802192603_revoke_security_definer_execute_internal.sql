-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260802192603.
--
-- Diese Migration wurde am 2026-08-02 um 19:26:03 UTC direkt auf Prod
-- angewendet, ohne ins Repo committet zu werden. Der reparierte Drift-Guard
-- (22534458) hat sie ~22 Minuten spaeter im CI gemeldet — der erste Fall, in
-- dem der Guard frischen Drift gefangen hat statt ihn stillschweigend gruen zu
-- melden.

-- Härtung: EXECUTE-Entzug für interne SECURITY-DEFINER-Funktionen.
-- Advisor-Lints 0028/0029. Nur die 8 unzweifelhaft internen (5 Trigger +
-- 3 private _internal-Helper). Funktional folgenlos (Trigger sind per SQL nicht
-- direkt aufrufbar; _internal laufen nur über ihre SECURITY-DEFINER-Wrapper als Owner).

-- Tier 1: Trigger-Funktionen
REVOKE EXECUTE ON FUNCTION public.on_event_recompute_subject_risk()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.runtime_events_alloc_seq_and_chain() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.runtime_events_block_mutation()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tenant_activation_capture_scan()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_snapshot_governance_versioned()   FROM PUBLIC, anon, authenticated;

-- Tier 2: Private _internal-Helper
REVOKE EXECUTE ON FUNCTION public._compute_subject_risk_score_internal(uuid, text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._compute_tenant_quadrant_internal(uuid, timestamp with time zone)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._compute_tenant_risk_score_internal(uuid, timestamp with time zone)        FROM PUBLIC, anon, authenticated;
