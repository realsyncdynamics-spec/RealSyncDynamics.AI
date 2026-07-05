-- Audit Reports Extended: Multi-framework compliance reporting
-- Extends audit reports with framework-specific findings and scoring

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 0. Create base audit_reports table if it doesn't exist ───

CREATE TABLE IF NOT EXISTS public.audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  audit_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'draft', -- 'draft', 'in_progress', 'completed', 'published'
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit_reports
CREATE INDEX IF NOT EXISTS idx_audit_reports_tenant_id ON public.audit_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_status ON public.audit_reports(status);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_at ON public.audit_reports(created_at DESC);

-- Enable RLS for audit_reports
ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_reports tenant_read"
  ON public.audit_reports FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_reports tenant_write"
  ON public.audit_reports FOR INSERT
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_reports tenant_update"
  ON public.audit_reports FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

-- ─── 1. Add framework-specific columns to audit_reports ───

ALTER TABLE public.audit_reports
  ADD COLUMN IF NOT EXISTS frameworks_covered TEXT[] DEFAULT '{}'; -- ['gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001']

ALTER TABLE public.audit_reports
  ADD COLUMN IF NOT EXISTS compliance_score INT DEFAULT 0 CHECK (compliance_score >= 0 AND compliance_score <= 100);

ALTER TABLE public.audit_reports
  ADD COLUMN IF NOT EXISTS report_scope TEXT; -- 'website', 'ai_systems', 'full_organization', 'custom'

-- ─── 2. Framework-specific findings table ───

CREATE TABLE IF NOT EXISTS public.audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Framework & Control
  framework_code TEXT NOT NULL, -- 'gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001'
  control_id UUID REFERENCES public.framework_controls(id) ON DELETE SET NULL,
  control_reference TEXT, -- 'Art. 32', 'A.5.1'

  -- Finding Details
  severity TEXT CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  finding_category TEXT, -- 'missing_control', 'weak_implementation', 'non_compliance', 'improvement_opportunity'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT, -- description of how finding was discovered

  -- Remediation
  remediation_recommendation TEXT,
  estimated_remediation_hours INT,
  remediation_priority INT CHECK (remediation_priority >= 1 AND remediation_priority <= 10),

  -- Reference to compliance gap (if already identified) - stored as UUID without constraint
  compliance_gap_id UUID,

  -- Status
  status TEXT CHECK (status IN ('identified', 'acknowledged', 'remediation_planned', 'remediation_in_progress', 'remediated', 'deferred')) DEFAULT 'identified',
  status_updated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(audit_report_id, framework_code, control_reference)
);

ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_findings tenant_read"
  ON public.audit_findings FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_findings tenant_write"
  ON public.audit_findings FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_findings tenant_update"
  ON public.audit_findings FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_report_id
  ON public.audit_findings(audit_report_id);

CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant_id
  ON public.audit_findings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_findings_framework_code
  ON public.audit_findings(framework_code);

CREATE INDEX IF NOT EXISTS idx_audit_findings_severity
  ON public.audit_findings(severity);

CREATE INDEX IF NOT EXISTS idx_audit_findings_status
  ON public.audit_findings(status);

-- ─── 3. Framework Compliance Summary per Report ───

CREATE TABLE IF NOT EXISTS public.framework_compliance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  framework_code TEXT NOT NULL, -- 'gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001'
  framework_name TEXT,

  -- Scores
  compliance_score INT CHECK (compliance_score >= 0 AND compliance_score <= 100),
  controls_total INT,
  controls_compliant INT,
  controls_partially_compliant INT,
  controls_non_compliant INT,

  -- Findings Summary
  critical_findings INT DEFAULT 0,
  high_findings INT DEFAULT 0,
  medium_findings INT DEFAULT 0,
  low_findings INT DEFAULT 0,

  -- Status
  overall_status TEXT CHECK (overall_status IN ('compliant', 'mostly_compliant', 'partially_compliant', 'non_compliant')) DEFAULT 'partially_compliant',

  -- Evidence & Metadata
  key_findings_summary TEXT,
  recommendations_summary TEXT,
  evidence_item_ids TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(audit_report_id, framework_code)
);

ALTER TABLE public.framework_compliance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "framework_compliance_summary tenant_read"
  ON public.framework_compliance_summary FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_framework_compliance_summary_audit_report_id
  ON public.framework_compliance_summary(audit_report_id);

