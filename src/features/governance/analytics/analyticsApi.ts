// Governance Analytics API Layer

import { createClient } from '@supabase/supabase-js';
import type {
  DbGovernanceKpiSnapshot,
  TimeseriesRow,
  FilterState,
  DbGovernanceKpiFilter,
  KpiMetrics,
  AnalyticsExportRequest,
  AnalyticsExportResponse,
} from './types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Fetch aggregated KPI data for date range
export async function fetchKpiRange(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<DbGovernanceKpiSnapshot[]> {
  const { data, error } = await supabase.rpc(
    'governance_kpi_range',
    {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) {
    console.error('Error fetching KPI range:', error);
    throw error;
  }

  return (data || []) as DbGovernanceKpiSnapshot[];
}

// Fetch latest KPI snapshot
export async function fetchLatestKpi(tenantId: string): Promise<DbGovernanceKpiSnapshot | null> {
  const { data, error } = await supabase.rpc(
    'governance_kpi_latest_snapshot',
    { p_tenant_id: tenantId }
  );

  if (error) {
    console.error('Error fetching latest KPI:', error);
    return null;
  }

  return (data && data.length > 0 ? data[0] : null) as DbGovernanceKpiSnapshot | null;
}

// Fetch timeseries data with grouping
export async function fetchTimeseriesData(
  tenantId: string,
  startDate: string,
  endDate: string,
  groupBy: 'asset_type' | 'risk_level' | 'event_source'
): Promise<TimeseriesRow[]> {
  const { data, error } = await supabase.rpc(
    'governance_kpi_timeseries_data',
    {
      p_tenant_id: tenantId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_group_by: groupBy,
    }
  );

  if (error) {
    console.error('Error fetching timeseries data:', error);
    throw error;
  }

  return (data || []) as TimeseriesRow[];
}

// Transform snapshot to KpiMetrics display format
export function snapshotToMetrics(snapshot: DbGovernanceKpiSnapshot | null): KpiMetrics | null {
  if (!snapshot) return null;

  const today = new Date().toISOString().split('T')[0];
  const isStale = snapshot.captured_date !== today;

  return {
    assetCount: snapshot.asset_count,
    policyCount: snapshot.policy_count,
    eventCount: snapshot.event_count,
    incidentCount: snapshot.incident_count,
    criticalIncidents: snapshot.critical_incident_count,
    highIncidents: snapshot.high_incident_count,
    mediumIncidents: snapshot.medium_incident_count,
    policyBlocks: snapshot.policy_blocks_count,
    policyWarns: snapshot.policy_warns_count,
    dpiaApproved: snapshot.dpia_approved_count,
    dsrOverdue: snapshot.dsr_overdue_count,
    assetEvidencePercent: snapshot.assets_with_evidence_percent,
    assetMappingsPercent: snapshot.assets_with_mappings_percent,
    policiesEnabledPercent: snapshot.policies_enabled_percent,
    lastUpdated: snapshot.captured_date,
    isStale,
  };
}

// Save filter preferences
export async function saveAnalyticsFilter(
  tenantId: string,
  userId: string,
  filterName: string,
  filters: Partial<FilterState>
): Promise<DbGovernanceKpiFilter> {
  const { data, error } = await supabase
    .from('governance_kpi_filters')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        filter_name: filterName,
        workspace_ids: filters.workspaceIds || [],
        date_range_days: Math.round(
          (new Date(filters.dateRange?.end || new Date().toISOString()).getTime() -
            new Date(filters.dateRange?.start || new Date().toISOString()).getTime()) /
            (1000 * 60 * 60 * 24)
        ) || 30,
        asset_types: filters.assetTypes || [],
        severity_levels: filters.severityLevels || [],
        saved_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,user_id,filter_name' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving filter:', error);
    throw error;
  }

  return data as DbGovernanceKpiFilter;
}

// Load saved filters for user
export async function listAnalyticsFilters(
  tenantId: string,
  userId: string
): Promise<DbGovernanceKpiFilter[]> {
  const { data, error } = await supabase
    .from('governance_kpi_filters')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('Error loading filters:', error);
    return [];
  }

  return (data || []) as DbGovernanceKpiFilter[];
}

// Delete a saved filter
export async function deleteAnalyticsFilter(filterId: string): Promise<void> {
  const { error } = await supabase
    .from('governance_kpi_filters')
    .delete()
    .eq('id', filterId);

  if (error) {
    console.error('Error deleting filter:', error);
    throw error;
  }
}

// Trigger export via Edge Function
export async function exportKpiData(
  request: AnalyticsExportRequest
): Promise<AnalyticsExportResponse> {
  const response = await supabase.functions.invoke('governance-analytics-export', {
    body: {
      format: request.format,
      tenant_id: request.tenantId,
      date_range: request.dateRange,
      include_charts: request.includeCharts ?? false,
    },
  });

  if (response.error) {
    console.error('Error exporting data:', response.error);
    throw response.error;
  }

  return response.data as AnalyticsExportResponse;
}

// Note: Audit logging for analytics queries can be added via ai_tool_runs
// table when needed. For now, we skip explicit logging to keep the feature simple.

// Calculate trend (percent change between two periods)
export function calculateTrend(
  current: number,
  previous: number
): { change: number; percent: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return {
      change: current,
      percent: current > 0 ? 100 : 0,
      direction: current > 0 ? 'up' : 'flat',
    };
  }

  const change = current - previous;
  const percent = Math.round((change / previous) * 100);
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  return { change, percent, direction };
}
