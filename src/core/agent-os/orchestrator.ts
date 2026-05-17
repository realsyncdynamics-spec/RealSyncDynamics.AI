// Agent OS Orchestrator (Phase A scaffold).
//
// Implements the canonical agent loop:
//
//   observe → analyze → propose → execute → verify → store
//
// In Phase A this is a thin coordination layer:
//   - register agents (each agent is a name + a handler fn)
//   - dispatch tasks to agents by name
//   - run handlers and record their output / observations
//   - emit events into the AgentOsStore for replay
//
// The Orchestrator NEVER auto-approves decisions. When a handler
// proposes one via the store, the proposal stays in status='proposed'
// until a human / DecisionAgent / external caller resolves it.
//
// Phase B: queue-backed, persistent, multi-tenant scheduling.

import { AgentOsStore } from './store';
import type {
  AgentName, AgentTask, AgentOutputRecord, AgentObservation,
  DecisionProposal,
} from './types';

// ── Handler contract ───────────────────────────────────────────────

export interface HandlerContext {
  task:  AgentTask;
  store: AgentOsStore;
  /** Convenience helpers — the handler can use these instead of
   *  reaching into store directly. */
  observe: (args: Omit<AgentObservation, 'id' | 'tenant_id' | 'agent' | 'created_at' | 'acknowledged'>) => AgentObservation;
  propose: (args: Omit<DecisionProposal, 'id' | 'tenant_id' | 'proposed_by' | 'status' | 'approved_by' | 'approved_at' | 'superseded_by' | 'created_at'>) => DecisionProposal;
}

export interface HandlerResult {
  /** Free-form output of the handler. Recorded into agent_outputs. */
  content: unknown;
  /** 0..100 agent self-confidence. */
  self_confidence?: number;
  /** Evidence chain link ids / URLs backing the output. */
  evidence?: string[];
  /** Risk dimensions the output touches. */
  risk_dimensions?: string[];
  /** Whether the task should be considered done vs blocked vs failed. */
  outcome?: 'done' | 'blocked' | 'failed';
  /** Reason text when outcome != 'done'. */
  reason?: string;
}

export type AgentHandler = (ctx: HandlerContext) => Promise<HandlerResult> | HandlerResult;

// ── The Orchestrator ──────────────────────────────────────────────

export class Orchestrator {
  public readonly store: AgentOsStore;
  private handlers = new Map<AgentName, AgentHandler>();

  constructor(opts: { store?: AgentOsStore } = {}) {
    this.store = opts.store ?? new AgentOsStore();
  }

  // ── Registration ───────────────────────────────────────────────

  registerAgent(name: AgentName, handler: AgentHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`agent '${name}' already registered`);
    }
    this.handlers.set(name, handler);
  }

  unregisterAgent(name: AgentName): boolean {
    return this.handlers.delete(name);
  }

  isRegistered(name: AgentName): boolean {
    return this.handlers.has(name);
  }

  registeredAgents(): AgentName[] {
    return [...this.handlers.keys()];
  }

  // ── Dispatch ───────────────────────────────────────────────────

  /**
   * Run a single task through its assigned agent's handler.
   * Transitions: open → in_progress → done | failed | blocked.
   * Records the handler's HandlerResult as an agent_outputs row.
   */
  async run(task_id: string): Promise<AgentTask | null> {
    const task = this.store.getTaskById(task_id);
    if (!task) return null;
    if (task.status !== 'open') return task;   // already moved on
    const handler = this.handlers.get(task.agent);
    if (!handler) {
      return this.store.transitionTask(task.id, 'failed', {
        blocker_reason: `no handler registered for agent '${task.agent}'`,
      });
    }

    const started = this.store.transitionTask(task.id, 'in_progress');
    if (!started) return null;

    const ctx: HandlerContext = {
      task: started,
      store: this.store,
      observe: (args) => this.store.recordObservation({
        ...args,
        tenant_id: started.tenant_id,
        agent: started.agent,
      }),
      propose: (args) => this.store.proposeDecision({
        ...args,
        tenant_id: started.tenant_id,
        proposed_by: started.agent,
      }),
    };

    let result: HandlerResult;
    try {
      result = await handler(ctx);
    } catch (err) {
      const reason = (err as Error).message ?? String(err);
      return this.store.transitionTask(task.id, 'failed', { blocker_reason: reason });
    }

    // Record the output regardless of outcome — failed runs still
    // produce a record so trainer / replay can inspect them.
    const out = this.store.recordOutput({
      tenant_id:       task.tenant_id,
      task_id:         task.id,
      agent:           task.agent,
      content:         result.content,
      self_confidence: result.self_confidence ?? null,
      evidence:        result.evidence        ?? [],
      risk_dimensions: result.risk_dimensions ?? [],
    });

    const outcome = result.outcome ?? 'done';
    return this.store.transitionTask(task.id, outcome, {
      output:         { output_id: out.id, content: result.content },
      blocker_reason: outcome === 'done' ? undefined : (result.reason ?? null) ?? undefined,
    });
  }

  /** Drain every open task (across all tenants). Phase-A serial
   *  execution; Phase B parallelises per agent + per tenant. */
  async drain(): Promise<AgentTask[]> {
    const out: AgentTask[] = [];
    while (true) {
      const next = this.store.nextOpenTask();
      if (!next) break;
      const after = await this.run(next.id);
      if (after) out.push(after);
      // Avoid infinite loop if run() returns the same open task
      // (shouldn't happen because transitionTask flips status, but
      // be defensive).
      if (after?.status === 'open') break;
    }
    return out;
  }
}

// ── Default singleton (optional convenience) ───────────────────────

let _default: Orchestrator | null = null;
export function getDefaultOrchestrator(): Orchestrator {
  if (!_default) _default = new Orchestrator();
  return _default;
}
export function __resetDefaultOrchestratorForTests(): void {
  _default?.store.__resetForTests();
  _default = null;
}
