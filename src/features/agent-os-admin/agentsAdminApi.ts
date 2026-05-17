// Agent OS Admin — read-only data fetching against the AgentOS substrate.
//
// All queries are TENANT-SCOPED via RLS — the supabase-js client uses
// the user's session, so memberships-based row visibility filters
// results automatically. Server-side we still pass `tenant_id` so the
// query plan picks the partial indexes.

import { getSupabase } from '../../lib/supabase';

// ── Row shapes (mirror the substrate migration) ───────────────────

export interface AgentEventRow {
  id:           number;
  tenant_id:    string;
  event_type:   string;
  subject_type: string;
  subject_id:   string;
  agent:        string | null;
  payload:      Record<string, unknown>;
  created_at:   string;
}

export interface AgentTaskRow {
  id:             string;
  tenant_id:      string;
  agent:          string;
  task:           string;
  priority:       string;
  status:         string;
  input:          Record<string, unknown>;
  blocker_reason: string | null;
  created_at:     string;
  started_at:     string | null;
  completed_at:   string | null;
}

export interface AgentDecisionRow {
  id:             string;
  tenant_id:      string;
  decision_title: string;
  problem:        string;
  recommendation: string;
  risk_level:     'low' | 'medium' | 'high' | 'critical';
  reversibility:  'reversible' | 'partially_reversible' | 'irreversible';
  status:         'proposed' | 'approved' | 'rejected' | 'superseded' | 'withdrawn';
  proposed_by:    string;
  created_at:     string;
}

export interface AgentObservationRow {
  id:           string;
  tenant_id:    string;
  agent:        string;
  category:     string;
  severity:     'info' | 'low' | 'medium' | 'high' | 'critical';
  title:        string;
  detail:       string | null;
  acknowledged: boolean;
  created_at:   string;
}

export interface AgentMemoryRow {
  id:           string;
  tenant_id:    string;
  topic:        string;
  content:      string;
  tags:         string[];
  importance:   number;
  status:       'active' | 'superseded' | 'redacted';
  created_at:   string;
}

// ── Read API ──────────────────────────────────────────────────────

export async function listRecentEvents(tenant_id: string, limit = 50): Promise<AgentEventRow[]> {
  const { data, error } = await getSupabase()
    .from('agent_events')
    .select('id, tenant_id, event_type, subject_type, subject_id, agent, payload, created_at')
    .eq('tenant_id', tenant_id)
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentEventRow[];
}

export async function listOpenTasks(tenant_id: string, limit = 30): Promise<AgentTaskRow[]> {
  const { data, error } = await getSupabase()
    .from('agent_tasks')
    .select('id, tenant_id, agent, task, priority, status, input, blocker_reason, created_at, started_at, completed_at')
    .eq('tenant_id', tenant_id)
    .in('status', ['open', 'in_progress', 'blocked'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentTaskRow[];
}

export async function listProposedDecisions(tenant_id: string, limit = 20): Promise<AgentDecisionRow[]> {
  const { data, error } = await getSupabase()
    .from('agent_decisions')
    .select('id, tenant_id, decision_title, problem, recommendation, risk_level, reversibility, status, proposed_by, created_at')
    .eq('tenant_id', tenant_id)
    .eq('status', 'proposed')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentDecisionRow[];
}

export async function listActiveObservations(tenant_id: string, limit = 20): Promise<AgentObservationRow[]> {
  const { data, error } = await getSupabase()
    .from('agent_observations')
    .select('id, tenant_id, agent, category, severity, title, detail, acknowledged, created_at')
    .eq('tenant_id', tenant_id)
    .eq('acknowledged', false)
    .in('severity', ['medium', 'high', 'critical'])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentObservationRow[];
}

export async function listRecentMemory(tenant_id: string, limit = 15): Promise<AgentMemoryRow[]> {
  const { data, error } = await getSupabase()
    .from('agent_memory')
    .select('id, tenant_id, topic, content, tags, importance, status, created_at')
    .eq('tenant_id', tenant_id)
    .eq('status', 'active')
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AgentMemoryRow[];
}

// ── Counts for the top-strip ──────────────────────────────────────

export interface AgentOverviewCounts {
  open_tasks:           number;
  pending_decisions:    number;
  unack_observations:   number;
  active_memories:      number;
}

export async function getOverviewCounts(tenant_id: string): Promise<AgentOverviewCounts> {
  const supabase = getSupabase();
  const [tasks, decisions, observations, memory] = await Promise.all([
    supabase.from('agent_tasks').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id).in('status', ['open', 'in_progress', 'blocked']),
    supabase.from('agent_decisions').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id).eq('status', 'proposed'),
    supabase.from('agent_observations').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id).eq('acknowledged', false)
      .in('severity', ['high', 'critical']),
    supabase.from('agent_memory').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id).eq('status', 'active'),
  ]);
  return {
    open_tasks:         tasks.count        ?? 0,
    pending_decisions:  decisions.count    ?? 0,
    unack_observations: observations.count ?? 0,
    active_memories:    memory.count       ?? 0,
  };
}
