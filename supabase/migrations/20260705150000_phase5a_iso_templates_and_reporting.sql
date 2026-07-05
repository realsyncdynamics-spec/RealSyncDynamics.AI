-- Phase 5A: ISO Control Templates & Advanced Reporting
-- Migration: Add support for ISO control definitions and compliance reporting

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- Table: iso_control_definitions
-- Single source of truth for ISO 27001 and ISO 42001 controls
CREATE TABLE IF NOT EXISTS public.iso_control_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id TEXT NOT NULL UNIQUE, -- e.g., "iso27001_a5_1_1"
  framework TEXT NOT NULL, -- 'iso27001' or 'iso42001'
  clause TEXT NOT NULL, -- e.g., "A.5.1" or "4.1"
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objective TEXT,
  applicability TEXT,
  guidance TEXT,
  estimated_effort TEXT NOT NULL, -- 'low', 'medium', 'high'
  maturity_levels JSONB NOT NULL, -- Array of maturity criteria
  recommended_evidence TEXT[] NOT NULL DEFAULT '{}',
  related_controls TEXT[] NOT NULL DEFAULT '{}',
  cross_framework_mappings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT iso_control_framework_check CHECK (framework IN ('iso27001', 'iso42001')),
  CONSTRAINT iso_control_effort_check CHECK (estimated_effort IN ('low', 'medium', 'high'))
);

-- Index for framework queries
CREATE INDEX idx_iso_control_definitions_framework ON public.iso_control_definitions(framework);
CREATE INDEX idx_iso_control_definitions_clause ON public.iso_control_definitions(clause);
CREATE INDEX idx_iso_control_definitions_search ON public.iso_control_definitions USING GIN(to_tsvector('english', title || ' ' || description));

-- Table: iso_control_mapping
-- Maps controls across frameworks (ISO 27001 -> AI Act, etc.)
CREATE TABLE IF NOT EXISTS public.iso_control_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_control_id TEXT NOT NULL REFERENCES public.iso_control_definitions(control_id) ON DELETE CASCADE,
  target_framework TEXT NOT NULL, -- 'ai_act', 'dsgvo', 'nis2'
  target_references TEXT[] NOT NULL, -- Array of mapped references
  mapping_strength TEXT NOT NULL DEFAULT 'direct', -- 'direct', 'indirect', 'supporting'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT iso_control_mapping_framework_check CHECK (target_framework IN ('ai_act', 'dsgvo', 'nis2')),
  CONSTRAINT iso_control_mapping_strength_check CHECK (mapping_strength IN ('direct', 'indirect', 'supporting'))
);

CREATE INDEX idx_iso_control_mappings_source ON public.iso_control_mappings(source_control_id);
CREATE INDEX idx_iso_control_mappings_target ON public.iso_control_mappings(target_framework);

-- Table: compliance_reports
-- Stores generated compliance reports (PDF/Excel exports)
CREATE TABLE IF NOT EXISTS public.compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frameworks_covered TEXT[] NOT NULL, -- ['iso27001', 'dsgvo', ...]
  format TEXT NOT NULL, -- 'pdf', 'excel', 'both'
  pdf_url TEXT,
  excel_url TEXT,
  branding_type TEXT NOT NULL DEFAULT 'standard', -- 'minimal', 'standard', 'custom'
  sections_included JSONB DEFAULT '{"summary": true, "control_details": true, "findings": true, "roadmap": false}'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  file_size_mb NUMERIC,
  created_by UUID,
  is_scheduled BOOLEAN DEFAULT FALSE,
  retention_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT compliance_reports_format_check CHECK (format IN ('pdf', 'excel', 'both')),
  CONSTRAINT compliance_reports_branding_check CHECK (branding_type IN ('minimal', 'standard', 'custom')),
  CONSTRAINT compliance_reports_tenant_consistency CHECK (tenant_id IS NOT NULL)
);

-- Indexes for efficient querying
CREATE INDEX idx_compliance_reports_tenant ON public.compliance_reports(tenant_id);
CREATE INDEX idx_compliance_reports_generated_at ON public.compliance_reports(generated_at DESC);
CREATE INDEX idx_compliance_reports_frameworks ON public.compliance_reports USING GIN(frameworks_covered);

-- Table: report_schedules
-- For recurring report generation (daily, weekly, monthly, quarterly)
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frameworks_covered TEXT[] NOT NULL,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
  day_of_week INTEGER, -- 0-6 (Sunday-Saturday) for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  recipients TEXT[] NOT NULL DEFAULT '{}', -- Email addresses
  format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel', 'both'
  branding_type TEXT NOT NULL DEFAULT 'standard',
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT report_schedules_frequency_check CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  CONSTRAINT report_schedules_format_check CHECK (format IN ('pdf', 'excel', 'both'))
);

CREATE INDEX idx_report_schedules_tenant ON public.report_schedules(tenant_id);
CREATE INDEX idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE is_active = TRUE;

