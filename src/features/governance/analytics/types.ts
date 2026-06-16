// Governance Analytics Types

export interface DbGovernanceKpiSnapshot {
  id: string;
  tenant_id: string;
  captured_date: string; // YYYY-MM-DD
  asset_count: number;
  policy_count: number;
  event_count: number;
  incident_count: number;
  critical_incident_count: number;
  high_incident_count: number;
  medium_incident_count: number;
  policy_blocks_count: number;
  policy_warns_count: number;
  policy_approvals_required_count: number;
  dpia_draft_count: number;
  dpia_approved_count: number;
  dsr_overdue_count: number;
  assets_with_evidence_percent: number;
  assets_with_mappings_percent: number;
  policies_enabled_percent: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TimeseriesRow {
  date: string; // YYYY-MM-DD
  dimension?: string; // asset_type, risk_level, or event_source
  count: number;
  avg_risk_score?: number;
}

export interface FilterState {
  dateRange: { start: string; end: string };
  workspaceIds: string[];
  assetTypes: string[];
  severityLevels: string[];
}

export interface DbGovernanceKpiFilter {
  id: string;
  tenant_id: string;
  user_id: string;
  filter_name: string;
  workspace_ids: string[];
  date_range_days: number;
  asset_types: string[];
  severity_levels: string[];
  saved_at: string;
  updated_at: string;
}

export interface KpiMetrics {
  assetCount: number;
  policyCount: number;
  eventCount: number;
  incidentCount: number;
  criticalIncidents: number;
  highIncidents: number;
  mediumIncidents: number;
  policyBlocks: number;
  policyWarns: number;
  dpiaApproved: number;
  dsrOverdue: number;
  assetEvidencePercent: number;
  assetMappingsPercent: number;
  policiesEnabledPercent: number;
  lastUpdated: string;
  isStale: boolean; // true if > 24h old
}

export interface AnalyticsExportRequest {
  format: 'csv' | 'pdf';
  tenantId: string;
  dateRange: { start: string; end: string };
  includeCharts?: boolean;
}

export interface AnalyticsExportResponse {
  url: string;
  filename: string;
  size: number;
}

export const ASSET_TYPES = [
  'website',
  'ai_system',
  'vendor',
  'api',
  'workflow',
  'database',
  'integration',
];

export const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'];

export const DATE_RANGE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];
