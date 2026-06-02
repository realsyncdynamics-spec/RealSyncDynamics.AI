-- Security: verbleibende function_search_path_mutable (Advisor WARN x14).
-- Trigger-Funktionen und Utility-RPCs benoetigen nur public + pg_temp.
-- Kontext: docs/runtime/SYSTEMCHECK-2026-05-28.md. Idempotent.

alter function public.agent_os_set_updated_at()                    set search_path = public, pg_temp;
alter function public.decision_agent_set_updated_at()              set search_path = public, pg_temp;
alter function public.findings_set_updated_at()                    set search_path = public, pg_temp;
alter function public.health_ping()                                set search_path = public, pg_temp;
alter function public.legal_set_updated_at()                       set search_path = public, pg_temp;
alter function public.llm_quota_for_anon()                         set search_path = public, pg_temp;
alter function public.monitoring_agent_set_updated_at()            set search_path = public, pg_temp;
alter function public.output_agent_set_updated_at()                set search_path = public, pg_temp;
alter function public.planning_agent_set_updated_at()              set search_path = public, pg_temp;
alter function public.remediation_plans_set_updated_at()           set search_path = public, pg_temp;
alter function public.scan_runs_set_updated_at()                   set search_path = public, pg_temp;
alter function public.tenant_activation_set_updated_at()           set search_path = public, pg_temp;
alter function public.tenant_cost_ledger_block_settled_mutation()  set search_path = public, pg_temp;
alter function public.runtime_events_canonical_bytes(
  p_id uuid, p_tenant_id uuid, p_global_seq bigint, p_tenant_seq bigint,
  p_spec_version text, p_ts timestamp with time zone, p_type text,
  p_severity text, p_source text, p_review_status text, p_subject_ref text,
  p_payload jsonb, p_evidence_refs jsonb, p_trace_id uuid,
  p_correlation_id uuid, p_causation_id uuid, p_prev_hash bytea
)                                                                  set search_path = public, pg_temp;
