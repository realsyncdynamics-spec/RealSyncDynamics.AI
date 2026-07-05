-- Compliance Gaps: identified missing implementations
-- Tracks gaps in framework compliance per tenant

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Compliance Gaps (Gap-Analyse-Resultat) ───

CREATE TABLE IF NOT EXISTS public.compliance_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  framework_id UUID NOT NULL,
  control_id UUID NOT NULL REFERENCES public.framework_controls(id) ON DELETE CASCADE,

  -- Gap Status & Priority
  status TEXT CHECK (status IN ('identified', 'planned', 'in_progress', 'resolved', 'accepted_risk', 'deferred')) DEFAULT 'identified',
  risk_level TEXT CHECK (risk_level IN ('info', 'low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  priority INT CHECK (priority >= 1 AND priority <= 10) DEFAULT 5,

  -- Remediation Details
  remediation_notes TEXT,
  remediation_owner UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_effort_hours INT,
  due_date DATE,

  -- Evidence Tracking
  evidence_item_ids TEXT[] DEFAULT '{}',
  related_incident_ids TEXT[] DEFAULT '{}',

  -- Audit Trail
  identified_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, framework_id, control_id)
);

ALTER TABLE public.compliance_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_gaps tenant_read"
  ON public.compliance_gaps FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "compliance_gaps tenant_write"
  ON public.compliance_gaps FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "compliance_gaps tenant_update"
  ON public.compliance_gaps FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_compliance_gaps_tenant_id
  ON public.compliance_gaps(tenant_id);

CREATE INDEX IF NOT EXISTS idx_compliance_gaps_framework_id
  ON public.compliance_gaps(framework_id);

CREATE INDEX IF NOT EXISTS idx_compliance_gaps_status
  ON public.compliance_gaps(status);

CREATE INDEX IF NOT EXISTS idx_compliance_gaps_risk_level
  ON public.compliance_gaps(risk_level);

CREATE INDEX IF NOT EXISTS idx_compliance_gaps_due_date
  ON public.compliance_gaps(due_date) WHERE due_date IS NOT NULL;

-- ─── 2. Gap Analysis History (audit trail for gap changes) ───

CREATE TABLE IF NOT EXISTS public.gap_analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_id UUID NOT NULL REFERENCES public.compliance_gaps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  action TEXT CHECK (action IN ('created', 'updated', 'resolved', 'reopened')) NOT NULL,
  status_before TEXT,
  status_after TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gap_analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gap_analysis_history tenant_read"
  ON public.gap_analysis_history FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "gap_analysis_history service_only"
  ON public.gap_analysis_history FOR INSERT
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_gap_analysis_history_gap_id
  ON public.gap_analysis_history(gap_id);

CREATE INDEX IF NOT EXISTS idx_gap_analysis_history_tenant_id
  ON public.gap_analysis_history(tenant_id);

-- ─── 3. RPC: Count open gaps by severity ───

CREATE OR REPLACE FUNCTION public.count_open_gaps_by_severity(p_tenant_id UUID)
RETURNS TABLE (
  critical INT,
  high INT,
  medium INT,
  low INT,
  info INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE risk_level = 'critical')::INT AS critical,
    COUNT(*) FILTER (WHERE risk_level = 'high')::INT AS high,
    COUNT(*) FILTER (WHERE risk_level = 'medium')::INT AS medium,
    COUNT(*) FILTER (WHERE risk_level = 'low')::INT AS low,
    COUNT(*) FILTER (WHERE risk_level = 'info')::INT AS info
  FROM public.compliance_gaps
  WHERE tenant_id = p_tenant_id
    AND status IN ('identified', 'planned', 'in_progress');
$$;

-- ─── 4. RPC: Calculate compliance score per framework ───

CREATE OR REPLACE FUNCTION public.calculate_compliance_score(p_tenant_id UUID, p_framework_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      (
        COUNT(CASE WHEN fi.status IN ('implemented', 'optimized') THEN 1 END)::NUMERIC /
        NULLIF(COUNT(fi.id)::NUMERIC, 0)
      ) * 100
    )::INT,
    0
  ) AS score
  FROM public.framework_implementations fi
  WHERE fi.tenant_id = p_tenant_id
    AND fi.framework_id = p_framework_id;
$$;
