export type ConnectorType =
  | 'microsoft365'
  | 'slack'
  | 'salesforce'
  | 'hubspot'
  | 'sap'
  | 'jira'
  | 'custom_api';

export type ConnectorStatus = 'connected' | 'pending' | 'error' | 'disabled';

export type AiRiskLevel = 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';

export type FounderAccessStatus = 'active' | 'expired' | 'revoked' | 'converted';

export type FeedbackType =
  | 'bug'
  | 'improvement'
  | 'feature_request'
  | 'security_issue'
  | 'ux_feedback';

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FeedbackStatus = 'open' | 'reviewed' | 'planned' | 'fixed' | 'rejected';

export interface EnterpriseFounderAccess {
  id: string;
  tenant_id?: string | null;
  company_name: string;
  contact_email: string;
  website_url?: string | null;
  access_status: FounderAccessStatus;
  access_started_at: string;
  access_expires_at: string;
  feedback_required: boolean;
  max_free_until: string;
  created_at: string;
}

export interface EnterpriseConnector {
  id: string;
  tenant_id?: string | null;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiSystemRegistryEntry {
  id: string;
  tenant_id?: string | null;
  name: string;
  provider: string;
  model?: string | null;
  usage_context?: string | null;
  risk_level: AiRiskLevel;
  contains_personal_data: boolean;
  contains_sensitive_data: boolean;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentPolicy {
  id: string;
  tenant_id?: string | null;
  name: string;
  description?: string | null;
  allowed_models: string[];
  forbidden_data_categories: string[];
  requires_human_approval: boolean;
  external_actions_allowed: boolean;
  policy_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiAuditEvent {
  id: string;
  tenant_id?: string | null;
  actor: string;
  action: string;
  system_name?: string | null;
  risk_level?: AiRiskLevel | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FeedbackReport {
  id: string;
  tenant_id?: string | null;
  founder_access_id?: string | null;
  company_name?: string | null;
  contact_email?: string | null;
  type: FeedbackType;
  severity: FeedbackSeverity;
  title: string;
  description: string;
  screenshot_url?: string | null;
  module?: string | null;
  status: FeedbackStatus;
  created_at: string;
}
