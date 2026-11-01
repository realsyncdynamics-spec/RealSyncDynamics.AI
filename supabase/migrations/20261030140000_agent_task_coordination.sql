-- M6 Command Center: Aufgaben-Kanban und Agentenkoordination.
-- Additive Erweiterung von public.agent_tasks (statt neuer Tabelle), weil Scheduler,
-- Planning-Agent und Agent-OS-Admin bereits darauf schreiben/lesen. Bestehende Spalten,
-- CHECKs und Policies bleiben unverändert; alle neuen Spalten sind nullable bzw. mit Default.
--
-- Schutz:
--  * Korrelations-ID + partieller Unique-Index → dieselbe Nachricht erzeugt pro Agent nur
--    eine offene Aufgabe.
--  * claim_agent_task: atomarer Lease → keine Doppelbearbeitung.
--  * Trigger: zirkuläre Delegation (Agent taucht in der Elternkette erneut auf),
--    Eltern-/Abhängigkeitszyklen und überlange Ketten werden abgewiesen.
--  * ERLEDIGT erfordert mindestens einen Prüfnachweis.

ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS board_status     TEXT,
  ADD COLUMN IF NOT EXISTS project          TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id   UUID,
  ADD COLUMN IF NOT EXISTS depends_on       UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence         JSONB  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS claimed_by       TEXT,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_board_status_check CHECK (board_status IS NULL OR board_status IN
    ('backlog','planned','in_progress','awaiting_decision','blocked','in_review','done'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_evidence_array CHECK (jsonb_typeof(evidence) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.agent_tasks ADD CONSTRAINT agent_tasks_done_needs_evidence
    CHECK (board_status IS DISTINCT FROM 'done' OR jsonb_array_length(evidence) > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS agent_tasks_correlation_open_uniq
  ON public.agent_tasks(tenant_id, correlation_id, agent)
  WHERE correlation_id IS NOT NULL AND status IN ('open','in_progress','blocked');
CREATE INDEX IF NOT EXISTS agent_tasks_tenant_board ON public.agent_tasks(tenant_id, board_status);

-- Koordinationsprüfung (SECURITY DEFINER, damit die Kette unabhängig von RLS vollständig gelesen wird).
CREATE OR REPLACE FUNCTION public.agent_tasks_coordination_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_depth INT;
  v_dep  UUID;
BEGIN
  IF NEW.parent_task_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id) THEN
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'Delegationszyklus: Aufgabe kann nicht ihr eigener Elternteil sein' USING ERRCODE = '23514';
    END IF;
    WITH RECURSIVE ch(id, parent_task_id, d) AS (
      SELECT id, parent_task_id, 1 FROM public.agent_tasks WHERE id = NEW.parent_task_id
      UNION ALL SELECT p.id, p.parent_task_id, ch.d + 1 FROM public.agent_tasks p JOIN ch ON p.id = ch.parent_task_id
       WHERE ch.d < 50 AND p.id <> NEW.id)
    SELECT max(d) INTO v_depth FROM ch;
    IF EXISTS (WITH RECURSIVE ch(id, tenant_id, parent_task_id, d) AS (
                 SELECT id, tenant_id, parent_task_id, 1 FROM public.agent_tasks WHERE id = NEW.parent_task_id
                 UNION ALL SELECT p.id, p.tenant_id, p.parent_task_id, ch.d + 1 FROM public.agent_tasks p JOIN ch ON p.id = ch.parent_task_id WHERE ch.d < 50)
               SELECT 1 FROM ch WHERE tenant_id <> NEW.tenant_id) THEN
      RAISE EXCEPTION 'Delegation über Mandantengrenzen nicht erlaubt' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (WITH RECURSIVE ch(id, parent_task_id, d) AS (
                 SELECT id, parent_task_id, 1 FROM public.agent_tasks WHERE id = NEW.parent_task_id
                 UNION ALL SELECT p.id, p.parent_task_id, ch.d + 1 FROM public.agent_tasks p JOIN ch ON p.id = ch.parent_task_id WHERE ch.d < 50 AND p.id <> NEW.id)
               SELECT 1 FROM ch WHERE parent_task_id = NEW.id) THEN
      RAISE EXCEPTION 'Delegationszyklus: Elternkette führt zur Aufgabe zurück' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (WITH RECURSIVE ch(id, agent, parent_task_id, d) AS (
                 SELECT id, agent, parent_task_id, 1 FROM public.agent_tasks WHERE id = NEW.parent_task_id
                 UNION ALL SELECT p.id, p.agent, p.parent_task_id, ch.d + 1 FROM public.agent_tasks p JOIN ch ON p.id = ch.parent_task_id WHERE ch.d < 50)
               SELECT 1 FROM ch WHERE agent = NEW.agent AND d > 1) THEN
      RAISE EXCEPTION 'Zirkuläre Delegation: Agent % ist bereits in der Delegationskette', NEW.agent USING ERRCODE = '23514';
    END IF;
    IF v_depth >= 10 THEN
      RAISE EXCEPTION 'Delegationskette zu lang (max. 10 Ebenen)' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF cardinality(NEW.depends_on) > 0 AND (TG_OP = 'INSERT' OR NEW.depends_on IS DISTINCT FROM OLD.depends_on) THEN
    IF NEW.id = ANY (NEW.depends_on) THEN
      RAISE EXCEPTION 'Abhängigkeitszyklus: Aufgabe hängt von sich selbst ab' USING ERRCODE = '23514';
    END IF;
    FOREACH v_dep IN ARRAY NEW.depends_on LOOP
      IF NOT EXISTS (SELECT 1 FROM public.agent_tasks WHERE id = v_dep AND tenant_id = NEW.tenant_id) THEN
        RAISE EXCEPTION 'Abhängigkeit % nicht im selben Mandanten gefunden', v_dep USING ERRCODE = '23503';
      END IF;
    END LOOP;
    IF EXISTS (WITH RECURSIVE dep(id, d) AS (
                 SELECT unnest(NEW.depends_on), 1
                 UNION SELECT unnest(t.depends_on), dep.d + 1 FROM public.agent_tasks t JOIN dep ON t.id = dep.id WHERE dep.d < 50)
               SELECT 1 FROM dep WHERE id = NEW.id) THEN
      RAISE EXCEPTION 'Abhängigkeitszyklus erkannt' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agent_tasks_coordination_guard ON public.agent_tasks;
CREATE TRIGGER agent_tasks_coordination_guard BEFORE INSERT OR UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.agent_tasks_coordination_guard();

-- Atomare Übernahme (Lease). Gibt true zurück, wenn der Aufrufer die Aufgabe jetzt hält.
CREATE OR REPLACE FUNCTION public.claim_agent_task(p_task_id uuid, p_agent text, p_lease_seconds int DEFAULT 900)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant UUID; v_n INT;
BEGIN
  IF p_agent IS NULL OR length(p_agent) = 0 THEN RAISE EXCEPTION 'Agent fehlt' USING ERRCODE = '22023'; END IF;
  IF p_lease_seconds NOT BETWEEN 30 AND 86400 THEN RAISE EXCEPTION 'Lease 30–86400 s' USING ERRCODE = '22023'; END IF;
  SELECT tenant_id INTO v_tenant FROM public.agent_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS (
       SELECT 1 FROM public.memberships m WHERE m.tenant_id = v_tenant AND m.user_id = auth.uid() AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'nur Owner/Admin oder Agentendienst' USING ERRCODE = '42501';
  END IF;

  UPDATE public.agent_tasks
     SET claimed_by = p_agent, claim_expires_at = now() + make_interval(secs => p_lease_seconds),
         status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
         board_status = CASE WHEN board_status IS NULL OR board_status IN ('backlog','planned') THEN 'in_progress' ELSE board_status END,
         started_at = COALESCE(started_at, now())
   WHERE id = p_task_id
     AND status IN ('open','in_progress')
     AND (claimed_by IS NULL OR claimed_by = p_agent OR claim_expires_at < now());
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent, payload)
  VALUES (v_tenant, CASE WHEN v_n = 1 THEN 'task.claimed' ELSE 'task.claim_rejected' END, 'task', p_task_id::text, p_agent,
          jsonb_build_object('lease_seconds', p_lease_seconds));
  RETURN v_n = 1;
END $$;

CREATE OR REPLACE FUNCTION public.release_agent_task(p_task_id uuid, p_agent text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant UUID; v_n INT;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.agent_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS (
       SELECT 1 FROM public.memberships m WHERE m.tenant_id = v_tenant AND m.user_id = auth.uid() AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'nur Owner/Admin oder Agentendienst' USING ERRCODE = '42501';
  END IF;
  UPDATE public.agent_tasks SET claimed_by = NULL, claim_expires_at = NULL WHERE id = p_task_id AND claimed_by = p_agent;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END $$;

-- Kanban-Verschiebung durch Menschen (Owner/Admin) mit Ereignis; ERLEDIGT braucht Nachweis.
CREATE OR REPLACE FUNCTION public.move_agent_task(p_task_id uuid, p_board_status text, p_evidence jsonb DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.agent_tasks%ROWTYPE; v_status TEXT; v_ev JSONB;
BEGIN
  SELECT * INTO r FROM public.agent_tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aufgabe nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id = r.tenant_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'nur Owner/Admin des Mandanten' USING ERRCODE = '42501';
  END IF;
  IF p_board_status NOT IN ('backlog','planned','in_progress','awaiting_decision','blocked','in_review','done') THEN
    RAISE EXCEPTION 'unbekannte Spalte %', p_board_status USING ERRCODE = '22023';
  END IF;
  IF p_evidence IS NOT NULL AND jsonb_typeof(p_evidence) <> 'array' THEN
    RAISE EXCEPTION 'Nachweise müssen eine Liste sein' USING ERRCODE = '22023';
  END IF;
  v_ev := r.evidence || COALESCE(p_evidence, '[]'::jsonb);
  IF p_board_status = 'done' AND jsonb_array_length(v_ev) = 0 THEN
    RAISE EXCEPTION 'ERLEDIGT erfordert mindestens einen Prüfnachweis' USING ERRCODE = '22023';
  END IF;
  v_status := CASE p_board_status
    WHEN 'done' THEN 'done' WHEN 'blocked' THEN 'blocked'
    WHEN 'in_progress' THEN 'in_progress' WHEN 'in_review' THEN 'in_progress' WHEN 'awaiting_decision' THEN 'blocked'
    ELSE 'open' END;
  UPDATE public.agent_tasks
     SET board_status = p_board_status, status = v_status, evidence = v_ev,
         blocker_reason = CASE WHEN v_status = 'blocked' THEN COALESCE(p_note, blocker_reason) ELSE blocker_reason END,
         completed_at = CASE WHEN v_status = 'done' THEN now() ELSE completed_at END
   WHERE id = p_task_id;
  INSERT INTO public.agent_events(tenant_id, event_type, subject_type, subject_id, agent, payload)
  VALUES (r.tenant_id, 'task.moved', 'task', p_task_id::text, NULL,
          jsonb_build_object('from', COALESCE(r.board_status, r.status), 'to', p_board_status, 'actor', auth.uid(), 'note', p_note));
  RETURN jsonb_build_object('id', p_task_id, 'board_status', p_board_status, 'status', v_status);
END $$;

REVOKE ALL ON FUNCTION public.claim_agent_task(uuid, text, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_agent_task(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.move_agent_task(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_agent_task(uuid, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_agent_task(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_agent_task(uuid, text, jsonb, text) TO authenticated;
