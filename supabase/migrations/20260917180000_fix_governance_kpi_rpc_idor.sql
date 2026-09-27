-- loadCockpitData IDOR, DEFINER bypasses snapshot RLS.

BEGIN;

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
) LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
    AND (public.is_tenant_member(p_tenant_id) OR auth.role() = 'service_role')
  ORDER BY captured_date DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.governance_kpi_latest_snapshot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.governance_kpi_latest_snapshot(UUID) TO authenticated, service_role;

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
) LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
    AND (public.is_tenant_member(p_tenant_id) OR auth.role() = 'service_role')
  ORDER BY captured_date DESC;
$$;

REVOKE ALL ON FUNCTION public.governance_kpi_range(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.governance_kpi_range(UUID, DATE, DATE) TO authenticated, service_role;

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
) LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
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
    ) AS dimension,
    count,
    avg_risk_score
  FROM public.governance_kpi_timeseries
  WHERE tenant_id = p_tenant_id
    AND date >= p_start_date
    AND date <= p_end_date
    AND (public.is_tenant_member(p_tenant_id) OR auth.role() = 'service_role')
  ORDER BY date DESC, count DESC;
$$;

REVOKE ALL ON FUNCTION public.governance_kpi_timeseries_data(UUID, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.governance_kpi_timeseries_data(UUID, DATE, DATE, TEXT) TO authenticated, service_role;

COMMIT;
