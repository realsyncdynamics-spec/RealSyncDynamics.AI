-- Security: verbleibende function_search_path_mutable (Advisor WARN x14).
-- Trigger-Funktionen und Utility-RPCs benoetigen nur public + pg_temp.
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md. Idempotent.
--
-- [hotfix] Mehrere Funktionen (z.B. health_ping, legal_set_updated_at, scan_runs_set_updated_at)
-- werden erst in spaeter datumgestempelten Migrationen erstellt. ALTER FUNCTION wird daher
-- konditionell ausgefuehrt — kein Fehler wenn die Funktion noch nicht existiert.

DO $$
DECLARE
  fn text;
  fn_names text[] := ARRAY[
    'agent_os_set_updated_at',
    'decision_agent_set_updated_at',
    'findings_set_updated_at',
    'health_ping',
    'legal_set_updated_at',
    'llm_quota_for_anon',
    'monitoring_agent_set_updated_at',
    'output_agent_set_updated_at',
    'planning_agent_set_updated_at',
    'remediation_plans_set_updated_at',
    'scan_runs_set_updated_at',
    'tenant_activation_set_updated_at',
    'tenant_cost_ledger_block_settled_mutation'
  ];
BEGIN
  FOREACH fn IN ARRAY fn_names LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = fn
        AND pronamespace = 'public'::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER FUNCTION public.%I SET search_path = public, pg_temp', fn
      );
    END IF;
  END LOOP;
END $$;

-- runtime_events_canonical_bytes hat eine komplexe Signatur — separat behandeln:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'runtime_events_canonical_bytes'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.runtime_events_canonical_bytes(
      p_id uuid, p_tenant_id uuid, p_global_seq bigint, p_tenant_seq bigint,
      p_spec_version text, p_ts timestamp with time zone, p_type text,
      p_severity text, p_source text, p_review_status text, p_subject_ref text,
      p_payload jsonb, p_evidence_refs jsonb, p_trace_id uuid,
      p_correlation_id uuid, p_causation_id uuid, p_prev_hash bytea
    ) SET search_path = public, pg_temp;
  END IF;
END $$;
