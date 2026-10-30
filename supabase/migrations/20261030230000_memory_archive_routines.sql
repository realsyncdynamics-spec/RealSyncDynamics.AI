-- M7 Command Center: Zweites Gedächtnis, Entscheidungsarchiv, Routinen-Nachweis.
-- Additiv. Abgrenzung (keine Doppelstrukturen):
--  * Entscheidungsarchiv = bestehende agent_decisions + agent_decision_approvals + agent_questions
--    (nur View/Suche, keine Kopie).
--  * Zweites Gedächtnis (mandantenbezogen) = bestehendes public.agent_memory.
--  * integration_memory bleibt Plattform-/Connector-Gedächtnis (nur service_role), wird hier
--    bewusst NICHT für Mandanten geöffnet oder gespiegelt.
--  * Routinen: neue Registry agent_routines + append-only agent_routine_runs; bestehende
--    scan_schedules werden lesend in die Statusansicht eingebunden.
-- Frühere Entscheidungen sind Präzedenz (nur Hinweis), niemals Freigabe: resolve_agent_decision (M4)
-- verlangt weiterhin je Entscheidung eine eigene Bestätigung.
-- Härtung: cron_execution_logs war per Policy USING(true) + Grants für anon/authenticated
-- les- und schreibbar; Zugriff wird auf service_role beschränkt (alle Schreiber sind Edge Functions
-- mit Service-Role).

-- 1) Entscheidungsarchiv (security_invoker → RLS der Basistabellen gilt)
CREATE OR REPLACE VIEW public.agent_decision_archive_v WITH (security_invoker = true) AS
SELECT
  d.id                 AS decision_id,
  d.tenant_id,
  d.decision_title,
  d.problem,
  d.recommendation,
  d.reason,
  d.risk_level,
  d.status,
  d.proposed_by,
  d.created_at,
  d.approved_at,
  q.id                 AS question_id,
  q.question,
  q.agent_ref,
  q.project,
  q.resolution_note,
  a.action             AS last_action,
  a.chosen_label       AS last_chosen_label,
  a.approval_level     AS last_approval_level,
  a.created_at         AS last_action_at
FROM public.agent_decisions d
LEFT JOIN LATERAL (SELECT * FROM public.agent_questions q WHERE q.decision_id = d.id ORDER BY q.created_at LIMIT 1) q ON true
LEFT JOIN LATERAL (SELECT * FROM public.agent_decision_approvals a WHERE a.decision_id = d.id ORDER BY a.created_at DESC LIMIT 1) a ON true;

GRANT SELECT ON public.agent_decision_archive_v TO authenticated;
REVOKE ALL ON public.agent_decision_archive_v FROM anon;

