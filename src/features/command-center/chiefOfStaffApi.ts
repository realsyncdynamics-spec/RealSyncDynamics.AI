/**
 * Authenticated, read-only PostgREST adapter for the Agent OS operator inbox.
 *
 * Does not use service_role. Per-table RLS remains authoritative.
 * Additional membership/role check is intentional: the operator inbox is
 * restricted to owner/admin even when regular tenant members can read tables.
 *
 * Not yet wired to the app UI. No live deployment is implied by this module.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttentionItem, ChiefOfStaffInbox } from '../../core/agent-os/chiefOfStaff';

type CountKeys = ChiefOfStaffInbox['counts'];
type Priority = AttentionItem['priority'];

export interface PersistedChiefOfStaffInbox extends Omit<ChiefOfStaffInbox, 'source' | 'live_verified'> {
  source: 'supabase_agent_os';
  /** A successful authenticated DB read, not a claim of deployed UI. */
  live_verified: true;
  fetched_at: string;
}

export class ChiefOfStaffReadError extends Error {
  constructor(public readonly code: 'unauthorized' | 'forbidden' | 'invalid_tenant' | 'source_unavailable') {
    super(code);
    this.name = 'ChiefOfStaffReadError';
  }
}

interface TaskRow {
  id: string; agent: string; task: string; priority: string; status: string; created_at: string;
}
interface DecisionRow {
  id: string; proposed_by: string; decision_title: string; risk_level: string; created_at: string;
}
interface ObservationRow {
  id: string; agent: string; title: string; severity: string; created_at: string;
}
const VALID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, normal: 2 };

function safeLimit(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 25;
  return Math.max(1, Math.min(100, Math.trunc(n)));
}
function taskPriority(priority: string): Priority {
  return priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'normal';
}
function decisionPriority(priority: string): Priority {
  return priority === 'critical' ? 'critical' : priority === 'high' ? 'high' : 'normal';
}
function observationPriority(priority: string): Priority {
  return priority === 'critical' ? 'critical' : 'high';
}
function sourceCount(result: { count: number | null; error: { message: string } | null }, name: string): number {
  // Returning 0 for a failed count is dangerous: that hides real blockers.
  if (result.error || result.count === null || !Number.isInteger(result.count) || result.count < 0) {
    throw new ChiefOfStaffReadError('source_unavailable');
  }
  void name;
  return result.count;
}
function sourceRows<T>(result: { data: T[] | null; error: { message: string } | null }, name: string): T[] {
  if (result.error || !Array.isArray(result.data)) {
    throw new ChiefOfStaffReadError('source_unavailable');
  }
  void name;
  return result.data;
}

export async function loadPersistedChiefOfStaffInbox(
  client: SupabaseClient,
  tenant_id: string,
  opts: { max_items?: number } = {},
): Promise<PersistedChiefOfStaffInbox> {
  if (!VALID_UUID.test(tenant_id)) throw new ChiefOfStaffReadError('invalid_tenant');

  // getUser() validates the session with Auth; do not authorize from
  // unvalidated local getSession() claims or user_metadata.
  const { data: userResult, error: userError } = await client.auth.getUser();
  const user = userResult.user;
  if (userError || !user || user.is_anonymous) throw new ChiefOfStaffReadError('unauthorized');

  const { data: membership, error: membershipError } = await client.from('memberships')
    .select('role')
    .eq('tenant_id', tenant_id)
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  if (membershipError) throw new ChiefOfStaffReadError('source_unavailable');
  if (!membership || !['owner', 'admin'].includes(membership.role as string)) {
    throw new ChiefOfStaffReadError('forbidden');
  }

  const limit = safeLimit(opts.max_items);
  // Every query explicitly scopes tenant_id, in addition to RLS. Only
  // titles/ids/priorities are read; no task payloads, secrets or outputs.
  const [open, working, blocked, failed, tasks, decisions, alerts] = await Promise.all([
    client.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('status', 'open'),
    client.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('status', 'in_progress'),
    client.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('status', 'blocked'),
    client.from('agent_tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant_id).eq('status', 'failed'),
    client.from('agent_tasks')
      .select('id,agent,task,priority,status,created_at')
      .eq('tenant_id', tenant_id).in('status', ['blocked', 'failed'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false }).limit(limit),
    client.from('agent_decisions')
      .select('id,proposed_by,decision_title,risk_level,created_at', { count: 'exact' })
      .eq('tenant_id', tenant_id).eq('status', 'proposed')
      .order('risk_level', { ascending: true })
      .order('created_at', { ascending: false }).limit(limit),
    client.from('agent_observations')
      .select('id,agent,title,severity,created_at', { count: 'exact' })
      .eq('tenant_id', tenant_id).eq('acknowledged', false).in('severity', ['high', 'critical'])
      .order('severity', { ascending: true })
      .order('created_at', { ascending: false }).limit(limit),
  ]);

  const counts: CountKeys = {
    open_tasks: sourceCount(open, 'open tasks'),
    in_progress_tasks: sourceCount(working, 'working tasks'),
    blocked_tasks: sourceCount(blocked, 'blocked tasks'),
    failed_tasks: sourceCount(failed, 'failed tasks'),
    pending_decisions: sourceCount(decisions, 'proposed decisions'),
    unacknowledged_high_alerts: sourceCount(alerts, 'high alerts'),
    attention_total: 0,
  };
  counts.attention_total =
    counts.blocked_tasks + counts.failed_tasks + counts.pending_decisions + counts.unacknowledged_high_alerts;

  const attention: AttentionItem[] = [
    ...sourceRows<TaskRow>(tasks, 'tasks').map(t => ({
      id: t.id, kind: (t.status === 'failed' ? 'failed_task' : 'blocked_task') as AttentionItem['kind'],
      priority: taskPriority(t.priority), title: t.task, agent: t.agent, created_at: t.created_at,
    })),
    ...sourceRows<DecisionRow>(decisions, 'decisions').map(d => ({
      id: d.id, kind: 'pending_decision' as const,
      priority: decisionPriority(d.risk_level), title: d.decision_title,
      agent: d.proposed_by, created_at: d.created_at,
    })),
    ...sourceRows<ObservationRow>(alerts, 'alerts').map(a => ({
      id: a.id, kind: 'critical_observation' as const,
      priority: observationPriority(a.severity), title: a.title,
      agent: a.agent, created_at: a.created_at,
    })),
  ].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || b.created_at.localeCompare(a.created_at)
    || a.id.localeCompare(b.id));

  return {
    tenant_id,
    source: 'supabase_agent_os',
    live_verified: true,
    fetched_at: new Date().toISOString(),
    counts,
    items: attention.slice(0, limit),
    truncated: counts.attention_total > limit,
  };
}
