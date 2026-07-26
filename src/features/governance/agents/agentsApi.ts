// Frontend wrapper around the Enterprise AI OS agent Edge Functions.
//
// - Run:   POST enterprise-ai-os-agents-run         (public, via functions.invoke)
// - Runs:  GET  enterprise-ai-os-agent-runs-list    (public, via fetch + query)
//
// Die Agenten-Definitionen kommen aus der lokalen Registry
// (src/lib/enterprise-ai-os/agents/registry.ts) — kein Netzwerk nötig.

import { getSupabase } from '../../../lib/supabase';
import { enterpriseAgents } from '../../../lib/enterprise-ai-os/agents/registry';
import type {
  AgentId,
  AgentAutonomyLevel,
  AgentStatus,
} from '../../../lib/enterprise-ai-os/agents/types';

export { enterpriseAgents };
export type { AgentId };

export interface AgentRunResult {
  agentId: AgentId;
  status: 'success' | 'blocked' | 'requires_approval' | 'error';
  summary: string;
  findings: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  run_id: string | null;
  persist_error: string | null;
}

export interface AgentRunRow {
  id: string;
  tenant_id: string | null;
  agent_id: string;
  actor: string;
  status: string;
  summary: string;
  created_at: string;
  // Full run detail (returned by enterprise-ai-os-agent-runs-list). Optional so
  // older cached responses without these fields still typecheck.
  findings?: Array<Record<string, unknown>>;
  recommendations?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export const AUTONOMY_LABELS: Record<AgentAutonomyLevel, string> = {
  observe_only: 'Nur Beobachten',
  recommend_only: 'Nur Empfehlen',
  human_approval_required: 'Freigabe erforderlich',
  limited_execution: 'Begrenzte Ausführung',
};

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  experimental: 'Experimentell',
  requires_configuration: 'Konfiguration nötig',
};

/**
 * Adapts a stored history row into the AgentRunResult shape rendered by
 * AgentRunOutput, so a past run can be re-opened from the history list.
 * Missing detail fields (older rows) degrade to empty lists.
 */
export function runRowToResult(row: AgentRunRow): AgentRunResult {
  return {
    agentId: row.agent_id as AgentId,
    status: (row.status as AgentRunResult['status']) ?? 'success',
    summary: row.summary ?? '',
    findings: row.findings ?? [],
    recommendations: row.recommendations ?? [],
    auditEvents: [],
    metadata: row.metadata ?? {},
    run_id: row.id,
    persist_error: null,
  };
}

/** Calls `enterprise-ai-os-agents-run`. */
export async function runAgent(input: {
  agentId: AgentId;
  tenantId?: string;
  actor?: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string; result?: AgentRunResult }> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('enterprise-ai-os-agents-run', {
    body: {
      agentId: input.agentId,
      tenantId: input.tenantId,
      actor: input.actor ?? 'dashboard-user',
      payload: input.payload ?? {},
    },
  });
  if (error) return { ok: false, error: error.message };
  const result = data as AgentRunResult;
  if (result.status === 'error') {
    return { ok: false, error: result.summary || 'Agent-Lauf fehlgeschlagen', result };
  }
  return { ok: true, result };
}

/**
 * Calls `enterprise-ai-os-agent-runs-list` (GET). Optional tenant filter and
 * limit. Returns the most recent runs ordered newest first.
 */
export async function fetchAgentRuns(tenantId?: string, limit = 25): Promise<AgentRunRow[]> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) throw new Error('Supabase nicht konfiguriert');
  const url = new URL(`${base}/functions/v1/enterprise-ai-os-agent-runs-list`);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return (body.runs ?? []) as AgentRunRow[];
}
