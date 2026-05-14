import type {
  ApprovalGateRecord,
  ApprovalStatus,
  ExecutionInput,
  RiskLevel,
} from './types';

/**
 * Approval-gate service contract. The executor never touches a gate row
 * directly — it talks to this service so the production impl (backed by
 * `runtime_approval_gates`) and test impls (in-memory) are
 * interchangeable.
 *
 * Phase 1.1 ships only the interface plus an in-memory test
 * implementation. The production impl arrives in Phase 1.2 alongside the
 * Postgres-backed ExecutionTracer.
 */
export interface ApprovalGateService {
  /** Create a new pending gate row tied to the given execution. */
  open(input: OpenGateInput): Promise<ApprovalGateRecord>;
  /** Read the current state of a gate. */
  get(id: string): Promise<ApprovalGateRecord | undefined>;
  /**
   * Record a decision. Implementations MUST reject transitions out of
   * non-pending states and MUST stamp `decided_at`.
   */
  decide(input: DecideGateInput): Promise<ApprovalGateRecord>;
}

export interface OpenGateInput {
  execution_id: string;
  reason: string;
  risk_level: RiskLevel;
  requested_action: string;
}

export interface DecideGateInput {
  id: string;
  status: Extract<ApprovalStatus, 'granted' | 'denied'>;
  decided_by?: string;
}

/**
 * Predicate used by the executor to decide whether a skill needs a gate
 * before its handler runs. Mirrors the manifest validation rule: anything
 * not strictly opted into `auto_approve === true` requires a gate.
 */
export function requiresApprovalGate(input: {
  auto_approve: boolean;
}): boolean {
  return input.auto_approve !== true;
}

/**
 * Default reason string for gates opened by the executor. Production code
 * may override with a richer message that incorporates the input summary.
 */
export function defaultGateReason(skillId: string, input: ExecutionInput): string {
  return `Skill "${skillId}" requested for tenant ${input.tenant_id} by agent ${input.agent_id}`;
}
