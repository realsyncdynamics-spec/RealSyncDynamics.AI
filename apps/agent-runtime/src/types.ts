/**
 * Geteilte Typen für den Agent-Runtime-Gateway.
 *
 * Alle exportierten Schnittstellen sind die einzige API-Quelle
 * der Wahrheit zwischen Gateway, Registry, Policy-Engine und Audit-Log.
 *
 * Voice-Kanal-Typen liegen in voice-types.ts und dürfen diese Union
 * nicht ersetzen. Nur additive Erweiterung von DenyReason.
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
  /**
   * Principal-ID des Agenten aus dem Zugriffsmodell (P1-1). Ohne sie
   * greifen rollenbasierte Regeln nicht — typbasierte schon.
   */
  principalId?: string;
}

export type DenyReason =
  | 'agent_not_found'
  | 'tool_not_allowed'
  | 'restricted_action'
  | 'missing_token'
  | 'invalid_request'
  /** Der Policy Decision Point hat den Tool-Aufruf abgelehnt (P1-5). */
  | 'policy_blocked'
  /** Der PDP verlangt eine Freigabe, bevor der Lauf startet. */
  | 'approval_required'
  /** PDP nicht erreichbar und Ausfallverhalten ist fail closed. */
  | 'policy_engine_unavailable'
  | 'denied_by_channel_policy';

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
  /** Verdikt des Policy Decision Point, falls befragt (P1-5). */
  pdp_decision?: string;
  /** Modus, in dem der Agent-PEP lief: off | shadow | enforce. */
  pdp_mode?: string;
  /** Deutschsprachige Begruendung des PDP — fuer den Pruefpfad. */
  pdp_reason?: string | null;
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
  /** Verstaendliche Erklaerung fuer Menschen (Auftrag §8). */
  message?: string;
  auditEvent: AuditEvent;
}

export type RunAgentResponse = AcceptedResponse | DeniedResponse;
