// RealSyncDynamics SDK Types

export interface TenantConfig {
  id: string;
  name: string;
  custom_domain?: string;
  brand_colors?: Record<string, string>;
}

export interface ComplianceScore {
  score_overall: number;
  score_gdpr?: number;
  score_nis2?: number;
  score_dsa?: number;
  score_ai_act?: number;
  trend_direction?: 'improving' | 'stable' | 'declining';
  recorded_at: string;
}

export interface RiskMetrics {
  critical_risks_count: number;
  high_risks_count: number;
  medium_risks_count: number;
  low_risks_count: number;
  open_incidents_count: number;
  overdue_remediations: number;
}

export interface DashboardInsight {
  id: string;
  insight_type: string;
  title: string;
  description?: string;
  severity: 'info' | 'warning' | 'critical';
  recommended_action?: string;
  status: 'active' | 'dismissed' | 'actioned' | 'resolved';
  created_at: string;
}

export interface DashboardKPI {
  domains_active: number;
  policies_documented: number;
  dpia_assessments_completed: number;
  vendors_managed: number;
  avg_incident_response_hours?: number;
  evidence_collection_completeness?: number;
  audit_coverage_percent?: number;
  estimated_compliance_spend_monthly?: number;
  days_since_last_audit?: number;
  days_until_next_audit?: number;
}

export interface DashboardSummary {
  compliance_score: ComplianceScore | null;
  risks: RiskMetrics | null;
  insights: DashboardInsight[];
  kpis: DashboardKPI | null;
}

export interface WebhookEvent {
  id: string;
  tenant_id: string;
  event_key: string;
  event_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface ComplianceAlertRule {
  id: string;
  rule_name: string;
  trigger_event: string;
  severity_threshold?: string;
  enabled: boolean;
  actions: Record<string, unknown>[];
}

export interface RemediationTask {
  id: string;
  alert_id: string;
  task_type: string;
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  executed_at?: string;
  error_message?: string;
}

export interface C2PAManifest {
  version: string;
  claim_generator: string;
  assertions: Record<string, unknown>[];
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
