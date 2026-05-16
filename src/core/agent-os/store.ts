// Agent OS — in-memory store for all 7 record types.
//
// Mirrors the schema in supabase/migrations/<ts>_agent_os_substrate.sql.
// Phase A ships in-memory; Phase B wires Postgres via setPersistHook().

import type {
  MemoryItem, MemoryQuery, MemoryStatus,
  AgentTask, TaskStatus, TaskPriority,
  DecisionProposal, DecisionStatus,
  AgentInput, AgentOutputRecord, AgentObservation,
  AgentEvent, AgentEventType,
  AgentOsPersistHook, AgentName,
} from './types';

let _counter = 0;
function nextId(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter.toString(36)}`;
}

let _eventSeq = 0;

export class AgentOsStore {
  private memory       = new Map<string, MemoryItem>();
  private tasks        = new Map<string, AgentTask>();
  private decisions    = new Map<string, DecisionProposal>();
  private inputs       = new Map<string, AgentInput>();
  private outputs      = new Map<string, AgentOutputRecord>();
  private observations = new Map<string, AgentObservation>();
  private events: AgentEvent[] = [];
  private hook: AgentOsPersistHook | null = null;

  setPersistHook(h: AgentOsPersistHook | null): void {
    this.hook = h;
  }

  // ── Memory ─────────────────────────────────────────────────────

  addMemory(args: {
    tenant_id:         string;
    topic:             string;
    content:           string;
    source?:           string | null;
    source_agent?:     string | null;
    tags?:             string[];
    importance?:       1 | 2 | 3 | 4 | 5;
    status?:           MemoryStatus;
    decided_action?:   string | null;
    responsible_agent?: string | null;
  }): MemoryItem {
    const now = new Date().toISOString();
    const item: MemoryItem = {
      id:                nextId('mem'),
      tenant_id:         args.tenant_id,
      topic:             args.topic,
      content:           args.content,
      source:            args.source            ?? null,
      source_agent:      args.source_agent      ?? null,
      tags:              args.tags              ?? [],
      importance:        args.importance        ?? 3,
      status:            args.status            ?? 'active',
      superseded_by:     null,
      decided_action:    args.decided_action    ?? null,
      responsible_agent: args.responsible_agent ?? null,
      created_at:        now,
      updated_at:        now,
    };
    this.memory.set(item.id, item);
    void this.hook?.saveMemory?.(item);
    this.emit({
      tenant_id:   item.tenant_id,
      event_type:  'memory.added',
      subject_type:'memory',
      subject_id:  item.id,
      agent:       item.source_agent,
      payload:     { topic: item.topic, importance: item.importance },
    });
    return item;
  }

  queryMemory(q: MemoryQuery): MemoryItem[] {
    const rows = [...this.memory.values()].filter(m => {
      if (m.tenant_id !== q.tenant_id)                      return false;
      if (q.topic && m.topic !== q.topic)                   return false;
      if (q.tag && !m.tags.includes(q.tag))                 return false;
      if (q.status && m.status !== q.status)                return false;
      if (q.min_importance !== undefined && m.importance < q.min_importance) return false;
      return true;
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  supersedeMemory(id: string, replacementId: string): MemoryItem | null {
    const m = this.memory.get(id);
    const r = this.memory.get(replacementId);
    if (!m || !r) return null;
    const updated: MemoryItem = { ...m, status: 'superseded', superseded_by: replacementId, updated_at: new Date().toISOString() };
    this.memory.set(id, updated);
    void this.hook?.saveMemory?.(updated);
    this.emit({
      tenant_id: m.tenant_id, event_type: 'memory.superseded',
      subject_type: 'memory', subject_id: id, agent: null,
      payload: { superseded_by: replacementId },
    });
    return updated;
  }

  // ── Tasks ──────────────────────────────────────────────────────

  createTask(args: {
    tenant_id: string;
    agent: AgentName;
    task: string;
    priority?: TaskPriority;
    input?: Record<string, unknown>;
    created_by?: string;
    parent_task_id?: string;
  }): AgentTask {
    const t: AgentTask = {
      id:             nextId('task'),
      tenant_id:      args.tenant_id,
      agent:          args.agent,
      task:           args.task,
      priority:       args.priority ?? 'normal',
      status:         'open',
      input:          args.input ?? {},
      output:         null,
      blocker_reason: null,
      parent_task_id: args.parent_task_id ?? null,
      created_by:     args.created_by ?? 'system',
      created_at:     new Date().toISOString(),
      started_at:     null,
      completed_at:   null,
    };
    this.tasks.set(t.id, t);
    void this.hook?.saveTask?.(t);
    this.emit({
      tenant_id: t.tenant_id, event_type: 'task.created',
      subject_type: 'task', subject_id: t.id, agent: t.agent,
      payload: { task: t.task, priority: t.priority },
    });
    return t;
  }

  transitionTask(id: string, to: TaskStatus, args: {
    output?: Record<string, unknown>;
    blocker_reason?: string;
  } = {}): AgentTask | null {
    const t = this.tasks.get(id);
    if (!t) return null;
    if (isTerminal(t.status)) {
      throw new Error(`task ${id} already in terminal state ${t.status}`);
    }
    const now = new Date().toISOString();
    const updated: AgentTask = {
      ...t,
      status:         to,
      output:         args.output ?? t.output,
      blocker_reason: (to === 'blocked' || to === 'failed')
                        ? (args.blocker_reason ?? t.blocker_reason)
                        : null,
      started_at:     t.started_at ?? (to === 'in_progress' ? now : null),
      completed_at:   isTerminal(to) ? now : null,
    };
    this.tasks.set(id, updated);
    void this.hook?.saveTask?.(updated);
    const eventType = mapTaskTransitionEvent(to);
    this.emit({
      tenant_id: t.tenant_id, event_type: eventType,
      subject_type: 'task', subject_id: id, agent: t.agent,
      payload: { from: t.status, to, blocker_reason: updated.blocker_reason },
    });
    return updated;
  }

  listTasks(filter: { tenant_id: string; agent?: AgentName; status?: TaskStatus }): AgentTask[] {
    return [...this.tasks.values()].filter(t => {
      if (t.tenant_id !== filter.tenant_id) return false;
      if (filter.agent && t.agent !== filter.agent) return false;
      if (filter.status && t.status !== filter.status) return false;
      return true;
    });
  }

  /** Look up a single task by id — used by the Orchestrator which
   *  doesn't know the tenant at runtime. Tenant isolation is enforced
   *  by RLS at the Postgres layer; the in-memory store is process-
   *  local and may be queried globally. */
  getTaskById(id: string): AgentTask | null {
    return this.tasks.get(id) ?? null;
  }

  /** Return the next open task across all tenants, lowest-priority-
   *  cost first. Used by Orchestrator.drain(). */
  nextOpenTask(): AgentTask | null {
    const PRIO_RANK: Record<TaskPriority, number> = {
      critical: 0, high: 1, normal: 2, low: 3,
    };
    const open = [...this.tasks.values()].filter(t => t.status === 'open');
    if (open.length === 0) return null;
    open.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]
                       || a.created_at.localeCompare(b.created_at));
    return open[0] ?? null;
  }

  // ── Decisions ──────────────────────────────────────────────────

  proposeDecision(args: Omit<DecisionProposal, 'id' | 'status' | 'approved_by' | 'approved_at' | 'superseded_by' | 'created_at'>): DecisionProposal {
    const d: DecisionProposal = {
      id:           nextId('dec'),
      ...args,
      status:       'proposed',
      approved_by:  null,
      approved_at:  null,
      superseded_by:null,
      created_at:   new Date().toISOString(),
    };
    this.decisions.set(d.id, d);
    void this.hook?.saveDecision?.(d);
    this.emit({
      tenant_id: d.tenant_id, event_type: 'decision.proposed',
      subject_type: 'decision', subject_id: d.id, agent: d.proposed_by,
      payload: { title: d.decision_title, risk_level: d.risk_level, reversibility: d.reversibility },
    });
    return d;
  }

  /** Approve / reject / withdraw a decision. SAFETY: the OS itself
   *  never approves — only an external caller (human or
   *  DecisionAgent acting on a human directive) can. */
  resolveDecision(id: string, to: 'approved' | 'rejected' | 'withdrawn', approver_user_id: string | null): DecisionProposal | null {
    const d = this.decisions.get(id);
    if (!d) return null;
    if (d.status !== 'proposed') {
      throw new Error(`decision ${id} not in 'proposed' status (current: ${d.status})`);
    }
    const updated: DecisionProposal = {
      ...d,
      status:      to,
      approved_by: to === 'approved' ? approver_user_id : d.approved_by,
      approved_at: to === 'approved' ? new Date().toISOString() : d.approved_at,
    };
    this.decisions.set(id, updated);
    void this.hook?.saveDecision?.(updated);
    const evType: AgentEventType =
      to === 'approved'  ? 'decision.approved'
    : to === 'rejected'  ? 'decision.rejected'
    : 'decision.withdrawn';
    this.emit({
      tenant_id: d.tenant_id, event_type: evType,
      subject_type: 'decision', subject_id: id, agent: null,
      payload: { approver_user_id },
    });
    return updated;
  }

  listDecisions(filter: { tenant_id: string; status?: DecisionStatus }): DecisionProposal[] {
    return [...this.decisions.values()].filter(d => {
      if (d.tenant_id !== filter.tenant_id) return false;
      if (filter.status && d.status !== filter.status) return false;
      return true;
    });
  }

  // ── Inputs ─────────────────────────────────────────────────────

  recordInput(args: Omit<AgentInput, 'id' | 'received_at'>): AgentInput {
    const i: AgentInput = {
      id:           nextId('in'),
      ...args,
      source_id:    args.source_id ?? null,
      received_at:  new Date().toISOString(),
    };
    this.inputs.set(i.id, i);
    void this.hook?.saveInput?.(i);
    this.emit({
      tenant_id: i.tenant_id, event_type: 'input.received',
      subject_type: 'input', subject_id: i.id, agent: null,
      payload: { source: i.source, source_id: i.source_id },
    });
    return i;
  }

  // ── Outputs ────────────────────────────────────────────────────

  recordOutput(args: Omit<AgentOutputRecord, 'id' | 'produced_at'>): AgentOutputRecord {
    const o: AgentOutputRecord = {
      id:              nextId('out'),
      ...args,
      task_id:         args.task_id         ?? null,
      self_confidence: args.self_confidence ?? null,
      evidence:        args.evidence        ?? [],
      risk_dimensions: args.risk_dimensions ?? [],
      produced_at:     new Date().toISOString(),
    };
    this.outputs.set(o.id, o);
    void this.hook?.saveOutput?.(o);
    this.emit({
      tenant_id: o.tenant_id, event_type: 'output.produced',
      subject_type: 'output', subject_id: o.id, agent: o.agent,
      payload: { task_id: o.task_id, self_confidence: o.self_confidence, evidence_count: o.evidence.length },
    });
    return o;
  }

  listOutputsForTask(task_id: string): AgentOutputRecord[] {
    return [...this.outputs.values()].filter(o => o.task_id === task_id);
  }

  // ── Observations ───────────────────────────────────────────────

  recordObservation(args: Omit<AgentObservation, 'id' | 'created_at' | 'acknowledged'>): AgentObservation {
    const o: AgentObservation = {
      id:           nextId('obs'),
      ...args,
      detail:       args.detail ?? null,
      data:         args.data   ?? {},
      acknowledged: false,
      created_at:   new Date().toISOString(),
    };
    this.observations.set(o.id, o);
    void this.hook?.saveObservation?.(o);
    this.emit({
      tenant_id: o.tenant_id, event_type: 'observation.recorded',
      subject_type: 'observation', subject_id: o.id, agent: o.agent,
      payload: { category: o.category, severity: o.severity, title: o.title },
    });
    return o;
  }

  acknowledgeObservation(id: string): AgentObservation | null {
    const o = this.observations.get(id);
    if (!o) return null;
    if (o.acknowledged) return o;
    const updated = { ...o, acknowledged: true };
    this.observations.set(id, updated);
    void this.hook?.saveObservation?.(updated);
    this.emit({
      tenant_id: o.tenant_id, event_type: 'observation.acknowledged',
      subject_type: 'observation', subject_id: id, agent: null,
      payload: {},
    });
    return updated;
  }

  listObservations(filter: { tenant_id: string; acknowledged?: boolean; severity?: AgentObservation['severity'] }): AgentObservation[] {
    return [...this.observations.values()].filter(o => {
      if (o.tenant_id !== filter.tenant_id) return false;
      if (filter.acknowledged !== undefined && o.acknowledged !== filter.acknowledged) return false;
      if (filter.severity && o.severity !== filter.severity) return false;
      return true;
    });
  }

  // ── Events (the replay surface) ────────────────────────────────

  private emit(e: Omit<AgentEvent, 'id' | 'created_at'>): AgentEvent {
    _eventSeq += 1;
    const ev: AgentEvent = {
      id:         _eventSeq,
      ...e,
      created_at: new Date().toISOString(),
    };
    this.events.push(ev);
    void this.hook?.saveEvent?.(ev);
    return ev;
  }

  listEvents(filter: { tenant_id: string; subject_type?: AgentEvent['subject_type']; subject_id?: string; from_id?: number; limit?: number }): AgentEvent[] {
    const rows = this.events.filter(e => {
      if (e.tenant_id !== filter.tenant_id) return false;
      if (filter.subject_type && e.subject_type !== filter.subject_type) return false;
      if (filter.subject_id   && e.subject_id   !== filter.subject_id)   return false;
      if (filter.from_id !== undefined && e.id <= filter.from_id) return false;
      return true;
    });
    return filter.limit ? rows.slice(0, filter.limit) : rows;
  }

  // ── Test helper ────────────────────────────────────────────────

  __resetForTests(): void {
    this.memory.clear();
    this.tasks.clear();
    this.decisions.clear();
    this.inputs.clear();
    this.outputs.clear();
    this.observations.clear();
    this.events.length = 0;
    this.hook = null;
    _eventSeq = 0;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function isTerminal(s: TaskStatus): boolean {
  return s === 'done' || s === 'failed' || s === 'cancelled';
}

function mapTaskTransitionEvent(to: TaskStatus): AgentEventType {
  switch (to) {
    case 'in_progress': return 'task.started';
    case 'done':        return 'task.completed';
    case 'failed':      return 'task.failed';
    case 'blocked':     return 'task.blocked';
    case 'cancelled':   return 'task.cancelled';
    case 'open':        return 'task.unblocked';
  }
}
