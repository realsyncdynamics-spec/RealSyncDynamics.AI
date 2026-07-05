-- ISO 27001 & ISO 42001 Control Implementations
-- Tracks implementation status of ISO controls for information security and AI management

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. ISO 27001 Control Implementations ───

CREATE TABLE IF NOT EXISTS public.iso27001_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Control Reference
  control_code TEXT NOT NULL, -- 'A.5.1', 'A.7.2', 'A.8.1'
  control_name TEXT,
  control_category TEXT, -- 'Organization', 'People', 'Assets', 'Access Control', 'Cryptography', etc.

  -- Implementation Status
  status TEXT CHECK (status IN ('not_started', 'planned', 'in_progress', 'implemented', 'optimized', 'deferred')) DEFAULT 'not_started',
  implementation_date DATE,
  last_review_date DATE,
  next_review_date DATE,

  -- Details
  description TEXT,
  implementation_notes TEXT,
  responsible_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Evidence Tracking
  evidence_item_ids TEXT[] DEFAULT '{}', -- UUIDs of evidence_items
  audit_findings JSONB DEFAULT '{}', -- stored audit observations

  -- Maturity Level (0-5)
  maturity_level INT CHECK (maturity_level >= 0 AND maturity_level <= 5) DEFAULT 0,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, control_code)
);

ALTER TABLE public.iso27001_implementations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iso27001_implementations tenant_read"
  ON public.iso27001_implementations FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "iso27001_implementations tenant_write"
  ON public.iso27001_implementations FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "iso27001_implementations tenant_update"
  ON public.iso27001_implementations FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_iso27001_implementations_tenant_id
  ON public.iso27001_implementations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_iso27001_implementations_status
  ON public.iso27001_implementations(status);

CREATE INDEX IF NOT EXISTS idx_iso27001_implementations_maturity_level
  ON public.iso27001_implementations(maturity_level);

-- ─── 2. ISO 42001 Control Implementations (AI Management) ───

CREATE TABLE IF NOT EXISTS public.iso42001_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Control Reference
  control_code TEXT NOT NULL, -- 'A.4.1', 'A.5.2', 'A.6.1'
  control_name TEXT,
  control_category TEXT, -- 'AI Management System', 'Risk Management', 'Impact Assessment', 'Transparency', etc.

  -- AI System Linkage (optional, can apply to multiple or all)
  ai_system_id UUID REFERENCES public.ai_systems(id) ON DELETE SET NULL,
  applies_to_all_systems BOOLEAN DEFAULT false,

  -- Implementation Status
  status TEXT CHECK (status IN ('not_started', 'planned', 'in_progress', 'implemented', 'optimized', 'deferred')) DEFAULT 'not_started',
  implementation_date DATE,
  last_review_date DATE,
  next_review_date DATE,

  -- Details
  description TEXT,
  implementation_notes TEXT,
  responsible_person_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Evidence Tracking
  evidence_item_ids TEXT[] DEFAULT '{}',
  assessment_results JSONB DEFAULT '{}', -- assessment data

  -- Maturity Level (0-5)
  maturity_level INT CHECK (maturity_level >= 0 AND maturity_level <= 5) DEFAULT 0,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, control_code, COALESCE(ai_system_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

ALTER TABLE public.iso42001_implementations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iso42001_implementations tenant_read"
  ON public.iso42001_implementations FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "iso42001_implementations tenant_write"
  ON public.iso42001_implementations FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "iso42001_implementations tenant_update"
  ON public.iso42001_implementations FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_iso42001_implementations_tenant_id
  ON public.iso42001_implementations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_iso42001_implementations_ai_system_id
  ON public.iso42001_implementations(ai_system_id);

CREATE INDEX IF NOT EXISTS idx_iso42001_implementations_status
  ON public.iso42001_implementations(status);

CREATE INDEX IF NOT EXISTS idx_iso42001_implementations_maturity_level
  ON public.iso42001_implementations(maturity_level);

-- ─── 3. ISO Audit History ───

CREATE TABLE IF NOT EXISTS public.iso_audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  audit_type TEXT CHECK (audit_type IN ('iso27001', 'iso42001')) NOT NULL,
  control_id UUID NOT NULL,
  audit_date TIMESTAMPTZ DEFAULT now(),

  maturity_level_before INT,
  maturity_level_after INT,
  status_before TEXT,
  status_after TEXT,

  auditor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  findings TEXT,
  recommendations TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.iso_audit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "iso_audit_history tenant_read"
  ON public.iso_audit_history FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_iso_audit_history_tenant_id
  ON public.iso_audit_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_iso_audit_history_audit_date
  ON public.iso_audit_history(audit_date DESC);

-- ─── 4. RPC: Calculate ISO 27001 compliance score ───

CREATE OR REPLACE FUNCTION public.calculate_iso27001_maturity(p_tenant_id UUID)
RETURNS TABLE (
  total_controls INT,
  implemented_controls INT,
  maturity_average NUMERIC,
  compliance_percentage NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INT AS total_controls,
    COUNT(*) FILTER (WHERE status IN ('implemented', 'optimized'))::INT AS implemented_controls,
    ROUND(AVG(maturity_level)::NUMERIC, 1) AS maturity_average,
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('implemented', 'optimized'))::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
      1
    ) AS compliance_percentage
  FROM public.iso27001_implementations
  WHERE tenant_id = p_tenant_id;
$$;

-- ─── 5. RPC: Calculate ISO 42001 AI Management maturity ───

CREATE OR REPLACE FUNCTION public.calculate_iso42001_maturity(p_tenant_id UUID)
RETURNS TABLE (
  total_controls INT,
  implemented_controls INT,
  maturity_average NUMERIC,
  compliance_percentage NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INT AS total_controls,
    COUNT(*) FILTER (WHERE status IN ('implemented', 'optimized'))::INT AS implemented_controls,
    ROUND(AVG(maturity_level)::NUMERIC, 1) AS maturity_average,
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('implemented', 'optimized'))::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
      1
    ) AS compliance_percentage
  FROM public.iso42001_implementations
  WHERE tenant_id = p_tenant_id;
$$;

-- ─── 6. RPC: List overdue ISO reviews ───

CREATE OR REPLACE FUNCTION public.list_overdue_iso_reviews(p_tenant_id UUID)
RETURNS TABLE (
  control_type TEXT,
  control_code TEXT,
  next_review_date DATE,
  days_overdue INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'ISO 27001'::TEXT,
    control_code,
    next_review_date,
    (EXTRACT(DAY FROM (now()::DATE - next_review_date)))::INT AS days_overdue
  FROM public.iso27001_implementations
  WHERE tenant_id = p_tenant_id
    AND next_review_date IS NOT NULL
    AND next_review_date < now()::DATE
  UNION ALL
  SELECT
    'ISO 42001'::TEXT,
    control_code,
    next_review_date,
    (EXTRACT(DAY FROM (now()::DATE - next_review_date)))::INT AS days_overdue
  FROM public.iso42001_implementations
  WHERE tenant_id = p_tenant_id
    AND next_review_date IS NOT NULL
    AND next_review_date < now()::DATE
  ORDER BY days_overdue DESC;
$$;
