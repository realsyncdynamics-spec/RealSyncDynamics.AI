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

// ── Anon (public) chat ────────────────────────────────────────────────────────

export type SimpleMsg = { role: 'user' | 'assistant'; content: string };

export interface AnonChatResponse {
  ok: boolean;
  session_id: string;
  response: string;
  history: SimpleMsg[];
  tokens?: { input: number; output: number };
}

export type AnonChatResult =
  | { kind: 'ok'; data: AnonChatResponse }
  | { kind: 'rate_limited' }
  | { kind: 'us_routing_required' }
  | { kind: 'llm_not_configured' }
  | { kind: 'error'; error: AgentError };

export async function sendChatAnon(args: {
  session_id: string;
  message: string;
  history: SimpleMsg[];
  acknowledge_us_routing?: boolean;
}): Promise<AnonChatResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-agent', {
    body: { op: 'chat_anon', ...args },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) return { kind: 'rate_limited' };
    if (status === 412) return { kind: 'us_routing_required' };
    if (status === 503) return { kind: 'llm_not_configured' };
    return { kind: 'error', error: { code: 'NETWORK', message: error.message ?? 'network error' } };
  }

  const body = data as AnonChatResponse | { ok: false; error: AgentError };
  if (body.ok === false && 'error' in body && body.error) {
    return { kind: 'error', error: (body as { ok: false; error: AgentError }).error };
  }
  return { kind: 'ok', data: body as AnonChatResponse };
}

/**
 * Anon-Tool: start_audit_scan({ url, email })
 *
 * Ruft den governance-agent op='start_audit_scan' auf. Phase 3 liefert
 * einen Mock-Queued-Status — der echte Scan-Worker konsumiert die queued
 * Eintraege erst spaeter (siehe Edge-Function-Kommentar).
 *
 * Wieso ein eigenes Tool statt direkter Call an gdpr-audit?
 *   - Die LLM-Tool-Vertragsoberflaeche soll uniform sein: alle Tools
 *     gehen ueber governance-agent.
 *   - So kann der AssistentChip im anon-Modus spaeter den Tool-Call
 *     autonom triggern (LLM-tool-use), ohne neue Endpoints anzufassen.
 */

export interface AnonAuditScanResponse {
  ok: true;
  status: 'queued';
  audit_id: string;
  url_normalized: string;
  hint: string;
}

export type AnonAuditScanResult =
  | { kind: 'ok'; data: AnonAuditScanResponse }
  | { kind: 'rate_limited' }
  | { kind: 'invalid'; error: AgentError }
  | { kind: 'error'; error: AgentError };

export async function startAuditScanAnon(args: {
  url: string;
  email: string;
}): Promise<AnonAuditScanResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-agent', {
    body: { op: 'start_audit_scan', ...args },
  });

  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) return { kind: 'rate_limited' };
    if (status === 400) return { kind: 'invalid', error: { code: 'BAD_REQUEST', message: error.message ?? 'invalid input' } };
    return { kind: 'error', error: { code: 'NETWORK', message: error.message ?? 'network error' } };
  }

  const body = data as AnonAuditScanResponse | { ok: false; error: AgentError };
  if (body.ok === false && 'error' in body && body.error) {
    return { kind: 'error', error: (body as { ok: false; error: AgentError }).error };
  }
  return { kind: 'ok', data: body as AnonAuditScanResponse };
}
