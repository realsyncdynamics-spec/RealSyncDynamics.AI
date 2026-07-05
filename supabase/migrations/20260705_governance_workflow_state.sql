-- Governance Onboarding Workflow State
-- Tracks responses and progress through the 10-step guided governance onboarding

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Governance Workflow State ───

CREATE TABLE IF NOT EXISTS public.governance_workflow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

  -- Workflow Progress
  current_step INT CHECK (current_step >= 0 AND current_step <= 10) DEFAULT 0,
  completed_steps INT[] DEFAULT '{}', -- array of step numbers that have been completed
  last_step_completed_at TIMESTAMPTZ,

  -- ─── Step 1: KI-Nutzung ───
  step1_ai_usage TEXT[] DEFAULT '{}', -- ['openai', 'anthropic', 'google', 'internal', 'ollama', 'other']
  step1_other_ai_vendors TEXT, -- free-text for 'other'

  -- ─── Step 2: Personenbezogene Daten ───
  step2_personal_data BOOLEAN,
  step2_personal_data_types TEXT[] DEFAULT '{}', -- ['names', 'emails', 'ip_addresses', 'behavior_data', 'special_category']
  step2_dpia_link UUID REFERENCES public.dpias(id) ON DELETE SET NULL,

  -- ─── Step 3: Externe KI-Dienstleister ───
  step3_external_vendors BOOLEAN,
  step3_vendor_names TEXT[], -- OpenAI, Google Cloud AI, etc.
  step3_vendor_processing TEXT, -- description of what data is processed

  -- ─── Step 4: Kritische Geschäftsprozesse ───
  step4_critical_processes BOOLEAN,
  step4_process_descriptions TEXT[], -- list of critical processes
  step4_affected_stakeholders TEXT, -- 'employees', 'customers', 'partners', 'public'

  -- ─── Step 5: Sicherheitsvorfälle ───
  step5_security_incidents BOOLEAN,
  step5_incident_count INT,
  step5_last_incident_date DATE,
  step5_incident_types TEXT[] DEFAULT '{}', -- ['data_breach', 'ransomware', 'phishing', 'unauthorized_access', 'other']

  -- ─── Step 6: Bestehende DSGVO-Dokumente ───
  step6_dsgvo_docs BOOLEAN,
  step6_privacy_policy_exists BOOLEAN,
  step6_dpa_exists BOOLEAN,
  step6_breach_notification_plan_exists BOOLEAN,
  step6_evidence_item_ids TEXT[] DEFAULT '{}', -- UUIDs of uploaded evidence

  -- ─── Step 7: ISMS (Information Security Management System) ───
  step7_isms_in_place BOOLEAN,
  step7_isms_description TEXT,
  step7_isms_certified BOOLEAN,

  -- ─── Step 8a: ISO 27001 Zertifizierung ───
  step8_iso27001_certified BOOLEAN,
  step8_iso27001_cert_date DATE,
  step8_iso27001_cert_file_path TEXT,
  step8_iso27001_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL,

  -- ─── Step 8b: ISO 42001 (AI Management) Zertifizierung ───
  step8_iso42001_certified BOOLEAN,
  step8_iso42001_cert_date DATE,
  step8_iso42001_cert_file_path TEXT,
  step8_iso42001_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL,

  -- ─── Step 9: Gap-Analyse (automatisch berechnet) ───
  step9_analysis_completed BOOLEAN DEFAULT false,
  step9_analysis_completed_at TIMESTAMPTZ,
  step9_missing_gaps_count INT, -- total count of identified gaps
  step9_critical_gaps_count INT,
  step9_gap_ids TEXT[] DEFAULT '{}', -- UUIDs of compliance_gaps created
  step9_estimated_remediation_weeks INT, -- rough estimate

  -- ─── Step 10: Tier-Empfehlung & Checkout ───
  step10_recommended_plan TEXT CHECK (step10_recommended_plan IN ('free', 'starter', 'growth', 'agency', 'enterprise')),
  step10_recommended_addons TEXT[] DEFAULT '{}', -- ['iso27001', 'iso42001', 'nis2']
  step10_recommendation_reason TEXT, -- explanation for recommendation
  step10_checkout_initiated BOOLEAN DEFAULT false,
  step10_checkout_initiated_at TIMESTAMPTZ,
  step10_checkout_completed BOOLEAN DEFAULT false,
  step10_checkout_completed_at TIMESTAMPTZ,

  -- Overall Workflow Status
  workflow_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  workflow_abandoned BOOLEAN DEFAULT false,
  abandoned_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.governance_workflow_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_workflow_state tenant_read"
  ON public.governance_workflow_state FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_workflow_state tenant_write"
  ON public.governance_workflow_state FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_workflow_state tenant_update"
  ON public.governance_workflow_state FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "governance_workflow_state service_only"
  ON public.governance_workflow_state FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_governance_workflow_state_tenant_id
  ON public.governance_workflow_state(tenant_id);