CREATE INDEX IF NOT EXISTS idx_framework_compliance_summary_framework_code
  ON public.framework_compliance_summary(framework_code);

-- ─── 4. Compliance Roadmap (from audit) ───

CREATE TABLE IF NOT EXISTS public.audit_compliance_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  framework_code TEXT NOT NULL,
  priority_order INT, -- 1 = highest priority

  -- Milestone
  milestone_title TEXT,
  target_date DATE,
  estimated_effort_weeks INT,

  -- Tasks
  tasks JSONB DEFAULT '[]', -- [{task, owner, due_date, status}]

  status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold')) DEFAULT 'planned',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_compliance_roadmap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_compliance_roadmap tenant_read"
  ON public.audit_compliance_roadmap FOR SELECT
  USING (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_compliance_roadmap tenant_write"
  ON public.audit_compliance_roadmap FOR INSERT
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "audit_compliance_roadmap tenant_update"
  ON public.audit_compliance_roadmap FOR UPDATE
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_audit_compliance_roadmap_audit_report_id
  ON public.audit_compliance_roadmap(audit_report_id);

CREATE INDEX IF NOT EXISTS idx_audit_compliance_roadmap_framework_code
  ON public.audit_compliance_roadmap(framework_code);

-- ─── 5. RPC: Generate compliance summary for report ───

CREATE OR REPLACE FUNCTION public.generate_compliance_summary(
  p_audit_report_id UUID,
  p_framework_code TEXT
)
RETURNS TABLE (
  compliance_score INT,
  critical_count INT,
  high_count INT,
  medium_count INT,
  low_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      ROUND(
        (
          (COUNT(*) FILTER (WHERE severity = 'critical') * 0)::NUMERIC +
          (COUNT(*) FILTER (WHERE severity = 'high') * 10)::NUMERIC +
          (COUNT(*) FILTER (WHERE severity = 'medium') * 25)::NUMERIC +
          (COUNT(*) FILTER (WHERE severity = 'low') * 40)::NUMERIC +
          (COUNT(*) FILTER (WHERE severity = 'info') * 50)::NUMERIC
        ) / NULLIF(COUNT(*)::NUMERIC, 0)
      )::INT,
      100
    ) AS compliance_score,
    COUNT(*) FILTER (WHERE severity = 'critical')::INT AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'high')::INT AS high_count,
    COUNT(*) FILTER (WHERE severity = 'medium')::INT AS medium_count,
    COUNT(*) FILTER (WHERE severity = 'low')::INT AS low_count
  FROM public.audit_findings
  WHERE audit_report_id = p_audit_report_id
    AND framework_code = p_framework_code;
$$;

-- ─── 6. RPC: List all findings by severity ───

CREATE OR REPLACE FUNCTION public.audit_findings_by_severity(
  p_audit_report_id UUID
)
RETURNS TABLE (
  severity TEXT,
  finding_count INT,
  framework_breakdown JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    af.severity,
    COUNT(*)::INT,
    jsonb_object_agg(
      af.framework_code,
      COUNT(*)::INT
    )
  FROM public.audit_findings af
  WHERE af.audit_report_id = p_audit_report_id
  GROUP BY af.severity, af.framework_code
  ORDER BY
    CASE af.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      WHEN 'info' THEN 5
    END;
$$;

-- ─── 7. View: Compliance Report Ready (all data joined) ───

CREATE OR REPLACE VIEW public.compliance_report_ready AS
SELECT
  ar.id AS report_id,
  ar.tenant_id,
  ar.compliance_score,
  ar.frameworks_covered,
  COUNT(af.id) AS total_findings,
  COUNT(af.id) FILTER (WHERE af.severity = 'critical')::INT AS critical_findings,
  COUNT(af.id) FILTER (WHERE af.severity = 'high')::INT AS high_findings,
  ar.created_at,
  ar.updated_at
FROM public.audit_reports ar
LEFT JOIN public.audit_findings af ON af.audit_report_id = ar.id
GROUP BY ar.id, ar.tenant_id, ar.compliance_score, ar.frameworks_covered, ar.created_at, ar.updated_at;

ALTER VIEW public.compliance_report_ready OWNER TO postgres;
