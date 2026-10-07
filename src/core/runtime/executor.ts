import type {
  ExecutionInput,
  ExecutionRecord,
  ExecutionStatus,
  RuntimeEvent,
  RuntimeEventName,
} from './types';
// Re-export types for external consumers
export type { ExecutionInput, ExecutionRecord, ExecutionStatus, RuntimeEvent, RuntimeEventName } from './types';
import type { SkillRegistry } from './registry';
import type { PermissionChecker } from './permissions';
import type { ExecutionTracer } from './observability';
import type { EventBus } from './events';
import type { ApprovalGateService } from './approvals';
import {
  defaultGateReason,
  requiresApprovalGate,
} from './approvals';
import type { HandlerContext, HandlerRegistry } from './handlers';
import { defaultHasher } from './handlers';
import {
  assessRuntimeSafetyFailClosed,
  FailClosedRuntimeSafetyControl,
  type RuntimeSafetyControlService,
} from './safety';

export type ExecutionOutcome =
  | {
      status: 'completed';
      execution_id: string;
      output_hash: string;
      output?: unknown;
    }
  | {
      status: 'failed';
      execution_id?: string;
      error_code: ExecutionError;
    }
  | {
      status: 'awaiting_approval';
      execution_id: string;
      gate_id: string;
    }
  | {
      status: 'blocked_by_safety';
      execution_id: string;
      light: 'yellow' | 'red';
      error_code: Extract<ExecutionError, 'safety_review_required' | 'safety_blocked'>;
      /** Detailed safety reasons stay inside the control/review plane. */
      reason_count: number;
    };

export type ExecutionError =
  | 'skill_not_found'
  | 'handler_not_found'
  | 'permission_denied'
  | 'safety_review_required'
  | 'safety_blocked'
  | 'handler_threw'
  | 'invalid_input';

export interface ExecutorDeps {
  registry: SkillRegistry;
  handlers: HandlerRegistry;
  permissions: PermissionChecker;
  tracer: ExecutionTracer;
  events: EventBus;
  gates: ApprovalGateService;
  /**
   * Runtime safety control. If omitted, execution fails closed as RED.
   * There is deliberately no implicit GREEN fallback.
   */
  safety?: RuntimeSafetyControlService;
  /** Injectable for tests. Defaults to `crypto.randomUUID()`. */
  id?: () => string;
  /** Injectable for tests. Defaults to `() => new Date()`. */
  clock?: () => Date;
  /** Injectable for tests. Defaults to FNV-1a over stable JSON. */
  hash?: (value: unknown) => string;
}

/**
 * Runtime skill orchestration:
 *
 *   1. Look up skill
 *   2. Look up handler
 *   3. Validate input
 *   4. Check capabilities
 *   5. Evaluate independent runtime safety control
 *      - GREEN  -> continue
 *      - YELLOW -> stop; independent-review orchestration happens elsewhere
 *      - RED    -> stop; only the dedicated incident path may take bounded
 *                  emergency safety actions
 *   6. Open human approval gate iff !auto_approve
 *   7. Run handler
 *
 * Safety is evaluated before any handler side effect. Missing, throwing or
 * malformed safety control fails closed to RED.
 *
 * This executor does not itself invoke the three YELLOW reviewers and does not
 * attempt RED remediation. Those are separate authorities by design.
 */
export class Executor {
  readonly #deps: Required<ExecutorDeps>;