-- 2) Wissenssuche (SECURITY INVOKER → nur, was der Aufrufer per RLS sehen darf)
-- Wortbasiert: p_match_any=false → alle Wörter (≥ 3 Zeichen) müssen vorkommen; true → mindestens eines
-- (für Präzedenzfälle aus der Inbox).
CREATE OR REPLACE FUNCTION public.knowledge_text_match(p_text text, p_words text[], p_any boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN cardinality(p_words) = 0 THEN false
              WHEN p_any THEN EXISTS (SELECT 1 FROM unnest(p_words) w WHERE p_text ILIKE '%' || w || '%')
              ELSE NOT EXISTS (SELECT 1 FROM unnest(p_words) w WHERE p_text NOT ILIKE '%' || w || '%') END;
$$;

DROP FUNCTION IF EXISTS public.search_agent_knowledge(text, text[], int);
CREATE OR REPLACE FUNCTION public.search_agent_knowledge(p_query text, p_kinds text[] DEFAULT NULL, p_limit int DEFAULT 20, p_match_any boolean DEFAULT false)
RETURNS TABLE (kind text, id uuid, title text, snippet text, status text, agent text, created_at timestamptz, decision_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (
    SELECT ARRAY(SELECT DISTINCT replace(replace(w, '%', ''), '_', '') FROM regexp_split_to_table(lower(COALESCE(p_query, '')), '[^[:alnum:]äöüß]+') w
                  WHERE length(w) >= 3 LIMIT 12) AS words,
           LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100) AS lim)
  SELECT * FROM (
    SELECT 'decision'::text, v.decision_id, COALESCE(v.decision_title, v.question, v.recommendation),
           left(concat_ws(' · ', v.recommendation, v.reason, v.resolution_note), 400),
           v.status, COALESCE(v.agent_ref, v.proposed_by), v.created_at, v.decision_id
      FROM public.agent_decision_archive_v v, q
     WHERE (p_kinds IS NULL OR 'decision' = ANY (p_kinds))
       AND public.knowledge_text_match(concat_ws(' ', v.decision_title, v.problem, v.recommendation, v.reason, v.question, v.resolution_note), q.words, p_match_any)
    UNION ALL
    SELECT 'question', aq.id, aq.question, left(concat_ws(' · ', aq.context, aq.resolution_note), 400),
           aq.status, aq.agent_ref, aq.created_at, aq.decision_id
      FROM public.agent_questions aq, q
     WHERE (p_kinds IS NULL OR 'question' = ANY (p_kinds)) AND aq.decision_id IS NULL
       AND public.knowledge_text_match(concat_ws(' ', aq.question, aq.context, aq.resolution_note), q.words, p_match_any)
    UNION ALL
    SELECT 'memory', m.id, m.topic, left(m.content, 400), m.status, COALESCE(m.source_agent, m.source), m.created_at, NULL::uuid
      FROM public.agent_memory m, q
     WHERE (p_kinds IS NULL OR 'memory' = ANY (p_kinds)) AND m.status = 'active'
       AND public.knowledge_text_match(concat_ws(' ', m.topic, m.content, array_to_string(m.tags, ' '), m.decided_action), q.words, p_match_any)
  ) r(kind, id, title, snippet, status, agent, created_at, decision_id)
  ORDER BY created_at DESC
  LIMIT (SELECT lim FROM q);
$$;
REVOKE ALL ON FUNCTION public.search_agent_knowledge(text, text[], int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_agent_knowledge(text, text[], int, boolean) TO authenticated, service_role;

-- 3) Routinen
CREATE TABLE IF NOT EXISTS public.agent_routines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  routine_key   TEXT NOT NULL CHECK (routine_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
  label         TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  description   TEXT,
  agent_ref     TEXT,
  schedule      TEXT,              -- frei (z. B. cron-Ausdruck); Ausführung erfolgt durch bestehende Scheduler
  expected_interval_minutes INT CHECK (expected_interval_minutes IS NULL OR expected_interval_minutes BETWEEN 1 AND 525600),
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID DEFAULT auth.uid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, routine_key)
);

CREATE TABLE IF NOT EXISTS public.agent_routine_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  routine_id    UUID NOT NULL REFERENCES public.agent_routines(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL CHECK (status IN ('success','failure','skipped')),
  summary       TEXT CHECK (summary IS NULL OR length(summary) <= 2000),
  evidence      JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  error_message TEXT CHECK (error_message IS NULL OR length(error_message) <= 2000),
  correlation_id UUID,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE INDEX IF NOT EXISTS agent_routine_runs_routine_recent ON public.agent_routine_runs(routine_id, started_at DESC);

ALTER TABLE public.agent_routines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_routine_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_routines_member_read ON public.agent_routines;
CREATE POLICY agent_routines_member_read ON public.agent_routines
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS agent_routines_admin_write ON public.agent_routines;
CREATE POLICY agent_routines_admin_write ON public.agent_routines
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = agent_routines.tenant_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));
DROP POLICY IF EXISTS agent_routines_admin_update ON public.agent_routines;
CREATE POLICY agent_routines_admin_update ON public.agent_routines
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = agent_routines.tenant_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = agent_routines.tenant_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));

