-- Governance Analytics Schema
-- Pre-aggregated KPI snapshots for fast dashboard loads
-- Multi-tenant with RLS enforcement

-- Create governance_kpi_snapshots table
-- Stores daily aggregated KPI metrics per tenant
CREATE TABLE IF NOT EXISTS public.governance_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Bucketed to UTC midnight for deterministic ordering
  captured_date DATE NOT NULL,

  -- Asset metrics
  asset_count INT NOT NULL DEFAULT 0,

  -- Policy metrics
  policy_count INT NOT NULL DEFAULT 0,

  -- Event metrics
  event_count INT NOT NULL DEFAULT 0,

  -- Incident metrics
  incident_count INT NOT NULL DEFAULT 0,
  critical_incident_count INT NOT NULL DEFAULT 0,
  high_incident_count INT NOT NULL DEFAULT 0,
  medium_incident_count INT NOT NULL DEFAULT 0,

  -- Policy enforcement
  policy_blocks_count INT NOT NULL DEFAULT 0,
  policy_warns_count INT NOT NULL DEFAULT 0,
  policy_approvals_required_count INT NOT NULL DEFAULT 0,

  -- Compliance status
  dpia_draft_count INT NOT NULL DEFAULT 0,
  dpia_approved_count INT NOT NULL DEFAULT 0,
  dsr_overdue_count INT NOT NULL DEFAULT 0,

  -- Coverage metrics (0-100)
  assets_with_evidence_percent INT NOT NULL DEFAULT 0,
  assets_with_mappings_percent INT NOT NULL DEFAULT 0,
  policies_enabled_percent INT NOT NULL DEFAULT 0,

  -- Extensibility
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one snapshot per tenant per day
  UNIQUE(tenant_id, captured_date)
);

-- Create governance_kpi_timeseries table
-- Detailed breakdown by asset type / risk level / event source
CREATE TABLE IF NOT EXISTS public.governance_kpi_timeseries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Breakdown dimension
  asset_type TEXT,
  risk_level TEXT,
  event_source TEXT,

  -- Metric value
  count INT NOT NULL DEFAULT 0,
  avg_risk_score INT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create governance_kpi_filters table
-- User-saved filter preferences for analytics dashboard
CREATE TABLE IF NOT EXISTS public.governance_kpi_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Filter metadata
  filter_name TEXT NOT NULL,
  workspace_ids UUID[] DEFAULT '{}',
  date_range_days INT DEFAULT 30,
  asset_types TEXT[] DEFAULT '{}',
  severity_levels TEXT[] DEFAULT '{}',

  -- Audit
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, user_id, filter_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_governance_kpi_snapshots_tenant_date
  ON public.governance_kpi_snapshots(tenant_id, captured_date DESC);

CREATE INDEX IF NOT EXISTS idx_governance_kpi_snapshots_tenant_metric
  ON public.governance_kpi_snapshots(tenant_id)
  WHERE asset_count > 0;

