-- M2 Command Center: Decision Inbox — agent_questions + append-only Historie.
-- Additiv. Muster aus agent_decisions (tenant_id, RLS, nie Auto-Freigabe)
-- und governance_approvals (Status-Lebenszyklus, resolved_by/at).
--
-- Grundsätze:
--   * Eine Frage ist KEINE Freigabe. Antworten/Freigaben (L3/L4) folgen in M3/M4.
--   * dedupe_key fasst gleiche Fragen zusammen (Default: normalisierte Frage).
--   * Jede Statusänderung landet per Trigger in agent_question_events (append-only).
--   * is_demo kennzeichnet Demo-Daten ausdrücklich.

CREATE TABLE IF NOT EXISTS public.agent_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_ref     TEXT NOT NULL CHECK (length(agent_ref) BETWEEN 1 AND 200),  -- registry_id aus agent_registry_v
  task_ref      TEXT,
  milestone     TEXT CHECK (milestone IS NULL OR milestone ~ '^M[0-9]+[a-z]?(-[a-z])?$'),
  project       TEXT,
  question      TEXT NOT NULL CHECK (length(question) BETWEEN 3 AND 2000),
  context       TEXT,
  priority      TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3')),
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','answered','deferred','withdrawn')),
  dedupe_key    TEXT NOT NULL,
  decision_id   UUID REFERENCES public.agent_decisions(id) ON DELETE SET NULL,
  is_demo       BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID DEFAULT auth.uid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by   UUID,
  resolved_at   TIMESTAMPTZ,
  resolution_note TEXT
);

CREATE INDEX IF NOT EXISTS agent_questions_open_idx
  ON public.agent_questions (tenant_id, priority, created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS agent_questions_dedupe_idx
  ON public.agent_questions (tenant_id, dedupe_key);

CREATE TABLE IF NOT EXISTS public.agent_question_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES public.agent_questions(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('created','status_changed','priority_changed')),
  from_value    TEXT,
  to_value      TEXT,
  actor         UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_question_events_q_idx
  ON public.agent_question_events (question_id, created_at);

-- dedupe_key-Default, updated_at, resolved_* und unveränderliche Felder
CREATE OR REPLACE FUNCTION public.agent_questions_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.dedupe_key IS NULL OR length(trim(NEW.dedupe_key)) = 0 THEN
      NEW.dedupe_key := md5(lower(regexp_replace(trim(NEW.question), '\s+', ' ', 'g')));
    END IF;
    NEW.status := 'open';
    NEW.resolved_by := NULL; NEW.resolved_at := NULL;
  ELSE
    -- Mandant, Herkunft und Inhalt sind nach Anlage unveränderlich.
    NEW.id := OLD.id; NEW.tenant_id := OLD.tenant_id; NEW.agent_ref := OLD.agent_ref;
    NEW.question := OLD.question; NEW.dedupe_key := OLD.dedupe_key;
    NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; NEW.is_demo := OLD.is_demo;
    NEW.updated_at := now();
    IF NEW.status <> OLD.status AND NEW.status <> 'open' THEN
      NEW.resolved_by := auth.uid(); NEW.resolved_at := now();
    ELSIF NEW.status = 'open' THEN
      NEW.resolved_by := NULL; NEW.resolved_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- SECURITY DEFINER: liest auth.uid() unabhängig von Schema-Rechten des Aufrufers; ändert nur NEW.
REVOKE ALL ON FUNCTION public.agent_questions_before_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS agent_questions_before_write ON public.agent_questions;
CREATE TRIGGER agent_questions_before_write
  BEFORE INSERT OR UPDATE ON public.agent_questions
  FOR EACH ROW EXECUTE FUNCTION public.agent_questions_before_write();

-- Historie: SECURITY DEFINER, damit Clients die Events-Tabelle nicht direkt beschreiben müssen.
CREATE OR REPLACE FUNCTION public.agent_questions_after_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.agent_question_events(question_id, tenant_id, event_type, to_value, actor)
    VALUES (NEW.id, NEW.tenant_id, 'created', NEW.status, auth.uid());
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.agent_question_events(question_id, tenant_id, event_type, from_value, to_value, actor)
      VALUES (NEW.id, NEW.tenant_id, 'status_changed', OLD.status, NEW.status, auth.uid());
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.agent_question_events(question_id, tenant_id, event_type, from_value, to_value, actor)
      VALUES (NEW.id, NEW.tenant_id, 'priority_changed', OLD.priority, NEW.priority, auth.uid());
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.agent_questions_after_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS agent_questions_after_write ON public.agent_questions;
CREATE TRIGGER agent_questions_after_write
  AFTER INSERT OR UPDATE ON public.agent_questions
  FOR EACH ROW EXECUTE FUNCTION public.agent_questions_after_write();

-- RLS
ALTER TABLE public.agent_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_question_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_questions tenant_read" ON public.agent_questions;
CREATE POLICY "agent_questions tenant_read" ON public.agent_questions
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "agent_questions tenant_insert" ON public.agent_questions;
CREATE POLICY "agent_questions tenant_insert" ON public.agent_questions
  FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS "agent_questions tenant_update" ON public.agent_questions;
CREATE POLICY "agent_questions tenant_update" ON public.agent_questions
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));
-- Kein DELETE für Clients (Historie bleibt nachvollziehbar); service_role umgeht RLS.

DROP POLICY IF EXISTS "agent_question_events tenant_read" ON public.agent_question_events;
CREATE POLICY "agent_question_events tenant_read" ON public.agent_question_events
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

REVOKE ALL ON public.agent_questions FROM anon;
REVOKE ALL ON public.agent_question_events FROM anon;
REVOKE DELETE, TRUNCATE ON public.agent_questions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.agent_question_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.agent_questions TO authenticated;
GRANT SELECT ON public.agent_question_events TO authenticated;
GRANT ALL ON public.agent_questions, public.agent_question_events TO service_role;

COMMENT ON TABLE public.agent_questions IS
  'M2 Decision Inbox: offene Agentenfragen je Mandant. Eine Frage/Empfehlung ist nie eine Freigabe.';
COMMENT ON TABLE public.agent_question_events IS
  'M2 Decision Inbox: append-only Historie (per Trigger).';
