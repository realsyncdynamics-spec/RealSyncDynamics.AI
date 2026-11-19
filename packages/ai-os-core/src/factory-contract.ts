/** SF-001: deterministic, side-effect-free *simulation* contract.
 * No authorization, persistence, browser, shell, network, GitHub or deployment.
 * Never treat the caller-provided principal/approval as a production trust boundary.
 */
export type FactoryState =
  | 'draft' | 'specified' | 'approved_for_sandbox' | 'running'
  | 'testing' | 'review_required' | 'completed'
  | 'blocked' | 'failed' | 'cancelled';

export type FactoryOperation =
  | 'specify' | 'approve_sandbox' | 'start_mock' | 'mock_succeeded'
  | 'mock_crashed' | 'tests_passed' | 'tests_failed' | 'accept_review'
  | 'block' | 'fail' | 'cancel';

export interface FactoryEvent {
  readonly sequence: number;
  readonly operation: FactoryOperation;
  readonly from: FactoryState;
  readonly to: FactoryState;
  /** Reference only: a format check is NOT proof that Evidence Vault persisted this event. */
  readonly evidenceRef: string;
  readonly actor: string;
  readonly at: string;
}
export interface FactoryReceipt {
  readonly key: string;
  readonly payload: string;
}
export interface FactoryJob {
  readonly id: string;
  /** Internal AI-OS namespace, NOT a customer tenant ID or access token. */
  readonly scopeId: string;
  readonly state: FactoryState;
  readonly version: number;
  readonly specSha256: string | null;
  readonly sandboxApprovalId: string | null;
  readonly sandboxApprovalExpiresAt: string | null;
  readonly budgetCents: number;
  readonly spentCents: number;
  /** Simulation-only event tape. Not durable, immutable, or authoritative. */
  readonly events: readonly FactoryEvent[];
  readonly receipts: readonly FactoryReceipt[];
}
/** This context is synthesized ONLY by test fixtures; it is not an auth API. */
export interface FactoryMockContext {
  readonly mode: 'simulation' | 'production';
  readonly operatorId: string;
  readonly isOperator: boolean;
  readonly aal2: boolean;
  readonly scopeId: string;
  readonly now: string;
  readonly sandboxApproval?: {
    readonly id: string;
    readonly jobId: string;
    readonly specSha256: string;
    readonly approverId: string;
    readonly humanConfirmed: boolean;
    readonly expiresAt: string;
  };
  readonly reviewApproval?: {
    readonly id: string;
    readonly jobId: string;
    readonly approverId: string;
    readonly humanConfirmed: boolean;
  };
}
export interface FactoryCommand {
  readonly operation: FactoryOperation | string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly evidenceRef: string;
  readonly specSha256?: string;
  /** Simulated spending only: no actual reservation or debit. */
  readonly mockCostCents?: number;
}
export type FactoryRejectReason =
  | 'simulation_only' | 'not_operator' | 'scope_mismatch' | 'bad_input'
  | 'idempotency_conflict' | 'version_conflict' | 'invalid_transition'
  | 'approval_required' | 'approval_expired' | 'budget_exceeded';
export type FactoryResult =
  | { readonly ok: true; readonly job: FactoryJob; readonly replay: boolean }
  | { readonly ok: false; readonly reason: FactoryRejectReason };

