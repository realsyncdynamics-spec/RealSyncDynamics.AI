/**
 * Governance domain model — TypeScript mirror of the
 * `governance_*` and `framework_controls` Supabase tables introduced
 * in migration `20260512_governance_events.sql`.
 *
 * Field names are camelCase on the TS side; the data-layer / Edge
 * Function will be responsible for translating to/from the snake_case
 * Postgres columns (asset_type ↔ assetType, …).
 *
 * Used by the runtime dashboard and (later) by browser-extension /
 * SDK / agent-runtime event emitters.
 */

export type GovernanceAssetType =
  | "website"
  | "ai_system"
  | "vendor"
  | "model"
  | "agent"
  | "api"
  | "dataset"
  | "repository"
  | "workflow";

export type GovernanceRiskLevel =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type GovernanceEventSource =
  | "website_scanner"
  | "browser_extension"
  | "sdk"
  | "api"
  | "github"
  | "ci_cd"
  | "manual"
  | "agent_runtime";

export type GovernancePolicyAction =
  | "allow"
  | "log"
  | "warn"
  | "block"
  | "require_approval";

export type GovernancePolicyType =
  | "data_transfer"
  | "model_usage"
  | "human_review"
  | "logging_required"
  | "vendor_restriction"
  | "retention"
  | "security"
  | "ai_act"
  | "gdpr";

export type GovernanceEvidenceType =
  | "screenshot"
  | "har"
  | "json"
  | "log"
  | "pdf"
  | "hash"
  | "policy_snapshot"
  | "approval"
  | "pull_request";

export type GovernanceFramework =
  | "GDPR"
  | "TDDDG"
  | "EU_AI_ACT"
  | "ISO_27001"
  | "SOC_2"
  | "NIS2"
  | "DORA"
  | "CUSTOM";

export type GovernanceAssetStatus =
  | "draft"
  | "active"
  | "under_review"
  | "approved"
  | "archived";

export type GovernanceControlStatus =
  | "not_started"
  | "in_progress"
  | "implemented"
  | "gap"
  | "not_applicable";

export type AiActClass =
  | "minimal"
  | "limited"
  | "high"
  | "prohibited"
  | "unknown";

export interface GovernanceAsset {
  id: string;
  assetType: GovernanceAssetType;
  name: string;
  description?: string;
  ownerEmail?: string;
  vendor?: string;
  systemUrl?: string;
  dataTypes: string[];
  riskScore: number;
  aiActClass: AiActClass;
  status: GovernanceAssetStatus;
  metadata: Record<string, unknown>;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description?: string;
  policyType: GovernancePolicyType;
  severity: GovernanceRiskLevel;
  action: GovernancePolicyAction;
  condition: Record<string, unknown>;
  enabled: boolean;
}

export interface GovernanceEvent {
  id: string;
  assetId?: string;
  policyId?: string;
  eventType: string;
  eventSource: GovernanceEventSource;
  title: string;
  summary?: string;
  riskLevel: GovernanceRiskLevel;
  actorEmail?: string;
  vendor?: string;
  modelName?: string;
  dataTypes: string[];
  policyAction?: GovernancePolicyAction;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GovernanceEvidence {
  id: string;
  eventId?: string;
  assetId?: string;
  evidenceType: GovernanceEvidenceType;
  title: string;
  storagePath?: string;
  contentHash?: string;
  previousHash?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FrameworkControl {
  id: string;
  framework: GovernanceFramework;
  controlCode: string;
  title: string;
  description?: string;
}

export interface AssetControlMapping {
  id: string;
  assetId: string;
  controlId: string;
  status: GovernanceControlStatus;
  evidenceId?: string;
  notes?: string;
}

export interface AssetRiskHistory {
  id: string;
  assetId: string;
  tenantId: string | null;
  riskScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  reason: string | null;
  contributingEvents: string[];
  calculatedAt: string;
}
