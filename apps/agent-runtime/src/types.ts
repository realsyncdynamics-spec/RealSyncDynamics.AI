/**
 * Geteilte Typen für den Agent-Runtime-Gateway.
 *
 * Alle exportierten Schnittstellen sind die einzige API-Quelle
 * der Wahrheit zwischen Gateway, Registry, Policy-Engine und Audit-Log.
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export type RestrictedAction =
  | 'legal_surface_change'
  | 'production_change'
  | 'github_pr_create'
  | 'policy_export'
  | 'high_risk_ai_classification';

export interface Agent {
  id: string;
  name: string;
  type: string;
  tools: string[];
  riskLevel: RiskLevel;
  permissions: string[];
  restricted: RestrictedAction[];
  requiresHumanReview: boolean;
}

export interface RunAgentRequest {
  tenantId: string;
  agentId: string;
  taskType: string;
  requestedTool: string;
  input: Record<string, unknown>;
  requestId: string;
}

export type DenyReason =
  | 'agent_not_found'
  | 'tool_not_allowed'
  | 'restricted_action'
  | 'missing_token'
  | 'invalid_request';

export interface PolicyAcceptedDecision {
  ok: true;
  reviewRequired: boolean;
}

export interface PolicyDeniedDecision {
  ok: false;
  reason: DenyReason;
}

export type PolicyDecision = PolicyAcceptedDecision | PolicyDeniedDecision;

export interface AuditEvent {
  event_id: string;
  event_type: 'agent_run_request';
  tenant_id: string;
  agent_id: string;
  task_type: string;
  requested_tool: string;
  status: 'accepted' | 'denied';
  review_required: boolean;
  timestamp: string;
  reason: DenyReason | null;
  request_id: string;
}

export interface AcceptedResponse {
  ok: true;
  status: 'accepted';
  reviewRequired: boolean;
  agent: { id: string; name: string };
  auditEvent: AuditEvent;
}

export interface DeniedResponse {
  ok: false;
  status: 'denied';
  reason: DenyReason;
  auditEvent: AuditEvent;
}

export type RunAgentResponse = AcceptedResponse | DeniedResponse;
