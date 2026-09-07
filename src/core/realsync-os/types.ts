export type OsStage = 'intent' | 'policy' | 'plan' | 'execute' | 'observe' | 'verify' | 'evidence';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalMode = 'never' | 'on-risk' | 'always';

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