CREATE INDEX IF NOT EXISTS idx_governance_workflow_state_current_step
  ON public.governance_workflow_state(current_step);

CREATE INDEX IF NOT EXISTS idx_governance_workflow_state_completed
  ON public.governance_workflow_state(workflow_completed);

-- ─── 2. RPC: Get or create workflow state ───

CREATE OR REPLACE FUNCTION public.get_or_create_governance_workflow(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow_id UUID;
BEGIN
  -- Try to get existing
  SELECT id INTO v_workflow_id
  FROM public.governance_workflow_state
  WHERE tenant_id = p_tenant_id;

  IF v_workflow_id IS NOT NULL THEN
    RETURN v_workflow_id;
  END IF;

  -- Create new
  INSERT INTO public.governance_workflow_state (tenant_id, current_step)
  VALUES (p_tenant_id, 1)
  RETURNING id INTO v_workflow_id;

  RETURN v_workflow_id;
END;
$$;

-- ─── 3. RPC: Save step responses ───

CREATE OR REPLACE FUNCTION public.save_workflow_step(
  p_tenant_id UUID,
  p_step INT,
  p_step_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.governance_workflow_state (tenant_id, current_step)
  VALUES (p_tenant_id, p_step)
  ON CONFLICT (tenant_id) DO UPDATE SET
    current_step = p_step,
    last_step_completed_at = now(),
    completed_steps = array_append(
      CASE WHEN p_step = ANY(governance_workflow_state.completed_steps) THEN governance_workflow_state.completed_steps
      ELSE array_append(governance_workflow_state.completed_steps, p_step) END,
      p_step
    ),
    updated_at = now();

  -- Store step-specific data based on p_step
  -- (Implementation per step in edge function)

  RETURN true;
END;
$$;

-- ─── 4. RPC: Calculate gap analysis from workflow answers ───

CREATE OR REPLACE FUNCTION public.analyze_governance_gaps_from_workflow(p_tenant_id UUID)
RETURNS TABLE (
  gaps_created INT,
  critical_gaps INT,
  estimated_weeks INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gap_count INT := 0;
  v_critical_count INT := 0;
  v_estimated_weeks INT := 0;
  v_workflow_id UUID;
BEGIN
  -- Get workflow state
  SELECT id INTO v_workflow_id
  FROM public.governance_workflow_state
  WHERE tenant_id = p_tenant_id;

  -- Placeholder: actual logic would create gaps based on answers
  -- For now, return sample values for demo

  RETURN QUERY
  SELECT
    v_gap_count::INT,
    v_critical_count::INT,
    v_estimated_weeks::INT;
END;
$$;

-- ─── 5. RPC: Get plan recommendation based on workflow ───

CREATE OR REPLACE FUNCTION public.recommend_governance_plan(p_tenant_id UUID)
RETURNS TABLE (
  plan_key TEXT,
  plan_name TEXT,
  reason TEXT,
  addons TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workflow RECORD;
  v_recommended_plan TEXT := 'starter';
  v_reason TEXT := 'Standard compliance needs';
  v_addons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_workflow
  FROM public.governance_workflow_state
  WHERE tenant_id = p_tenant_id;

  IF v_workflow IS NULL THEN
    RETURN QUERY SELECT 'starter'::TEXT, 'Starter'::TEXT, 'Workflow not completed'::TEXT, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  -- Simple recommendation logic (can be enhanced)
  IF v_workflow.step5_security_incidents = true OR
     COALESCE(v_workflow.step3_external_vendors, false) = true THEN
    v_recommended_plan := 'growth';
    v_reason := 'Incident history or external vendors detected';
  END IF;

  IF v_workflow.step8_iso27001_certified = false AND
     v_workflow.step7_isms_in_place = false THEN
    v_addons := array_append(v_addons, 'iso27001');
  END IF;

  IF COALESCE(array_length(v_workflow.step1_ai_usage, 1), 0) > 2 THEN
    v_addons := array_append(v_addons, 'iso42001');
  END IF;

  RETURN QUERY
  SELECT
    v_recommended_plan::TEXT,
    CASE v_recommended_plan
      WHEN 'starter' THEN 'Starter'
      WHEN 'growth' THEN 'Growth'
      WHEN 'agency' THEN 'Agency'
      WHEN 'enterprise' THEN 'Enterprise'
      ELSE 'Custom'
    END::TEXT,
    v_reason::TEXT,
    v_addons::TEXT[];
END;
$$;