const SHA256 = /^[a-f0-9]{64}$/;
const EVIDENCE_ID = /^ev_[a-zA-Z0-9_-]{8,128}$/;
const TERMINAL: readonly FactoryState[] = ['completed', 'blocked', 'failed', 'cancelled'];
const ACTIVE: readonly FactoryState[] = ['draft', 'specified', 'approved_for_sandbox', 'running', 'testing', 'review_required'];
const OPERATION_TO_STATE: Record<FactoryOperation, readonly [FactoryState[], FactoryState]> = {
  specify: [['draft'], 'specified'],
  approve_sandbox: [['specified'], 'approved_for_sandbox'],
  start_mock: [['approved_for_sandbox'], 'running'],
  mock_succeeded: [['running'], 'testing'],
  mock_crashed: [['running'], 'failed'],
  tests_passed: [['testing'], 'review_required'],
  tests_failed: [['testing'], 'failed'],
  accept_review: [['review_required'], 'completed'],
  block: [[...ACTIVE], 'blocked'],
  fail: [['specified', 'approved_for_sandbox', 'running', 'testing', 'review_required'], 'failed'],
  cancel: [[...ACTIVE], 'cancelled'],
};
function isValidDate(text: string): boolean {
  return typeof text === 'string' && Number.isFinite(Date.parse(text));
}
function validCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function isFactoryOperation(value: string): value is FactoryOperation {
  return Object.prototype.hasOwnProperty.call(OPERATION_TO_STATE, value);
}
export function newFactoryMockJob(id: string, scopeId: string, budgetCents: number): FactoryJob {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !/^[a-zA-Z0-9_-]{1,80}$/.test(scopeId) || !validCents(budgetCents)) {
    throw new Error('Invalid simulation job input');
  }
  return {
    id, scopeId, state: 'draft', version: 0, specSha256: null,
    sandboxApprovalId: null, sandboxApprovalExpiresAt: null,
    budgetCents, spentCents: 0, events: [], receipts: [],
  };
}
/** Pure simulation; returns new objects and emits zero external actions. */
export function transitionFactoryMock(job: FactoryJob, command: FactoryCommand, ctx: FactoryMockContext): FactoryResult {
  if (ctx.mode !== 'simulation') return { ok: false, reason: 'simulation_only' };
  if (!ctx.isOperator || !ctx.operatorId.trim()) return { ok: false, reason: 'not_operator' };
  if (ctx.scopeId !== job.scopeId) return { ok: false, reason: 'scope_mismatch' };
  if (!isValidDate(ctx.now) || !EVIDENCE_ID.test(command.evidenceRef) ||
      !command.idempotencyKey || command.idempotencyKey.length > 120 ||
      !validCents(command.mockCostCents ?? 0) ||
      (command.specSha256 !== undefined && !SHA256.test(command.specSha256))) {
    return { ok: false, reason: 'bad_input' };
  }
  if (!isFactoryOperation(command.operation)) return { ok: false, reason: 'invalid_transition' };
  // Idempotency includes the FULL command body. Same key, different payload => hard failure.
  const payload = JSON.stringify({ operation: command.operation, evidenceRef: command.evidenceRef,
    specSha256: command.specSha256 ?? null, mockCostCents: command.mockCostCents ?? 0 });
  const previous = job.receipts.find(r => r.key === command.idempotencyKey);
  if (previous) return previous.payload === payload
    ? { ok: true, job, replay: true }
    : { ok: false, reason: 'idempotency_conflict' };
  if (job.version !== command.expectedVersion) return { ok: false, reason: 'version_conflict' };
  if (TERMINAL.includes(job.state)) return { ok: false, reason: 'invalid_transition' };

  const [from, target] = OPERATION_TO_STATE[command.operation];
  if (!from.includes(job.state)) return { ok: false, reason: 'invalid_transition' };
  if (command.operation === 'specify' && (!command.specSha256 || !SHA256.test(command.specSha256))) {
    return { ok: false, reason: 'bad_input' };
  }
  let approvalId = job.sandboxApprovalId;
  let expiresAt = job.sandboxApprovalExpiresAt;
  if (command.operation === 'approve_sandbox') {
    const a = ctx.sandboxApproval;
    if (!ctx.aal2 || !a || !a.humanConfirmed || !a.id || !a.approverId ||
        a.jobId !== job.id || a.specSha256 !== job.specSha256) {
      return { ok: false, reason: 'approval_required' };
    }
    if (!isValidDate(a.expiresAt) || Date.parse(a.expiresAt) <= Date.parse(ctx.now)) {
      return { ok: false, reason: 'approval_expired' };
    }
    approvalId = a.id;
    expiresAt = a.expiresAt;
  }
  if (command.operation === 'start_mock') {
    if (!approvalId || !expiresAt) return { ok: false, reason: 'approval_required' };
    if (Date.parse(expiresAt) <= Date.parse(ctx.now)) return { ok: false, reason: 'approval_expired' };
  }
  if (command.operation === 'accept_review') {
    const a = ctx.reviewApproval;
    if (!ctx.aal2 || !a || !a.humanConfirmed || !a.id || !a.approverId || a.jobId !== job.id) {
      return { ok: false, reason: 'approval_required' };
    }
  }
  const cost = command.mockCostCents ?? 0;
  if (job.spentCents + cost > job.budgetCents || !validCents(job.spentCents + cost)) {
    return { ok: false, reason: 'budget_exceeded' };
  }
  const next: FactoryJob = {
    ...job, state: target, version: job.version + 1,
    specSha256: command.operation === 'specify' ? command.specSha256! : job.specSha256,
    sandboxApprovalId: approvalId, sandboxApprovalExpiresAt: expiresAt,
    spentCents: job.spentCents + cost,
    events: [...job.events, { sequence: job.version + 1, operation: command.operation,
      from: job.state, to: target, evidenceRef: command.evidenceRef,
      actor: ctx.operatorId, at: ctx.now }],
    receipts: [...job.receipts, { key: command.idempotencyKey, payload }],
  };
  return { ok: true, job: next, replay: false };
}
/** Deterministic simulated worker: no code execution, web requests or filesystem.
 * Synthetic evidence ids are NOT persisted evidence.
 */
export function simulateFactoryWorker(
  job: FactoryJob,
  context: FactoryMockContext,
  outcome: 'passed' | 'test_failed' | 'crashed' | 'attempted_production',
): FactoryResult {
  if (outcome === 'attempted_production') return { ok: false, reason: 'simulation_only' };
  const ops: readonly FactoryOperation[] = outcome === 'crashed' ? ['start_mock', 'mock_crashed']
    : outcome === 'test_failed' ? ['start_mock', 'mock_succeeded', 'tests_failed']
    : ['start_mock', 'mock_succeeded', 'tests_passed'];
  let current = job;
  for (const [i, operation] of ops.entries()) {
    const result = transitionFactoryMock(current, {
      operation, expectedVersion: current.version,
      idempotencyKey: `${job.id}-mock-${job.version}-${i}-${outcome}`,
      evidenceRef: `ev_${job.id.replace(/-/g, '_')}_mock_${job.version}_${i}`,
      mockCostCents: operation === 'start_mock' ? 1 : 0,
    }, context);
    if (!result.ok) return result;
    current = result.job;
  }
  return { ok: true, job: current, replay: false };
}
