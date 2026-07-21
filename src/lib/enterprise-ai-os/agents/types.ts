import type { AiRiskLevel } from '../types';

export type AgentId =
  | 'ai-discovery-agent'
  | 'risk-classification-agent'
  | 'policy-enforcement-agent'
  | 'audit-agent'
  | 'feedback-intelligence-agent'
  | 'remediation-agent'
  | 'workflow-agent'
  | 'infrastructure-agent';

export type AgentLayer =
  | 'discovery'
  | 'governance'
  | 'policy'
  | 'audit'
  | 'intelligence'
  | 'remediation'
  | 'orchestration'
  | 'infrastructure';

export type AgentAutonomyLevel =
  | 'observe_only'
  | 'recommend_only'
  | 'human_approval_required'
  | 'limited_execution';

export type AgentStatus =
  | 'active'
  | 'inactive'
  | 'experimental'
  | 'requires_configuration';

export interface AgentPosition {
  layer: AgentLayer;
  order: number;
  upstream: AgentId[];
  downstream: AgentId[];
  systemBoundary: string;
}

export interface AgentCapability {
  id: string;
  label: string;
  description: string;
  riskLevel: AiRiskLevel;
  requiresHumanApproval: boolean;
}

export interface EnterpriseAgentDefinition {
  id: AgentId;
  name: string;
  shortName: string;
  description: string;
  position: AgentPosition;
  autonomyLevel: AgentAutonomyLevel;
  status: AgentStatus;
  capabilities: AgentCapability[];
  inputs: string[];
  outputs: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  complianceScope: string[];
  auditRequired: boolean;
  humanApprovalRequired: boolean;
}

export interface AgentRunInput {
  agentId: AgentId;
  tenantId?: string;
  actor?: string;
  payload: Record<string, unknown>;
}

export type AgentRunStatus = 'success' | 'blocked' | 'requires_approval' | 'error';

export interface AgentFinding {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  riskLevel: AiRiskLevel;
  evidence?: Record<string, unknown>;
}

export interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiresHumanApproval: boolean;
}

export interface AgentAuditEvent {
  actor: string;
  action: string;
  systemName?: string;
  riskLevel: AiRiskLevel;
  metadata: Record<string, unknown>;
}

export interface AgentRunResult {
  agentId: AgentId;
  status: AgentRunStatus;
  summary: string;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  auditEvents: AgentAuditEvent[];
  metadata: Record<string, unknown>;
}

export interface EnterpriseAgent {
  definition: EnterpriseAgentDefinition;
  run(input: AgentRunInput): AgentRunResult;
}
