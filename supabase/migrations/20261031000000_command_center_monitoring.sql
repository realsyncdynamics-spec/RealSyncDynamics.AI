-- M8 Command Center: Monitoring, Sicherheit, Kosten — rein lesend, additiv.
-- Nur Views (security_invoker → RLS der Basistabellen) und eine Plattform-Health-Funktion.
-- Keine neuen Datensätze, keine Kostenbuchungen. Quellen:
--  * Kosten: tenant_cost_ledger (kanonisch; is_simulated=false, ohne Reservierungen),
--            agent_runs (Tokens/cost_usd), token_usage (Tokens/cost_usd), tenant_cost_caps.
--    Bewertungsbasis (gemessen/geschaetzt/korrigiert/unbekannt) wird je Zeile ausgewiesen.
--    Quellen werden NICHT addiert (mögliche Überschneidung) und getrennt ausgewiesen.
--  * Audit: agent_decision_approvals, agent_actions_log, agent_events, agent_routine_runs.
--    audit_logs hat kein tenant_id (nur eigener Akteur) → bewusst nicht eingebunden.
--  * Kritische Ereignisse: abgeleitet aus belegten Zeilen (keine Heuristik-Zahlen).
--  * Plattform-Health: cron_execution_logs bleibt service_role-only; aggregierter Status
--    nur für aktive Plattform-Operatoren über cc_platform_health().

-- 1) Kosten je Quelle und Monat
CREATE OR REPLACE VIEW public.cc_cost_by_source_v WITH (security_invoker = true) AS
SELECT tenant_id, date_trunc('month', occurred_at) AS month, 'tenant_cost_ledger'::text AS source,
       cost_kind AS metric,
       CASE WHEN cost_kind = 'llm_estimate' THEN 'geschaetzt' ELSE COALESCE(value_basis, 'unbekannt') END AS basis,
       sum(amount_usd) AS cost_usd,
       sum(units) FILTER (WHERE cost_kind IN ('llm_input','llm_output')) AS tokens,
       count(*) AS entries, max(occurred_at) AS last_at
  FROM public.tenant_cost_ledger
 WHERE is_simulated IS NOT TRUE AND cost_kind <> 'reservation'
 GROUP BY 1, 2, 4, 5
UNION ALL
SELECT tenant_id, date_trunc('month', created_at), 'agent_runs', COALESCE(llm_provider, 'unbekannt'), 'unbekannt',
       sum(cost_usd), sum(input_tokens + output_tokens)::numeric, count(*), max(created_at)
  FROM public.agent_runs GROUP BY 1, 2, 4
UNION ALL
SELECT tenant_id, date_trunc('month', recorded_at), 'token_usage', COALESCE(vendor, 'unbekannt'), 'unbekannt',
       sum(cost_usd), sum(total_tokens)::numeric, count(*), max(recorded_at)
  FROM public.token_usage GROUP BY 1, 2, 4;

GRANT SELECT ON public.cc_cost_by_source_v TO authenticated;
REVOKE ALL ON public.cc_cost_by_source_v FROM anon;

-- 2) Zentraler Audit-Feed
CREATE OR REPLACE VIEW public.cc_audit_feed_v WITH (security_invoker = true) AS
SELECT a.tenant_id, a.created_at AS at, 'approval'::text AS source, a.action AS event,
       'decision'::text AS subject_type, a.decision_id::text AS subject_id, a.actor::text AS actor,
       jsonb_build_object('level', a.approval_level, 'chosen', a.chosen_label, 'note', a.note) AS details
  FROM public.agent_decision_approvals a
UNION ALL
SELECT l.tenant_id, l.created_at, 'action_log', l.action_type, 'action', l.id::text,
       COALESCE(l.input->>'actor', l.agent_id::text), jsonb_build_object('status', l.status, 'input', l.input)
  FROM public.agent_actions_log l