-- Table: compliance_metrics_snapshots
-- Daily snapshots of compliance scores for trending and forecasting
CREATE TABLE IF NOT EXISTS public.compliance_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  framework TEXT NOT NULL, -- 'iso27001', 'iso42001', 'dsgvo', 'ai_act', 'nis2', 'overall'
  compliance_score NUMERIC(5,2) NOT NULL, -- 0-100
  controls_total INTEGER NOT NULL DEFAULT 0,
  controls_implemented INTEGER NOT NULL DEFAULT 0,
  controls_partially_implemented INTEGER NOT NULL DEFAULT 0,
  gaps_open INTEGER NOT NULL DEFAULT 0,
  gaps_closed INTEGER NOT NULL DEFAULT 0,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  avg_maturity_level NUMERIC(3,2), -- 0-5
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT compliance_metrics_snapshot_framework_check CHECK (framework IN ('iso27001', 'iso42001', 'dsgvo', 'ai_act', 'nis2', 'overall')),
  UNIQUE(tenant_id, snapshot_date, framework)
);

CREATE INDEX idx_compliance_metrics_snapshots_tenant_date ON public.compliance_metrics_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_compliance_metrics_snapshots_framework ON public.compliance_metrics_snapshots(framework);

-- Table: control_maturity_tracking
-- Tracks individual control maturity progression over time
CREATE TABLE IF NOT EXISTS public.control_maturity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  control_id TEXT NOT NULL,
  current_maturity_level INTEGER NOT NULL DEFAULT 0, -- 0-5
  previous_maturity_level INTEGER DEFAULT 0,
  maturity_changed_at TIMESTAMP WITH TIME ZONE,
  implementation_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  owner_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT control_maturity_level_check CHECK (current_maturity_level >= 0 AND current_maturity_level <= 5),
  CONSTRAINT control_maturity_previous_check CHECK (previous_maturity_level >= 0 AND previous_maturity_level <= 5)
);

CREATE INDEX idx_control_maturity_tracking_tenant ON public.control_maturity_tracking(tenant_id);
CREATE INDEX idx_control_maturity_tracking_control ON public.control_maturity_tracking(control_id);
CREATE INDEX idx_control_maturity_tracking_date ON public.control_maturity_tracking(maturity_changed_at DESC);

-- Enable RLS for all new tables
ALTER TABLE public.iso_control_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iso_control_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_maturity_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policy: iso_control_definitions (public read, system write)
CREATE POLICY iso_control_definitions_read_all ON public.iso_control_definitions
  FOR SELECT USING (TRUE); -- Public lookup reference data

CREATE POLICY iso_control_definitions_write_system ON public.iso_control_definitions
  FOR INSERT WITH CHECK (FALSE); -- Only system/migrations can insert

-- RLS Policy: iso_control_mappings (public read, system write)
CREATE POLICY iso_control_mappings_read_all ON public.iso_control_mappings
  FOR SELECT USING (TRUE);

-- RLS Policy: compliance_reports (tenant isolation)
CREATE POLICY compliance_reports_select_tenant ON public.compliance_reports
  FOR SELECT USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY compliance_reports_insert_tenant ON public.compliance_reports
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id)
  );

-- RLS Policy: report_schedules (tenant isolation)
CREATE POLICY report_schedules_select_tenant ON public.report_schedules
  FOR SELECT USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY report_schedules_insert_tenant ON public.report_schedules
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id)
  );

-- RLS Policy: compliance_metrics_snapshots (tenant isolation)
CREATE POLICY compliance_metrics_snapshots_select_tenant ON public.compliance_metrics_snapshots
  FOR SELECT USING (
    public.is_tenant_member(tenant_id)
  );

-- RLS Policy: control_maturity_tracking (tenant isolation)
CREATE POLICY control_maturity_tracking_select_tenant ON public.control_maturity_tracking
  FOR SELECT USING (
    public.is_tenant_member(tenant_id)
  );

CREATE POLICY control_maturity_tracking_insert_tenant ON public.control_maturity_tracking
  FOR INSERT WITH CHECK (
    public.is_tenant_member(tenant_id)
  );

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_iso_control_definitions_updated_at ON public.iso_control_definitions;
CREATE TRIGGER update_iso_control_definitions_updated_at
  BEFORE UPDATE ON public.iso_control_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_compliance_reports_updated_at ON public.compliance_reports;
CREATE TRIGGER update_compliance_reports_updated_at
  BEFORE UPDATE ON public.compliance_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_schedules_updated_at ON public.report_schedules;
CREATE TRIGGER update_report_schedules_updated_at
  BEFORE UPDATE ON public.report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_control_maturity_tracking_updated_at ON public.control_maturity_tracking;
CREATE TRIGGER update_control_maturity_tracking_updated_at
  BEFORE UPDATE ON public.control_maturity_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.iso_control_definitions TO authenticated;
GRANT SELECT ON public.iso_control_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.compliance_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.report_schedules TO authenticated;
GRANT SELECT, INSERT ON public.compliance_metrics_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.control_maturity_tracking TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.iso_control_definitions IS 'Single source of truth for ISO 27001 and ISO 42001 control definitions with maturity progressions';
COMMENT ON TABLE public.compliance_reports IS 'Generated PDF/Excel compliance reports for audit and stakeholder communication';
COMMENT ON TABLE public.report_schedules IS 'Automated recurring report generation schedules';
COMMENT ON TABLE public.compliance_metrics_snapshots IS 'Daily compliance score snapshots for trending and forecasting';
COMMENT ON TABLE public.control_maturity_tracking IS 'Tracks individual control maturity progression and implementation status';