CREATE INDEX IF NOT EXISTS idx_governance_kpi_timeseries_tenant_date
  ON public.governance_kpi_timeseries(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_governance_kpi_timeseries_dimension
  ON public.governance_kpi_timeseries(tenant_id, asset_type, risk_level);

CREATE INDEX IF NOT EXISTS idx_governance_kpi_filters_user
  ON public.governance_kpi_filters(tenant_id, user_id);

-- Enable RLS
ALTER TABLE public.governance_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_kpi_timeseries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_kpi_filters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: service_role can do everything (for cron aggregator)
CREATE POLICY "service_role_all_snapshots"
  ON public.governance_kpi_snapshots
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_timeseries"
  ON public.governance_kpi_timeseries
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policy: authenticated users can SELECT only their tenant's snapshots
CREATE POLICY "users_select_own_tenant_snapshots"
  ON public.governance_kpi_snapshots
  FOR SELECT
  USING ((SELECT public.is_tenant_member(tenant_id)));

CREATE POLICY "users_select_own_tenant_timeseries"
  ON public.governance_kpi_timeseries
  FOR SELECT
  USING ((SELECT public.is_tenant_member(tenant_id)));

-- RLS Policy: users can manage only their own filters
CREATE POLICY "users_own_filters_all"
  ON public.governance_kpi_filters
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_select_own_filters"
  ON public.governance_kpi_filters
  FOR SELECT
  USING ((SELECT public.is_tenant_member(tenant_id)) AND user_id = auth.uid());

-- Create RPC: get latest KPI snapshot for tenant
CREATE OR REPLACE FUNCTION public.governance_kpi_latest_snapshot(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  captured_date DATE,
  asset_count INT,
  policy_count INT,
  event_count INT,
  incident_count INT,
  critical_incident_count INT,
  high_incident_count INT,
  medium_incident_count INT,
  policy_blocks_count INT,
  policy_warns_count INT,
  policy_approvals_required_count INT,
  dpia_draft_count INT,
  dpia_approved_count INT,
  dsr_overdue_count INT,
  assets_with_evidence_percent INT,
  assets_with_mappings_percent INT,
  policies_enabled_percent INT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    id, tenant_id, captured_date,
    asset_count, policy_count, event_count, incident_count,
    critical_incident_count, high_incident_count, medium_incident_count,
    policy_blocks_count, policy_warns_count, policy_approvals_required_count,
    dpia_draft_count, dpia_approved_count, dsr_overdue_count,
    assets_with_evidence_percent, assets_with_mappings_percent, policies_enabled_percent,
    metadata, created_at, updated_at
  FROM public.governance_kpi_snapshots
  WHERE tenant_id = p_tenant_id
  ORDER BY captured_date DESC
  LIMIT 1;
$$;

-- Create RPC: get KPI data for date range
CREATE OR REPLACE FUNCTION public.governance_kpi_range(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  captured_date DATE,
  asset_count INT,
  policy_count INT,
  event_count INT,
  incident_count INT,
  critical_incident_count INT,
  high_incident_count INT,
  medium_incident_count INT,
  policy_blocks_count INT,
  policy_warns_count INT,
  policy_approvals_required_count INT,
  dpia_draft_count INT,
  dpia_approved_count INT,
  dsr_overdue_count INT,
  assets_with_evidence_percent INT,
  assets_with_mappings_percent INT,
  policies_enabled_percent INT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    id, tenant_id, captured_date,
    asset_count, policy_count, event_count, incident_count,
    critical_incident_count, high_incident_count, medium_incident_count,
    policy_blocks_count, policy_warns_count, policy_approvals_required_count,
    dpia_draft_count, dpia_approved_count, dsr_overdue_count,
    assets_with_evidence_percent, assets_with_mappings_percent, policies_enabled_percent,
    metadata, created_at, updated_at
  FROM public.governance_kpi_snapshots
  WHERE tenant_id = p_tenant_id
    AND captured_date >= p_start_date
    AND captured_date <= p_end_date
  ORDER BY captured_date DESC;
$$;

-- Create RPC: get timeseries data with optional filtering
CREATE OR REPLACE FUNCTION public.governance_kpi_timeseries_data(
  p_tenant_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_group_by TEXT DEFAULT 'asset_type'
)
RETURNS TABLE (
  date DATE,
  dimension TEXT,
  count INT,
  avg_risk_score INT
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    date,
    COALESCE(
      CASE p_group_by
        WHEN 'asset_type' THEN asset_type
        WHEN 'risk_level' THEN risk_level
        WHEN 'event_source' THEN event_source
        ELSE 'unknown'
      END,
      'unknown'
    ) as dimension,
    count,
    avg_risk_score
  FROM public.governance_kpi_timeseries
  WHERE tenant_id = p_tenant_id
    AND date >= p_start_date
    AND date <= p_end_date
  ORDER BY date DESC, count DESC;
$$;

-- Create audit function to log analytics queries
CREATE OR REPLACE FUNCTION public.log_governance_analytics_query(
  p_tenant_id UUID,
  p_date_range_days INT,
  p_row_count INT,
  p_duration_ms INT
) RETURNS TABLE (
  id UUID,
  action TEXT
) LANGUAGE SQL SECURITY DEFINER AS $$
  WITH inserted AS (
    INSERT INTO public.ai_tool_runs (
      tenant_id,
      action,
      tool_name,
      asset_id,
      policy_id,
      status,
      metadata,
      created_at
    ) VALUES (
      p_tenant_id,
      'analytics_query',
      'governance-analytics',
      NULL,
      NULL,
      'success',
      jsonb_build_object(
        'dateRangeDays', p_date_range_days,
        'rowCount', p_row_count,
        'durationMs', p_duration_ms
      ),
      NOW()
    )
    RETURNING public.ai_tool_runs.id, public.ai_tool_runs.action
  )
  SELECT id, action FROM inserted;
$$;

-- Grant permissions to authenticated users for RPC functions
GRANT EXECUTE ON FUNCTION public.governance_kpi_latest_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_kpi_range(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.governance_kpi_timeseries_data(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_governance_analytics_query(UUID, INT, INT, INT) TO authenticated;