UNION ALL
SELECT e.tenant_id, e.created_at, 'agent_event', e.event_type, e.subject_type, e.subject_id, e.agent, e.payload
  FROM public.agent_events e
UNION ALL
SELECT r.tenant_id, r.started_at, 'routine_run', r.status, 'routine', r.routine_id::text, NULL,
       jsonb_build_object('summary', r.summary, 'error', r.error_message)
  FROM public.agent_routine_runs r;

GRANT SELECT ON public.cc_audit_feed_v TO authenticated;
REVOKE ALL ON public.cc_audit_feed_v FROM anon;

-- 3) Kritische Ereignisse (letzte 7 Tage bzw. offene Zustände)
CREATE OR REPLACE VIEW public.cc_critical_events_v WITH (security_invoker = true) AS
SELECT tenant_id, started_at AS at, 'routine_failure'::text AS kind, 'high'::text AS severity, 'health'::text AS category,
       routine_id::text AS subject_id, COALESCE(error_message, 'Routine fehlgeschlagen') AS message
  FROM public.agent_routine_runs WHERE status = 'failure' AND started_at > now() - interval '7 days'
UNION ALL
SELECT tenant_id, created_at, 'agent_run_error', CASE WHEN outcome = 'budget_exceeded' THEN 'high' ELSE 'medium' END, 'health',
       id::text, outcome || COALESCE(': ' || left(error_message, 200), '')
  FROM public.agent_runs WHERE outcome <> 'success' AND created_at > now() - interval '7 days'
UNION ALL
SELECT tenant_id, created_at, 'critical_approval', 'high', 'security', decision_id::text,
       'Freigabe ' || approval_level || ' (' || action || ')'
  FROM public.agent_decision_approvals WHERE approval_level IN ('L3','L4') AND created_at > now() - interval '7 days'
UNION ALL
SELECT tenant_id, created_at, 'config_activated', 'medium', 'security', COALESCE(input->>'config_version_id', id::text),
       'Soll-Konfiguration aktiviert: ' || COALESCE(input->>'agent_ref', '?') || ' / ' || COALESCE(input->>'section', '?')
  FROM public.agent_actions_log WHERE action_type = 'config_activate' AND created_at > now() - interval '7 days'
UNION ALL
SELECT tenant_id, created_at, 'claim_conflict', 'low', 'coordination', subject_id,
       'Doppelbearbeitung abgewiesen (' || COALESCE(agent, '?') || ')'
  FROM public.agent_events WHERE event_type = 'task.claim_rejected' AND created_at > now() - interval '7 days'
UNION ALL
SELECT tenant_id, created_at, 'decision_pending_high_risk', 'medium', 'security', id::text,
       'Offene Entscheidung mit Risiko ' || risk_level || ': ' || COALESCE(decision_title, recommendation)
  FROM public.agent_decisions WHERE status = 'proposed' AND risk_level IN ('high','critical');

GRANT SELECT ON public.cc_critical_events_v TO authenticated;
REVOKE ALL ON public.cc_critical_events_v FROM anon;

-- 4) Plattform-Health (aggregiert) — nur aktive Plattform-Operatoren
CREATE OR REPLACE FUNCTION public.cc_platform_health()
RETURNS TABLE (function_name text, last_status text, last_executed_at timestamptz, failures_24h bigint, runs_24h bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'nur Plattform-Operatoren' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.function_name,
           (SELECT x.status FROM public.cron_execution_logs x WHERE x.function_name = c.function_name ORDER BY x.executed_at DESC LIMIT 1),
           max(c.executed_at),
           count(*) FILTER (WHERE c.status = 'failure' AND c.executed_at > now() - interval '24 hours'),
           count(*) FILTER (WHERE c.executed_at > now() - interval '24 hours')
      FROM public.cron_execution_logs c GROUP BY c.function_name;
END $$;
REVOKE ALL ON FUNCTION public.cc_platform_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cc_platform_health() TO authenticated;
