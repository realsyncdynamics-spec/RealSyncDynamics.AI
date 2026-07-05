-- NIS2 Incident Reporting Deadlines
-- Tracks NIS2-specific incident reporting obligations and deadlines


-- ─── 1. NIS2 Incident Deadlines ───

CREATE TABLE IF NOT EXISTS public.nis2_incident_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,

  -- Severity Classification
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  is_significant_incident BOOLEAN DEFAULT false, -- affects significant number of users

  -- Reporting Obligations
  initial_assessment_deadline TIMESTAMPTZ NOT NULL, -- 6 Stunden nach Incident-Beginn (Detection)
  simplified_report_deadline TIMESTAMPTZ NOT NULL, -- 24 Stunden (optional, kann übersprungen werden)
  full_notification_deadline TIMESTAMPTZ NOT NULL, -- 72 Stunden

  -- Authority & Contacts
  competent_authority TEXT, -- 'BSI', 'BfDI', 'DiGA', 'Landesdatenschutzbehörde'
  authority_contact_email TEXT,
  authority_reporting_url TEXT,

  -- Status Tracking
  initial_assessment_completed BOOLEAN DEFAULT false,
  initial_assessment_completed_at TIMESTAMPTZ,
  initial_assessment_notes TEXT,

  simplified_report_sent BOOLEAN DEFAULT false,
  simplified_report_sent_at TIMESTAMPTZ,
  simplified_report_reference TEXT,

  full_notification_sent BOOLEAN DEFAULT false,
  full_notification_sent_at TIMESTAMPTZ,
  full_notification_reference TEXT, -- Reference from authority

  -- Compliance Check
  is_compliant_with_deadline BOOLEAN DEFAULT false,
  compliance_checked_at TIMESTAMPTZ,

  -- Evidence & Documentation
  evidence_item_ids TEXT[] DEFAULT '{}',
  assessment_notes TEXT,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nis2_incident_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nis2_incident_deadlines tenant_read"
  ON public.nis2_incident_deadlines FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "nis2_incident_deadlines tenant_write"
  ON public.nis2_incident_deadlines FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "nis2_incident_deadlines tenant_update"
  ON public.nis2_incident_deadlines FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "nis2_incident_deadlines service_only"
  ON public.nis2_incident_deadlines FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_nis2_incident_deadlines_tenant_id
  ON public.nis2_incident_deadlines(tenant_id);

CREATE INDEX IF NOT EXISTS idx_nis2_incident_deadlines_incident_id
  ON public.nis2_incident_deadlines(incident_id);

CREATE INDEX IF NOT EXISTS idx_nis2_incident_deadlines_full_notification_deadline
  ON public.nis2_incident_deadlines(full_notification_deadline)
  WHERE full_notification_sent = false;

CREATE INDEX IF NOT EXISTS idx_nis2_incident_deadlines_compliance
  ON public.nis2_incident_deadlines(is_compliant_with_deadline);

-- ─── 2. NIS2 Deadline Status View ───

CREATE OR REPLACE VIEW public.nis2_deadline_status AS
SELECT
  nid.id,
  nid.tenant_id,
  nid.incident_id,
  nid.severity,
  nid.full_notification_deadline,
  nid.full_notification_sent,
  EXTRACT(EPOCH FROM (nid.full_notification_deadline - now())) / 3600 AS hours_remaining,
  CASE
    WHEN nid.full_notification_sent THEN 'completed'
    WHEN now() > nid.full_notification_deadline THEN 'overdue'
    WHEN now() > (nid.full_notification_deadline - INTERVAL '24 hours') THEN 'critical'
    WHEN now() > (nid.full_notification_deadline - INTERVAL '48 hours') THEN 'urgent'
    ELSE 'on_track'
  END AS status,
  nid.created_at
FROM public.nis2_incident_deadlines nid;

ALTER VIEW public.nis2_deadline_status OWNER TO postgres;

-- ─── 3. RPC: Create NIS2 deadlines for new incident ───

CREATE OR REPLACE FUNCTION public.create_nis2_deadlines(
  p_tenant_id UUID,
  p_incident_id UUID,
  p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deadline_id UUID;
  v_detection_time TIMESTAMPTZ;
  v_competent_authority TEXT;
BEGIN
  -- Get incident detection time
  SELECT detected_at INTO v_detection_time
  FROM public.incidents
  WHERE id = p_incident_id;

  IF v_detection_time IS NULL THEN
    v_detection_time := now();
  END IF;

  -- Determine competent authority (simplified: German example)
  v_competent_authority := 'BSI'; -- Bundesamt für Sicherheit in der Informationstechnik

  -- Create NIS2 deadline record
  INSERT INTO public.nis2_incident_deadlines (
    tenant_id,
    incident_id,
    severity,
    initial_assessment_deadline,
    simplified_report_deadline,
    full_notification_deadline,
    competent_authority,
    is_significant_incident
  )
  VALUES (
    p_tenant_id,
    p_incident_id,
    p_severity,
    v_detection_time + INTERVAL '6 hours',
    v_detection_time + INTERVAL '24 hours',
    v_detection_time + INTERVAL '72 hours',
    v_competent_authority,
    p_severity IN ('high', 'critical')
  )
  RETURNING id INTO v_deadline_id;

  RETURN v_deadline_id;
END;
$$;

-- ─── 4. RPC: Check compliance with NIS2 deadlines ───

CREATE OR REPLACE FUNCTION public.check_nis2_deadline_compliance(p_deadline_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_compliant BOOLEAN;
BEGIN
  SELECT (full_notification_sent AND full_notification_sent_at <= full_notification_deadline)
    OR (now() <= full_notification_deadline)
  INTO v_is_compliant
  FROM public.nis2_incident_deadlines
  WHERE id = p_deadline_id;

  UPDATE public.nis2_incident_deadlines
  SET
    is_compliant_with_deadline = v_is_compliant,
    compliance_checked_at = now()
  WHERE id = p_deadline_id;

  RETURN COALESCE(v_is_compliant, false);
END;
$$;

-- ─── 5. RPC: List incidents nearing deadline ───

CREATE OR REPLACE FUNCTION public.list_nis2_incidents_nearing_deadline(
  p_tenant_id UUID,
  p_hours_until INT DEFAULT 24
)
RETURNS TABLE (
  deadline_id UUID,
  incident_id UUID,
  severity TEXT,
  hours_remaining NUMERIC,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    nid.id,
    nid.incident_id,
    nid.severity,
    EXTRACT(EPOCH FROM (nid.full_notification_deadline - now())) / 3600 AS hours_remaining,
    CASE
      WHEN nid.full_notification_sent THEN 'completed'
      WHEN now() > nid.full_notification_deadline THEN 'overdue'
      ELSE 'pending'
    END AS status
  FROM public.nis2_incident_deadlines nid
  WHERE nid.tenant_id = p_tenant_id
    AND nid.full_notification_sent = false
    AND now() < (nid.full_notification_deadline + INTERVAL '1 hour')
    AND now() > (nid.full_notification_deadline - INTERVAL '1 day' * p_hours_until)
  ORDER BY nid.full_notification_deadline ASC;
$$;
