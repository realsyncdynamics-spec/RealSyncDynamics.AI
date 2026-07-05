-- AI Act Risk Assessment & Tracking
-- Extends ai_systems with detailed risk assessment data

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 0. Base AI System Registry ───

CREATE TABLE IF NOT EXISTS public.ai_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  provider TEXT, -- 'anthropic', 'openai', 'google', 'ollama', etc.
  model TEXT, -- model name/version
  purpose TEXT, -- System purpose/use case
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'deprecated', 'in_review'
  latest_assessment_id UUID, -- Will be set via UPDATE after assessments table created
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_systems_tenant_id
  ON public.ai_systems(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_systems_status
  ON public.ai_systems(status);

ALTER TABLE public.ai_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_systems tenant_read"
  ON public.ai_systems FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "ai_systems service_write"
  ON public.ai_systems FOR INSERT
  USING (auth.role() = 'service_role');

CREATE POLICY "ai_systems tenant_update"
  ON public.ai_systems FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 1. AI Act Assessment (detailed risk evaluation) ───

CREATE TABLE IF NOT EXISTS public.ai_act_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_system_id UUID NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,

  -- Assessment Metadata
  assessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assessment_date TIMESTAMPTZ DEFAULT now(),
  last_reassessed_at TIMESTAMPTZ,

  -- Risk Classification
  classification TEXT CHECK (classification IN ('minimal_risk', 'limited_risk', 'high_risk', 'prohibited', 'unknown')) DEFAULT 'unknown',
  is_high_risk_annex_iii BOOLEAN DEFAULT false,
  is_prohibited BOOLEAN DEFAULT false,

  /* High-Risk Indicators (from Annex III)
     {
       "personal_data": true/false,
       "large_scale_processing": true/false,
       "special_category_data": true/false,
       "minors_data": true/false,
       "employment_context": true/false,
       "education_training": true/false,
       "law_enforcement": true/false,
       "migration_asylum": true/false,
       "critical_infrastructure": true/false
     }
  */
  indicators JSONB DEFAULT '{}'::jsonb,

  -- Risk Score Breakdown
  overall_risk_score INT CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100) DEFAULT 0,
  data_risk_score INT,
  transparency_risk_score INT,
  accuracy_risk_score INT,
  bias_risk_score INT,

  /* Prohibited Use Cases Check
     {
       "mass_surveillance": true/false,
       "behavior_classification": true/false,
       "social_credit": true/false,
       "biometric_categorization": true/false,
       "facial_recognition_realtime": true/false
     }
  */
  prohibited_uses JSONB DEFAULT '{}'::jsonb,

  -- Recommendation & Approval Status
  recommendation TEXT CHECK (recommendation IN ('allowed', 'requires_approval', 'prohibited', 'further_assessment_needed')) DEFAULT 'further_assessment_needed',
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'conditional')) DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approval_date TIMESTAMPTZ,
  approval_notes TEXT,

  -- Documentation
  evidence_item_ids TEXT[] DEFAULT '{}',
  dpia_id UUID REFERENCES public.dpias(id) ON DELETE SET NULL,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_act_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_act_assessments tenant_read"
  ON public.ai_act_assessments FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "ai_act_assessments service_only_write"
  ON public.ai_act_assessments FOR INSERT
  USING (auth.role() = 'service_role');

CREATE POLICY "ai_act_assessments tenant_update"
  ON public.ai_act_assessments FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_ai_act_assessments_tenant_id
  ON public.ai_act_assessments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ai_act_assessments_ai_system_id
  ON public.ai_act_assessments(ai_system_id);

CREATE INDEX IF NOT EXISTS idx_ai_act_assessments_classification
  ON public.ai_act_assessments(classification);

CREATE INDEX IF NOT EXISTS idx_ai_act_assessments_approval_status
  ON public.ai_act_assessments(approval_status);

-- ─── 2. AI Act Assessment History ───

CREATE TABLE IF NOT EXISTS public.ai_act_assessment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.ai_act_assessments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  action TEXT CHECK (action IN ('created', 'reassessed', 'approved', 'rejected')) NOT NULL,
  classification_before TEXT,
  classification_after TEXT,
  risk_score_before INT,
  risk_score_after INT,

  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_act_assessment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_act_assessment_history tenant_read"
  ON public.ai_act_assessment_history FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_ai_act_assessment_history_assessment_id
  ON public.ai_act_assessment_history(assessment_id);

-- ─── 3. Add index for latest_assessment_id on ai_systems ───

CREATE INDEX IF NOT EXISTS idx_ai_systems_latest_assessment_id
  ON public.ai_systems(latest_assessment_id);

-- ─── 4. RPC: Auto-classify based on indicators ───

CREATE OR REPLACE FUNCTION public.assess_ai_act_risk(
  p_assessment_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicators JSONB;
  v_risk_score INT := 0;
  v_classification TEXT;
BEGIN
  SELECT indicators INTO v_indicators
  FROM public.ai_act_assessments
  WHERE id = p_assessment_id;

  -- Simple scoring: check indicators
  IF (v_indicators->>'large_scale_processing')::boolean THEN v_risk_score := v_risk_score + 20; END IF;
  IF (v_indicators->>'special_category_data')::boolean THEN v_risk_score := v_risk_score + 25; END IF;
  IF (v_indicators->>'minors_data')::boolean THEN v_risk_score := v_risk_score + 25; END IF;
  IF (v_indicators->>'employment_context')::boolean THEN v_risk_score := v_risk_score + 15; END IF;
  IF (v_indicators->>'critical_infrastructure')::boolean THEN v_risk_score := v_risk_score + 25; END IF;

  -- Determine classification
  IF EXISTS (
    SELECT 1 FROM public.ai_act_assessments
    WHERE id = p_assessment_id
      AND (prohibited_uses->>'mass_surveillance')::boolean
  ) THEN
    v_classification := 'prohibited';
  ELSIF v_risk_score >= 50 THEN
    v_classification := 'high_risk';
  ELSIF v_risk_score >= 20 THEN
    v_classification := 'limited_risk';
  ELSE
    v_classification := 'minimal_risk';
  END IF;

  UPDATE public.ai_act_assessments
  SET
    overall_risk_score = v_risk_score,
    classification = v_classification,
    recommendation = CASE
      WHEN v_classification = 'prohibited' THEN 'prohibited'
      WHEN v_classification = 'high_risk' THEN 'requires_approval'
      ELSE 'allowed'
    END
  WHERE id = p_assessment_id;

  RETURN v_classification;
END;
$$;

-- ─── 5. RPC: List high-risk AI systems ───

CREATE OR REPLACE FUNCTION public.list_high_risk_ai_systems(p_tenant_id UUID)
RETURNS TABLE (
  ai_system_id UUID,
  ai_system_name TEXT,
  classification TEXT,
  risk_score INT,
  approval_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.name,
    aa.classification,
    aa.overall_risk_score,
    aa.approval_status
  FROM public.ai_systems a
  LEFT JOIN public.ai_act_assessments aa ON aa.ai_system_id = a.id
  WHERE a.tenant_id = p_tenant_id
    AND aa.classification IN ('high_risk', 'prohibited')
  ORDER BY aa.overall_risk_score DESC;
$$;
