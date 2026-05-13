/**
 * Runtime core types. Schema-only. No behavior here.
 *
 * See docs/architecture/agent-os.md for the rationale behind each concept.
 * Anything in this file is part of the runtime contract. Treat changes as
 * breaking until a versioning strategy is in place (Phase 5).
 */

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
  /** Stable identifier, dot-namespaced: `<application>.<action>`. */
  id: string;
  /** Manifest schema version. Currently always 1. */
  version: 1;
  /** Human-readable title. */
  title: string;
  /** One-sentence description, used in approval UI. */
  description: string;
  /** Capabilities the skill needs to run. Enforced by the executor. */
  capabilities: readonly Capability[];
  /** Default risk classification of this skill. */
  risk_level: RiskLevel;
  /** Whether the skill may run without an approval gate. Allowed only when
   *  capabilities are strictly read-only and no PII is processed. The
   *  validator enforces this. */
  auto_approve: boolean;
  /** PII class of the data this skill touches. */
  pii_class: PiiClass;
  /** Whether re-running with the same input is safe. Drives retry policy. */
  idempotent: boolean;
  /** Optional JSON-schema-ish hint for input shape. Not validated here. */
  input_schema?: Record<string, unknown>;
}

export interface AgentDefinition {
  /** Stable identifier per tenant. */
  id: string;
  tenant_id: string;
  title: string;
  /** Skill IDs this agent is allowed to invoke. Must all exist in the
   *  registry at validation time. */
  skill_ids: readonly string[];
  /** Capabilities granted to this agent. Must be a superset of the union
   *  of all its skills' capabilities. */
  granted_capabilities: readonly Capability[];
  /** If true, the validator will allow the agent even if it grants more
   *  capabilities than its skills require (e.g. for future skills). */
  allow_capability_surplus?: boolean;
  /** Optional memory scope name. Memory access is scoped by this string. */
  memory_scope?: string;
}

export interface ExecutionInput {
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  /** Caller-provided arguments. Not validated by the runtime in Phase 0. */
  args: Record<string, unknown>;
  /** Idempotency key. The executor MUST de-dup on (tenant_id, key). */
  idempotency_key?: string;
}

export interface ExecutionRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  skill_id: string;
  status: ExecutionStatus;
  /** Hashes only; raw inputs/outputs live in their respective stores. */
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
  | 'memory.read';

export interface RuntimeEvent<T = Record<string, unknown>> {
  name: RuntimeEventName;
  tenant_id: string;
  execution_id?: string;
  agent_id?: string;
  skill_id?: string;
  /** Pointer-style payload. Never include raw PII here. */
  payload: T;
  occurred_at: string;
}
