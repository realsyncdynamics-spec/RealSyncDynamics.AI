/**
 * Chief-of-Staff read model for Agent OS (M0).
 *
 * Purely read-only, tenant-scoped, and intentionally not an execution engine.
 * No background scheduler, auto-approval, notifications or external API calls.
 * The caller MUST authorize tenant access before calling this function.
 * Source: AgentOsStore (Phase A in-memory); DB integration is a separate step.
 */
import type { AgentOsStore } from './store';
import type { AgentObservation, AgentTask, DecisionProposal, TaskPriority } from './types';

export type AttentionKind = 'critical_observation' | 'pending_decision' | 'blocked_task' | 'failed_task';
export type AttentionPriority = 'critical' | 'high' | 'normal';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  priority: AttentionPriority;
  title: string;
  agent: string;
  created_at: string;
}

export interface ChiefOfStaffInbox {
  tenant_id: string;
  source: 'agent_os_store';
  /** This is a local read model, NOT evidence that production is wired. */
  live_verified: false;
  counts: {
    open_tasks: number;
    in_progress_tasks: number;
    blocked_tasks: number;
    failed_tasks: number;
    pending_decisions: number;
    unacknowledged_high_alerts: number;
    attention_total: number;
  };
  items: AttentionItem[];
  truncated: boolean;
}

const RANK: Record<AttentionPriority, number> = { critical: 0, high: 1, normal: 2 };
function taskPriority(p: TaskPriority): AttentionPriority {
  return p === 'critical' ? 'critical' : p === 'high' ? 'high' : 'normal';
}
function taskItem(t: AgentTask): AttentionItem {
  return {
    id: t.id, kind: t.status === 'failed' ? 'failed_task' : 'blocked_task',
    priority: taskPriority(t.priority), title: t.task, agent: t.agent, created_at: t.created_at,
  };
}
function decisionItem(d: DecisionProposal): AttentionItem {
  return {
    id: d.id, kind: 'pending_decision',
    priority: d.risk_level === 'critical' ? 'critical' : d.risk_level === 'high' ? 'high' : 'normal',
    title: d.decision_title, agent: d.proposed_by, created_at: d.created_at,
  };
}
function observationItem(o: AgentObservation): AttentionItem {
  return {
    id: o.id, kind: 'critical_observation',
    priority: o.severity === 'critical' ? 'critical' : 'high',
    title: o.title, agent: o.agent, created_at: o.created_at,
  };
}

function assertTenant(tenant_id: string): void {
  if (!tenant_id.trim()) throw new Error('tenant_id is required');
}

/**
 * Presents only real blockers, human decisions and unacknowledged high/critical
 * alerts. Open tasks are counted, but omitted from the attention list to avoid
 * flooding the operator. All reads are explicitly tenant-filtered.
 */
export function buildChiefOfStaffInbox(
  store: Pick<AgentOsStore, 'listTasks' | 'listDecisions' | 'listObservations'>,
  tenant_id: string,
  opts: { max_items?: number } = {},
): ChiefOfStaffInbox {
  assertTenant(tenant_id);
  const tasks = store.listTasks({ tenant_id });
  const decisions = store.listDecisions({ tenant_id, status: 'proposed' });
  const alerts = store.listObservations({ tenant_id, acknowledged: false })
    .filter(o => o.severity === 'high' || o.severity === 'critical');
  const blocked = tasks.filter(t => t.status === 'blocked');
  const failed = tasks.filter(t => t.status === 'failed');
  const all = [
    ...alerts.map(observationItem),
    ...decisions.map(decisionItem),
    ...blocked.map(taskItem),
    ...failed.map(taskItem),
  ].sort((a, b) =>
    RANK[a.priority] - RANK[b.priority] ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id),
  );
  const requested = opts.max_items ?? 25;
  const max_items = Number.isFinite(requested) ? Math.max(1, Math.min(100, Math.trunc(requested))) : 25;
  return {
    tenant_id,
    source: 'agent_os_store',
    live_verified: false,
    counts: {
      open_tasks: tasks.filter(t => t.status === 'open').length,
      in_progress_tasks: tasks.filter(t => t.status === 'in_progress').length,
      blocked_tasks: blocked.length,
      failed_tasks: failed.length,
      pending_decisions: decisions.length,
      unacknowledged_high_alerts: alerts.length,
      attention_total: all.length,
    },
    items: all.slice(0, max_items),
    truncated: all.length > max_items,
  };
}

export interface AgentTaskReportCard {
  tenant_id: string;
  agent: string;
  tasks: { open: number; in_progress: number; blocked: number; done: number; failed: number };
  /** Only an observed task-outcome ratio; NOT an independent quality score. */
  observed_completion_rate: number | null;
  quality_score: null;
  cost_usd: null;
  coverage: 'task_store_only';
}

/**
 * Evidence-aware weekly report-card foundation. No fabricated token usage,
 * costs, model quality, success rate for zero terminal tasks, or /10 grades.
 */
export function buildAgentTaskReportCards(
  store: Pick<AgentOsStore, 'listTasks'>,
  tenant_id: string,
): AgentTaskReportCard[] {
  assertTenant(tenant_id);
  const byAgent = new Map<string, AgentTaskReportCard>();
  for (const t of store.listTasks({ tenant_id })) {
    if (t.status === 'cancelled') continue;
    let row = byAgent.get(t.agent);
    if (!row) {
      row = {
        tenant_id, agent: t.agent,
        tasks: { open: 0, in_progress: 0, blocked: 0, done: 0, failed: 0 },
        observed_completion_rate: null, quality_score: null, cost_usd: null,
        coverage: 'task_store_only',
      };
      byAgent.set(t.agent, row);
    }
    row.tasks[t.status] += 1;
  }
  return [...byAgent.values()].map(row => {
    const terminal = row.tasks.done + row.tasks.failed;
    return {
      ...row,
      observed_completion_rate: terminal > 0 ? row.tasks.done / terminal : null,
    };
  }).sort((a, b) => a.agent.localeCompare(b.agent));
}
