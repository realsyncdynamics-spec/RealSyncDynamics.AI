/**
 * Delegation Graph types. Additive primitive.
 * Capability union is identical to src/core/runtime/types.ts.
 */
export type Capability =
  | `read:${string}`
  | `write:${string}`
  | `network:${'external' | 'internal'}`
  | `pii:${'process' | 'store'}`
  | `consent:${'read' | 'write'}`
  | `llm:invoke`;

export type PrincipalKind = 'human' | 'agent' | 'service' | 'mcp';

export type GovardDecision = 'DENY' | 'APPROVAL' | 'ALLOW';

/** tenant_id ≡ org_id until an SSoT rename. */
export interface AgentIdentity {
  tenant_id: string;
  agent_id: string;
  principal_kind: PrincipalKind;
  parent_agent_id?: string;
  delegation_id?: string;
  granted_capabilities: readonly Capability[];
  /** Routing/telemetry only. Never a policy input. */
  provider?: 'anthropic' | 'openai' | 'xai' | 'google' | 'custom';
}

export interface DelegationEdge {
  delegation_id: string;
  command_id: string;
  tenant_id: string;
  from_agent_id: string;
  to_agent_id: string;
  delegated_capabilities: readonly Capability[];
  denied_capabilities?: readonly Capability[];
  expires_at: string;
  max_depth: number;
  approval_id?: string;
  evaluation_hash: string;
  created_at: string;
  revoked_at?: string;
}

export interface CorrelationIds {
  command_id: string;
  agent_id: string;
  delegation_id?: string;
  tool_invocation_id?: string;
  resource_action_id?: string;
  policy_decision_id?: string;
  approval_id?: string;
  execution_id?: string;
  evidence_event_id?: string;
}

export interface ToolInvocation {
  tool_invocation_id: string;
  command_id: string;
  tenant_id: string;
  agent_id: string;
  delegation_id?: string;
  tool_name: string;
  tool_origin: 'skill' | 'mcp' | 'gateway';
  args_hash: string;
}

export interface ResourceAction {
  resource_action_id: string;
  command_id: string;
  tenant_id: string;
  tool_invocation_id: string;
  resource_kind: string;
  verb: 'read' | 'write' | 'delete' | 'invoke';
  target_hash: string;
  side_effect: 'none' | 'external_write' | 'external_read';
}

export type DelegationRejectReason =
  | 'cross_tenant'
  | 'self_delegation'
  | 'authority_expansion'
  | 'depth_exceeded'
  | 'expired'
  | 'revoked'
  | 'missing_evaluation_hash'
  | 'missing_command'
  | 'empty_capability_set'
  | 'govard_deny'
  | 'approval_pending'
  | 'evaluation_mismatch';

export type DelegationDecision =
  | { ok: true; edge: DelegationEdge; effective_capabilities: readonly Capability[] }
  | { ok: false; reason: DelegationRejectReason; detail: string };
