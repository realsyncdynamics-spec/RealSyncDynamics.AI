// Client wrapper around the `governance-agent` Edge Function (PR #154).
//
// The function does the heavy lifting (Anthropic tool-use loop, session
// persistence, audit-log). The client just shapes the request and
// surfaces structured errors so the widget can route them — 412 means
// the user has to acknowledge the US-routing notice.

import { getSupabase } from '../../../lib/supabase';

export interface AgentToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  iter: number;
}

export interface ChatResponse {
  ok: boolean;
  session_id: string;
  response: string;
  tool_calls: number;
  actions_taken: string[];
  outcome: 'success' | 'tool_error' | 'llm_error' | 'budget_exceeded' | 'timeout';
  error?: string | null;
  tokens?: { input: number; output: number };
  duration_ms?: number;
}

export interface AgentError {
  code: string;
  message: string;
}

export type ChatResult =
  | { kind: 'ok'; data: ChatResponse }
  | { kind: 'us_routing_required' }
  | { kind: 'llm_not_configured'; message: string }
  | { kind: 'forbidden' }
  | { kind: 'error'; error: AgentError };

export async function sendChat(args: {
  tenant_id: string;
  message: string;
  session_id?: string;
  acknowledge_us_routing?: boolean;
}): Promise<ChatResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-agent', {
    body: { op: 'chat', ...args },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    const msg = error.message ?? 'network error';
    if (status === 412) return { kind: 'us_routing_required' };
    if (status === 503) return { kind: 'llm_not_configured', message: msg };
    if (status === 403) return { kind: 'forbidden' };
    return { kind: 'error', error: { code: 'NETWORK', message: msg } };
  }

  const body = data as ChatResponse | { ok: false; error: AgentError };
  if (body.ok === false && 'error' in body && body.error && typeof body.error === 'object') {
    return { kind: 'error', error: body.error };
  }
  return { kind: 'ok', data: body as ChatResponse };
}

export async function resetSession(tenant_id: string, session_id: string): Promise<void> {
  const sb = getSupabase();
  await sb.functions.invoke('governance-agent', {
    body: { op: 'reset', tenant_id, session_id },
  });
}

export interface AgentRun {
  id: string;
  session_id: string | null;
  user_message: string;
  final_response: string | null;
  outcome: string;
  tool_calls: AgentToolCall[];
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  created_at: string;
}

export async function fetchAgentRuns(tenant_id: string, limit = 20): Promise<AgentRun[]> {
  const sb = getSupabase();
  const { data } = await sb.functions.invoke('governance-agent', {
    body: { op: 'history', tenant_id, limit },
  });
  const body = data as { ok: boolean; runs?: AgentRun[] };
  return body.runs ?? [];
}
