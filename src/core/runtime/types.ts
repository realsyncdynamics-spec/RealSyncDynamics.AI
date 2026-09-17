/**
 * Runtime core types. Schema-only. No behavior here.
 *
 * See docs/architecture/agent-os.md for the rationale behind each concept.
 * Anything in this file is part of the runtime contract. Treat changes as
 * breaking until a versioning strategy is in place (Phase 5).
 */

import type { AgentIdentity, DelegationEdge, GovardDecision } from './delegation/types';

export type Capability =
  | `read:${string}`
  | `write:${string}`
  | `network:${'external' | 'internal'}`
  | `pii:${'process' | 'store'}`
  | `consent:${'read' | 'write'}`
  | `llm:invoke`;

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PiiClass = 'none' | 'contact' | 'identifier' | 'sensitive';

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ApprovalStatus = 'pending' | 'granted' | 'denied' | 'expired';

export interface SkillManifest {
  id: string;
  version: 1;
  title: string;
  description: string;
  capabilities: readonly Capability[];
  risk_level: RiskLevel;
  auto_approve: boolean;
  pii_class: PiiClass;
  idempotent: boolean;
  input_schema?: Record<string, unknown>;
}

export interface AgentDefinition {
  id: string;
  tenant_id: string;
  title: string;
  skill_ids: readonly string[];
  granted_capabilities: readonly Capability[];
  allow_capability_surplus?: boolean;
  memory_scope?: string;
}

export interface ExecutionInput {
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  args: Record<string, unknown>;
  idempotency_key?: string;
  command_id?: string;
  evaluation_hash?: string;
  govard_decision?: GovardDecision;
  approval_granted?: boolean;
  root_agent?: AgentIdentity;
  delegation_chain?: readonly DelegationEdge[];
}

export interface ExecutionRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  status: ExecutionStatus;
  input_hash: string;
  output_hash?: string;
  started_at: string;
  finished_at?: string;
  error_code?: string;
}

export interface ApprovalGateRecord {
  id: string;
  execution_id: string;
  reason: string;
  risk_level: RiskLevel;
  requested_action: string;
  status: ApprovalStatus;
  created_at: string;
  decided_at?: string;
}

export type RuntimeEventName =
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'permission.denied'
  | 'memory.written'
  | 'memory.read'
  | 'delegation.created'
  | 'delegation.rejected'
  | 'delegation.expired'
  | 'delegation.revoked';

export interface RuntimeEvent<T = Record<string, unknown>> {
  name: RuntimeEventName;
  tenant_id: string;
  execution_id?: string;
  agent_id?: string;
  skill_id?: string;
  payload: T;
  occurred_at: string;
}
