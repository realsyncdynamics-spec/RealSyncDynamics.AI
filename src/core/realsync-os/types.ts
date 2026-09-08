import type { DesignInputMode, DesignProject } from './design/types';
import type { SiteOsBlueprintDocument } from './adapters/siteos/designToBlueprint';

export type OsStage = 'intent' | 'policy' | 'plan' | 'execute' | 'observe' | 'verify' | 'evidence';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalMode = 'never' | 'on-risk' | 'always';

export const OS_CAPABILITIES = [
  'Website',
  'Design',
  'Code',
  'SEO',
  'Governance',
  'Deployment',
] as const;

export type OsCapability = (typeof OS_CAPABILITIES)[number];

export type ToolPermission = {
  resource: string;
  actions: string[];
  approval: ApprovalMode;
};

export type AgentPolicy = {
  agentId: string;
  version: string;
  permissions: ToolPermission[];
  deniedResources: string[];
  restrictedDataClasses: string[];
  requireProvenanceForGeneratedContent: boolean;
  requireEvidence: boolean;
};

export type Intent = {
  id: string;
  text: string;
  tenantId: string;
  projectId?: string;
  actorId: string;
  createdAt: string;
};

export type PlanStep = {
  id: string;
  title: string;
  agent: string;
  action: string;
  risk: RiskLevel;
  requiresApproval: boolean;
  dependsOn: string[];
};

export type ExecutionPlan = {
  id: string;
  intentId: string;
  steps: PlanStep[];
  risk: RiskLevel;
  requiresApproval: boolean;
  capabilities: OsCapability[];
  generatedAt: string;
};

export type OsEvent = {
  id: string;
  tenantId: string;
  projectId?: string;
  intentId?: string;
  stage: OsStage;
  actorId: string;
  agentId?: string;
  tool?: string;
  action: string;
  result: 'started' | 'succeeded' | 'blocked' | 'failed';
  policyVersion?: string;
  metadata?: Record<string, unknown>;
  occurredAt: string;
};

export type SessionArtifacts = {
  blueprintId?: string;
  slug?: string;
  contentSha256?: string;
  siteUrl?: string;
  scanId?: string;
  agentRunId?: string;
  sites?: Array<{ slug: string; name: string; status: string }>;
  designProject?: DesignProject;
  designInputMode?: DesignInputMode;
  siteosBlueprint?: SiteOsBlueprintDocument;
};

export type StepResultStatus = 'succeeded' | 'failed' | 'blocked' | 'not_implemented';

export type StepResult = {
  status: StepResultStatus;
  reason?: string;
  tool?: string;
  observation?: Record<string, unknown>;
  artifacts?: Partial<SessionArtifacts>;
};

export type CommandCenterPhase =
  | 'received'
  | 'planned'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed';

export type StepExecutionState = {
  stepId: string;
  status: 'pending' | 'ready' | 'running' | 'awaiting_approval' | 'blocked' | 'succeeded' | 'failed';
  policyReason?: string;
  tool?: string;
  notImplemented?: boolean;
  observation?: Record<string, unknown>;
};

export type CommandSession = {
  id: string;
  intent: Intent;
  plan: ExecutionPlan;
  phase: CommandCenterPhase;
  approved: boolean;
  steps: StepExecutionState[];
  events: OsEvent[];
  policyVersion: string;
  artifacts: SessionArtifacts;
};