DROP POLICY IF EXISTS agent_routine_runs_member_read ON public.agent_routine_runs;
CREATE POLICY agent_routine_runs_member_read ON public.agent_routine_runs
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
-- Keine Client-Schreibrechte auf Läufe: Nachweise schreibt nur der Scheduler (service_role) via record_routine_run.

REVOKE ALL ON public.agent_routines, public.agent_routine_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_routines TO authenticated;
GRANT SELECT ON public.agent_routine_runs TO authenticated;

-- Läufe unveränderlich
CREATE OR REPLACE FUNCTION public.agent_routine_runs_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'agent_routine_runs ist append-only' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS agent_routine_runs_append_only ON public.agent_routine_runs;
CREATE TRIGGER agent_routine_runs_append_only BEFORE UPDATE OR DELETE ON public.agent_routine_runs
  FOR EACH ROW EXECUTE FUNCTION public.agent_routine_runs_append_only();

CREATE OR REPLACE FUNCTION public.record_routine_run(
  p_tenant_id uuid, p_routine_key text, p_status text, p_started_at timestamptz DEFAULT now(),
  p_finished_at timestamptz DEFAULT now(), p_summary text DEFAULT NULL, p_evidence jsonb DEFAULT '[]'::jsonb,
  p_error text DEFAULT NULL, p_correlation_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_routine UUID; v_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'nur Scheduler/Agentendienst (service_role)' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_routine FROM public.agent_routines WHERE tenant_id = p_tenant_id AND routine_key = p_routine_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Routine % nicht registriert', p_routine_key USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.agent_routine_runs(tenant_id, routine_id, started_at, finished_at, status, summary, evidence, error_message, correlation_id)
  VALUES (p_tenant_id, v_routine, p_started_at, p_finished_at, p_status, p_summary, COALESCE(p_evidence, '[]'::jsonb), p_error, p_correlation_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.record_routine_run(uuid, text, text, timestamptz, timestamptz, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_routine_run(uuid, text, text, timestamptz, timestamptz, text, jsonb, text, uuid) TO service_role;

-- Statusansicht: registrierte Routinen + bestehende Scan-Zeitpläne (lesend)
CREATE OR REPLACE VIEW public.agent_routine_status_v WITH (security_invoker = true) AS
SELECT
  'routine'::text AS source, r.id, r.tenant_id, r.routine_key AS key, r.label, r.agent_ref, r.schedule, r.enabled,
  r.expected_interval_minutes,
  lr.started_at AS last_run_at, lr.status AS last_status, lr.error_message AS last_error, lr.summary AS last_summary,
  (SELECT count(*) FROM public.agent_routine_runs x WHERE x.routine_id = r.id AND x.status = 'failure'
     AND x.started_at > now() - interval '7 days') AS failures_7d,
  NULL::timestamptz AS next_run_at
FROM public.agent_routines r
LEFT JOIN LATERAL (SELECT * FROM public.agent_routine_runs x WHERE x.routine_id = r.id ORDER BY x.started_at DESC LIMIT 1) lr ON true
UNION ALL
SELECT
  'scan_schedule', s.id, s.tenant_id, 'scan:' || s.id::text, COALESCE(s.label, 'Scan-Zeitplan'), NULL, s.frequency,
  (s.enabled AND NOT s.paused), NULL,
  s.last_run_at, NULL, NULL, NULL, NULL, s.next_run_at
FROM public.scan_schedules s;

GRANT SELECT ON public.agent_routine_status_v TO authenticated;
REVOKE ALL ON public.agent_routine_status_v FROM anon;

-- 4) Härtung cron_execution_logs (nur service_role)
DROP POLICY IF EXISTS "cron_logs_admin_only" ON public.cron_execution_logs;
REVOKE ALL ON public.cron_execution_logs FROM anon, authenticated;
GRANT SELECT, INSERT ON public.cron_execution_logs TO service_role;
