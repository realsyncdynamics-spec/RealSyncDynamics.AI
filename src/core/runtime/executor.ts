import type {
  ExecutionInput,
  ExecutionRecord,
  ExecutionStatus,
  RuntimeEvent,
  RuntimeEventName,
} from './types';
import type { SkillRegistry } from './registry';
import type { PermissionChecker } from './permissions';
import { diffCapabilities } from './permissions';
import type { ExecutionTracer } from './observability';
import type { EventBus } from './events';
import type { ApprovalGateService } from './approvals';
import {
  defaultGateReason,
  requiresApprovalGate,
} from './approvals';
import type { HandlerContext, HandlerRegistry } from './handlers';
import { defaultHasher } from './handlers';
import { effectiveAlongPath } from './delegation/graph';

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
  | 'invalid_input'
  | 'delegation_denied';

export interface ExecutorDeps {
  registry: SkillRegistry;
  handlers: HandlerRegistry;
  permissions: PermissionChecker;
  tracer: ExecutionTracer;
  events: EventBus;
  gates: ApprovalGateService;
  id?: () => string;
  clock?: () => Date;
  hash?: (value: unknown) => string;
}

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

    const govard = consumeGovard(input);
    if (!govard.ok) {
      await this.#finish(execution_id, 'failed', 'delegation_denied');
      await this.#emit('delegation.rejected', input, execution_id, {
        reason: govard.reason,
        detail: govard.detail,
      });
      return { status: 'failed', execution_id, error_code: 'delegation_denied' };
    }

    if (input.delegation_chain && input.delegation_chain.length > 0) {
      if (!input.command_id || !input.evaluation_hash || !input.root_agent) {
        await this.#finish(execution_id, 'failed', 'delegation_denied');
        await this.#emit('delegation.rejected', input, execution_id, {
          reason: 'missing_command',
          detail: 'delegation_chain requires command_id, evaluation_hash, root_agent',
        });
        return { status: 'failed', execution_id, error_code: 'delegation_denied' };
      }
      const hashMismatch = input.delegation_chain.some(
        (e) => e.evaluation_hash !== input.evaluation_hash || e.command_id !== input.command_id,
      );
      if (hashMismatch) {
        await this.#finish(execution_id, 'failed', 'delegation_denied');
        await this.#emit('delegation.rejected', input, execution_id, {
          reason: 'evaluation_mismatch',
          detail: 'edge command_id/evaluation_hash != execution input',
        });
        return { status: 'failed', execution_id, error_code: 'delegation_denied' };
      }
      const fold = effectiveAlongPath(input.root_agent, input.delegation_chain, this.#deps.clock());
      if (!fold.ok) {
        await this.#finish(execution_id, 'failed', 'delegation_denied');
        await this.#emit('delegation.rejected', input, execution_id, {
          reason: fold.reason,
          detail: fold.detail,
        });
        return { status: 'failed', execution_id, error_code: 'delegation_denied' };
      }
      const missing = diffCapabilities(fold.effective_capabilities, skill.capabilities);
      if (missing.length > 0) {
        await this.#finish(execution_id, 'failed', 'delegation_denied');
        await this.#emit('delegation.rejected', input, execution_id, {
          reason: 'authority_expansion',
          detail: 'skill capabilities exceed folded path',
          missing,
        });
        return { status: 'failed', execution_id, error_code: 'delegation_denied' };
      }
      await this.#emit('delegation.created', input, execution_id, {
        command_id: input.command_id,
        evaluation_hash: input.evaluation_hash,
        effective: fold.effective_capabilities,
      });
    }

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

function consumeGovard(input: ExecutionInput): { ok: true } | { ok: false; reason: string; detail: string } {
  if (!input.govard_decision) return { ok: true };
  if (input.govard_decision === 'DENY') {
    return { ok: false, reason: 'govard_deny', detail: 'GOVARD DENY is authoritative' };
  }
  if (input.govard_decision === 'APPROVAL' && input.approval_granted !== true) {
    return { ok: false, reason: 'approval_pending', detail: 'GOVARD APPROVAL without human grant' };
  }
  return { ok: true };
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
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
