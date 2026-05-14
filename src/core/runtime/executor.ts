import type {
  ExecutionInput,
  ExecutionRecord,
  ExecutionStatus,
  RuntimeEvent,
  RuntimeEventName,
} from './types';
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
    };

export type ExecutionError =
  | 'skill_not_found'
  | 'handler_not_found'
  | 'permission_denied'
  | 'handler_threw'
  | 'invalid_input';

export interface ExecutorDeps {
  registry: SkillRegistry;
  handlers: HandlerRegistry;
  permissions: PermissionChecker;
  tracer: ExecutionTracer;
  events: EventBus;
  gates: ApprovalGateService;
  /** Injectable for tests. Defaults to `crypto.randomUUID()`. */
  id?: () => string;
  /** Injectable for tests. Defaults to `() => new Date()`. */
  clock?: () => Date;
  /** Injectable for tests. Defaults to FNV-1a over stable JSON. */
  hash?: (value: unknown) => string;
}

/**
 * Phase 1.1 executor. Synchronous skill orchestration:
 *
 *   1. Look up skill in registry  → error_code:'skill_not_found' if missing
 *   2. Look up handler           → error_code:'handler_not_found' if missing
 *   3. Validate input            → error_code:'invalid_input' if not plain
 *   4. Check capabilities        → error_code:'permission_denied' if denied
 *   5. Open approval gate iff !auto_approve  → outcome:'awaiting_approval'
 *   6. Run handler               → outcome:'completed' | error_code:'handler_threw'
 *
 * Every successful path persists an ExecutionRecord and emits structured
 * events. Permission denials are recorded in the audit trail (as a failed
 * execution) so a sweep over `runtime_events` is sufficient for forensics.
 *
 * What this is NOT (intentionally):
 *   - parallel/streaming execution
 *   - sub-agent / skill-to-skill calls
 *   - retry logic (lives in the Phase-2 workflow engine)
 */
export class Executor {
  readonly #deps: Required<ExecutorDeps>;

  constructor(deps: ExecutorDeps) {
    this.#deps = {
      ...deps,
      id: deps.id ?? defaultId,
      clock: deps.clock ?? (() => new Date()),
      hash: deps.hash ?? defaultHasher,
    };
  }

  async execute(input: ExecutionInput): Promise<ExecutionOutcome> {
    const { registry, handlers, permissions, tracer, gates } = this.#deps;

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
