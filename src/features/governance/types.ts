/**
 * Governance domain model — TypeScript mirror of the
 * `governance_*` and `framework_controls` Supabase tables introduced
 * in migration `20260512_governance_events.sql`.
 *
 * Used by the runtime dashboard and (later) by browser-extension /
 * SDK / agent-runtime event emitters.
 */

export type RiskLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type PolicyAction =
  | 'allow'
  | 'log'
  | 'warn'
  | 'block'
  | 'require_approval';

export type AssetType =
  | 'website'
  | 'ai_system'
  | 'vendor'
  | 'model'
  | 'agent'
  | 'api'
  | 'dataset'
  | 'repository'
  | 'workflow';

export type AiActClass =
  | 'minimal'
  | 'limited'
  | 'high'
  | 'prohibited'
  | 'unknown';

export type AssetStatus =
  | 'draft'
  | 'active'
  | 'under_review'
  | 'approved'
  | 'archived';

export type PolicyType =
  | 'data_transfer'
  | 'model_usage'
  | 'human_review'
  | 'logging_required'
  | 'vendor_restriction'
  | 'retention'
  | 'security'
  | 'ai_act'
  | 'gdpr';

export type EventSource =
  | 'website_scanner'
  | 'browser_extension'
  | 'sdk'
  | 'api'
  | 'github'
  | 'ci_cd'
  | 'manual'
  | 'agent_runtime';

export type EvidenceType =
  | 'screenshot'
  | 'har'
  | 'json'
  | 'log'
  | 'pdf'
  | 'hash'
  | 'policy_snapshot'
  | 'approval'
  | 'pull_request';

export type Framework =
  | 'GDPR'
  | 'TDDDG'
  | 'EU_AI_ACT'
  | 'ISO_27001'
  | 'SOC_2'
  | 'NIS2'
  | 'DORA'
  | 'CUSTOM';

export type ControlStatus =
  | 'not_started'
  | 'in_progress'
  | 'implemented'
  | 'gap'
  | 'not_applicable';

export interface GovernanceAsset {
  id: string;
  tenant_id: string | null;
  asset_type: AssetType;
  name: string;
  description?: string | null;
  owner_email?: string | null;
  vendor?: string | null;
  system_url?: string | null;
  data_types: string[];
  risk_score: number;
  ai_act_class: AiActClass;
  status: AssetStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GovernancePolicy {
  id: string;
  tenant_id: string | null;
  name: string;
  description?: string | null;
  policy_type: PolicyType;
  severity: RiskLevel;
  action: PolicyAction;
  condition: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GovernanceEvent {
  id: string;
  tenant_id: string | null;
  asset_id: string | null;
  policy_id: string | null;
  event_type: string;
  event_source: EventSource;
  title: string;
  summary?: string | null;
  risk_level: RiskLevel;
  actor_email?: string | null;
  vendor?: string | null;
  model_name?: string | null;
  data_types: string[];
  policy_action?: PolicyAction | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface GovernanceEvidence {
  id: string;
  tenant_id: string | null;
  event_id: string | null;
  asset_id: string | null;
  evidence_type: EvidenceType;
  title: string;
  storage_path?: string | null;
  content_hash?: string | null;
  previous_hash?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FrameworkControl {
  id: string;
  framework: Framework;
  control_code: string;
  title: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AssetControlMapping {
  id: string;
  asset_id: string;
  control_id: string;
  status: ControlStatus;
  evidence_id?: string | null;
  notes?: string | null;
  updated_at: string;
}
