-- M4 Command Center: Freigabe-Gate + Audit für agent_decisions.
-- Additiv bis auf das Ersetzen der Policy agent_decisions_admin_update.
--
-- Vorher: Owner/Admin konnten agent_decisions.status per direktem UPDATE auf
-- 'approved' setzen — ohne Audit, ohne bewusste Bestätigung.
-- Jetzt:
--   * Direkte Client-UPDATEs (authenticated/anon) dürfen status NICHT auf
--     approved/rejected setzen und approved_by/approved_at nicht ändern (Trigger).
--   * Freigaben laufen nur über public.resolve_agent_decision(...)
--     (SECURITY DEFINER): prüft Owner/Admin, verlangt explizite Bestätigung,
--     schreibt append-only agent_decision_approvals und meldet das Ergebnis an
--     die verknüpfte agent_questions-Zeile zurück (Historie per Trigger).
--   * Eine Empfehlung ist nie eine Freigabe; jede Freigabe ist ein eigener,
--     protokollierter Vorgang.

-- 1) Audit-Tabelle (append-only)
CREATE TABLE IF NOT EXISTS public.agent_decision_approvals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  decision_id    UUID NOT NULL REFERENCES public.agent_decisions(id) ON DELETE CASCADE,
  question_id    UUID REFERENCES public.agent_questions(id) ON DELETE SET NULL,
  action         TEXT NOT NULL CHECK (action IN ('approve','reject','defer')),
  chosen_option  INT CHECK (chosen_option IS NULL OR chosen_option BETWEEN 0 AND 2),
  chosen_label   TEXT,
  approval_level TEXT NOT NULL CHECK (approval_level IN ('L0','L1','L2','L3','L4')),
  note           TEXT,
  actor          UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_decision_approvals_decision_idx
  ON public.agent_decision_approvals (decision_id, created_at);

ALTER TABLE public.agent_decision_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_decision_approvals tenant_read" ON public.agent_decision_approvals;
CREATE POLICY "agent_decision_approvals tenant_read" ON public.agent_decision_approvals
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
REVOKE ALL ON public.agent_decision_approvals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.agent_decision_approvals FROM authenticated;
GRANT SELECT ON public.agent_decision_approvals TO authenticated;
GRANT ALL ON public.agent_decision_approvals TO service_role;

-- 2) Gate-Trigger: Clients können nicht direkt freigeben/ablehnen
CREATE OR REPLACE FUNCTION public.agent_decisions_gate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'agent_decisions: Freigabe/Ablehnung nur über resolve_agent_decision()'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'agent_decisions: approved_by/approved_at sind nicht direkt änderbar'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agent_decisions_gate ON public.agent_decisions;
CREATE TRIGGER agent_decisions_gate
  BEFORE UPDATE ON public.agent_decisions
  FOR EACH ROW EXECUTE FUNCTION public.agent_decisions_gate();

-- Neue Vorschläge dürfen nicht bereits freigegeben angelegt werden.
CREATE OR REPLACE FUNCTION public.agent_decisions_insert_gate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.status := 'proposed';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agent_decisions_insert_gate ON public.agent_decisions;
CREATE TRIGGER agent_decisions_insert_gate
  BEFORE INSERT ON public.agent_decisions
  FOR EACH ROW EXECUTE FUNCTION public.agent_decisions_insert_gate();

-- 3) Policy ersetzen: Owner/Admin dürfen weiterhin z. B. zurückziehen,
--    Statuswechsel auf approved/rejected verhindert der Trigger.
DROP POLICY IF EXISTS agent_decisions_admin_update ON public.agent_decisions;
CREATE POLICY agent_decisions_admin_update ON public.agent_decisions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_decisions.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_decisions.tenant_id
              AND m.user_id   = auth.uid()
              AND m.role IN ('owner','admin'))
  );

-- 4) Kontrollierter Pfad
CREATE OR REPLACE FUNCTION public.resolve_agent_decision(
  p_decision_id    UUID,
  p_action         TEXT,
  p_option_index   INT DEFAULT NULL,
  p_approval_level TEXT DEFAULT 'L2',
  p_confirm        BOOLEAN DEFAULT false,
  p_note           TEXT DEFAULT NULL
) RETURNS public.agent_decision_approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_dec    public.agent_decisions;
  v_q      UUID;
  v_label  TEXT;
  v_row    public.agent_decision_approvals;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nicht angemeldet' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('approve','reject','defer') THEN
    RAISE EXCEPTION 'ungültige Aktion %', p_action USING ERRCODE = '22023';
  END IF;
  IF p_approval_level NOT IN ('L0','L1','L2','L3','L4') THEN
    RAISE EXCEPTION 'ungültige Freigabestufe %', p_approval_level USING ERRCODE = '22023';
  END IF;
  IF p_action = 'approve' AND p_confirm IS NOT TRUE THEN
    RAISE EXCEPTION 'Freigabe verlangt ausdrückliche Bestätigung (p_confirm = true)' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_dec FROM public.agent_decisions WHERE id = p_decision_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entscheidung nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships m
                 WHERE m.tenant_id = v_dec.tenant_id AND m.user_id = v_uid
                   AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'nur Owner/Admin des Mandanten' USING ERRCODE = '42501';
  END IF;
  IF v_dec.status <> 'proposed' THEN
    RAISE EXCEPTION 'Entscheidung ist nicht mehr offen (%)', v_dec.status USING ERRCODE = '55000';
  END IF;

  IF p_action = 'approve' THEN
    IF p_option_index IS NULL OR p_option_index < 0
       OR p_option_index >= LEAST(jsonb_array_length(v_dec.options), 3) THEN
      RAISE EXCEPTION 'Option % existiert nicht', p_option_index USING ERRCODE = '22023';
    END IF;
    v_label := v_dec.options -> p_option_index ->> 'label';
    UPDATE public.agent_decisions
       SET status = 'approved', approved_by = v_uid, approved_at = now()
     WHERE id = v_dec.id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.agent_decisions SET status = 'rejected' WHERE id = v_dec.id;
  END IF;

  SELECT id INTO v_q FROM public.agent_questions
   WHERE decision_id = v_dec.id AND tenant_id = v_dec.tenant_id
   ORDER BY created_at LIMIT 1;

  INSERT INTO public.agent_decision_approvals
    (tenant_id, decision_id, question_id, action, chosen_option, chosen_label, approval_level, note, actor)
  VALUES
    (v_dec.tenant_id, v_dec.id, v_q, p_action,
     CASE WHEN p_action = 'approve' THEN p_option_index END, v_label, p_approval_level, p_note, v_uid)
  RETURNING * INTO v_row;

  -- Rückmeldung an alle verknüpften Fragen (Historie entsteht per Trigger).
  UPDATE public.agent_questions
     SET status = CASE WHEN p_action = 'defer' THEN 'deferred' ELSE 'answered' END,
         resolution_note = COALESCE(p_note, v_label, p_action)
   WHERE decision_id = v_dec.id AND tenant_id = v_dec.tenant_id AND status = 'open';

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.resolve_agent_decision(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_agent_decision(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_agent_decision IS
  'M4: einziger Client-Pfad zur Freigabe/Ablehnung/Zurückstellung einer agent_decision; schreibt Audit und meldet an agent_questions zurück.';