  constructor(deps: ExecutorDeps) {
    this.#deps = {
      ...deps,
      safety: deps.safety ?? new FailClosedRuntimeSafetyControl(),
      id: deps.id ?? defaultId,
      clock: deps.clock ?? (() => new Date()),
      hash: deps.hash ?? defaultHasher,
    };
  }

  async execute(input: ExecutionInput): Promise<ExecutionOutcome> {
    const { registry, handlers, permissions, tracer, gates, safety } = this.#deps;

    if (!isValidInput(input)) {
      return { status: 'failed', error_code: 'invalid_input' };
    }

    const skill = registry.get(input.skill_id);
    if (!skill) {
      return { status: 'failed', error_code: 'skill_not_found' };
    }

    const handler = handlers.get(input.skill_id);
    if (!handler) {
      return { status: 'failed', error_code: 'handler_not_found' };
    }

    const execution_id = this.#deps.id();
    const input_hash = this.#deps.hash(input.args ?? {});
    const startedAt = this.#deps.clock().toISOString();

    const base: ExecutionRecord = {
      id: execution_id,
      tenant_id: input.tenant_id,
      agent_id: input.agent_id,
      skill_id: input.skill_id,
      status: 'pending',
      input_hash,
      started_at: startedAt,
    };

    await tracer.start(base);
    await this.#emit('execution.started', input, execution_id, { input_hash });

    const decision = await permissions.check({
      tenant_id: input.tenant_id,
      agent_id: input.agent_id,
      skill_id: input.skill_id,
      required: skill.capabilities,
    });

    if (decision.outcome === 'denied') {
      await this.#finish(execution_id, 'failed', 'permission_denied');
      await this.#emit('permission.denied', input, execution_id, {
        missing: decision.missing,
        reason: decision.reason,
      });
      return { status: 'failed', execution_id, error_code: 'permission_denied' };
    }

    const safetyAssessment = await assessRuntimeSafetyFailClosed(safety, {
      execution_id,
      tenant_id: input.tenant_id,
      agent_id: input.agent_id,
      skill_id: input.skill_id,
      risk_level: skill.risk_level,
      capabilities: skill.capabilities,
      pii_class: skill.pii_class,
      auto_approve: skill.auto_approve,
      input_hash,
    });

    await this.#emit('safety.evaluated', input, execution_id, {
      light: safetyAssessment.light,
      must_stop: safetyAssessment.mustStop,
      requires_independent_review: safetyAssessment.requiresIndependentReview,
      requires_human_decision: safetyAssessment.requiresHumanDecision,
      reason_count: safetyAssessment.reasons.length,
    });

    if (safetyAssessment.light !== 'green') {
      const error_code: Extract<
        ExecutionError,
        'safety_review_required' | 'safety_blocked'
      > = safetyAssessment.light === 'yellow'
        ? 'safety_review_required'
        : 'safety_blocked';

      await this.#finish(execution_id, 'failed', error_code);
      await this.#emit('execution.failed', input, execution_id, {
        error_code,
        safety_light: safetyAssessment.light,
      });

      return {
        status: 'blocked_by_safety',
        execution_id,
        light: safetyAssessment.light,
        error_code,
        reason_count: safetyAssessment.reasons.length,
      };
    }

    if (requiresApprovalGate({ auto_approve: skill.auto_approve })) {
      const gate = await gates.open({
        execution_id,
        reason: defaultGateReason(skill.id, input),
        risk_level: skill.risk_level,
        requested_action: skill.id,
      });
      await this.#finish(execution_id, 'awaiting_approval');
      await this.#emit('approval.requested', input, execution_id, {
        gate_id: gate.id,
        risk_level: skill.risk_level,
      });
      return { status: 'awaiting_approval', execution_id, gate_id: gate.id };
    }

    const ctx: HandlerContext = {
      execution_id,
      tenant_id: input.tenant_id,
      agent_id: input.agent_id,
      skill_id: input.skill_id,
      args: input.args ?? {},
    };

    try {
      const result = await handler(ctx);
      await this.#finish(execution_id, 'completed', undefined, result.output_hash);
      await this.#emit('execution.completed', input, execution_id, {
        output_hash: result.output_hash,
      });
      return {
        status: 'completed',
        execution_id,
        output_hash: result.output_hash,
        output: result.output,
      };
    } catch (err) {
      await this.#finish(execution_id, 'failed', 'handler_threw');
      await this.#emit('execution.failed', input, execution_id, {
        error: err instanceof Error ? err.message : String(err),
      });
      return { status: 'failed', execution_id, error_code: 'handler_threw' };
    }
  }

  async #finish(
    execution_id: string,
    status: ExecutionStatus,
    error_code?: string,
    output_hash?: string,
  ): Promise<void> {
    await this.#deps.tracer.finish(execution_id, {
      status,
      output_hash,
      error_code,
      finished_at: this.#deps.clock().toISOString(),
    });
  }

  async #emit(
    name: RuntimeEventName,
    input: ExecutionInput,
    execution_id: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event: RuntimeEvent = {
      name,
      tenant_id: input.tenant_id,
      execution_id,
      agent_id: input.agent_id,
      skill_id: input.skill_id,
      payload,
      occurred_at: this.#deps.clock().toISOString(),
    };
    await this.#deps.events.emit(event);
  }
}

function isValidInput(input: ExecutionInput): boolean {
  if (!input || typeof input !== 'object') return false;
  if (!input.tenant_id || !input.agent_id || !input.skill_id) return false;
  if (input.args !== undefined && (input.args === null || typeof input.args !== 'object')) {
    return false;
  }
  return true;
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Vanishingly unlikely fallback. Tests inject their own.
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
