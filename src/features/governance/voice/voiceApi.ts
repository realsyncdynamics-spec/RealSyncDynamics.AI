/**
 * Read-only Supabase reads for governed voice sessions.
 *
 * Auth: anon/publishable key + user JWT (via getSupabase()).
 * Tenant: every query requires an explicit tenantId from the verified
 * membership context (useTenant().activeTenantId) — never from URL,
 * query params, or localStorage. RLS additionally enforces
 * is_tenant_member(tenant_id). No service_role in the browser.
 *
 * Tables: voice_sessions, voice_tool_requests, voice_executions,
 * voice_evidence. Does NOT touch voice_channels / bot_agents.
 */
import { getSupabase } from '../../../lib/supabase';

export type VoiceSessionStatus =
  | 'idle'
  | 'consent_required'
  | 'listening'
  | 'transcribing'
  | 'reasoning'
  | 'policy_check'
  | 'awaiting_confirmation'
  | 'speaking'
  | 'killed'
  | 'rate_limited'
  | 'ended'
  | 'failed';

export type VoiceProviderId = 'grok' | 'openai' | 'gemini' | 'claude' | 'custom';

export type VoicePolicyVerdict = 'ALLOW' | 'DENY' | 'REQUIRE_CONFIRMATION';

export type VoiceRisk = 'low' | 'medium' | 'high';

export type VoiceExecutionStatus = 'pending' | 'succeeded' | 'failed' | 'timeout';

export type VoiceVerificationStatus = 'unverified' | 'confirmed' | 'mismatch' | 'failed';

export interface VoiceSessionRow {
  id: string;
  bot_id: string;
  provider: VoiceProviderId | string;
  model: string;
  status: VoiceSessionStatus | string;
  disclosure_played_at: string | null;
  kill_switch: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface VoiceToolRequestRow {
  id: string;
  session_id: string;
  tool: string;
  verdict: VoicePolicyVerdict | null;
  risk: VoiceRisk | null;
  decided_at: string | null;
  confirmed_at: string | null;
}

export interface VoiceExecutionRow {
  id: string;
  tool_request_id: string;
  status: VoiceExecutionStatus | string;
  verification_status: VoiceVerificationStatus | string;
}

export interface VoiceEvidenceRow {
  id: string;
  session_id: string;
  seq: number;
  kind: string;
  prev_hash: string;
  hash: string;
  created_at: string;
}

const SESSION_COLUMNS =
  'id, bot_id, provider, model, status, disclosure_played_at, kill_switch, started_at, ended_at';

const TOOL_REQUEST_COLUMNS =
  'id, session_id, tool, verdict, risk, decided_at, confirmed_at';

const EXECUTION_COLUMNS = 'id, tool_request_id, status, verification_status';

const EVIDENCE_COLUMNS = 'id, session_id, seq, kind, prev_hash, hash, created_at';

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

function requireTenantId(tenantId: string | null | undefined): string {
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new Error('Kein aktiver Mandant — Voice-Daten werden nicht geladen.');
  }
  return tenantId;
}

/**
 * Tenant voice sessions, newest first.
 * Throws if tenantId is missing — callers must not fetch without a tenant.
 */
export async function listVoiceSessions(
  tenantId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<VoiceSessionRow[]> {
  const tid = requireTenantId(tenantId);
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const offset = Math.max(opts.offset ?? 0, 0);
  const sb = getSupabase();
  const { data, error } = await sb
    .from('voice_sessions')
    .select(SESSION_COLUMNS)
    .eq('tenant_id', tid)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as VoiceSessionRow[];
}

/** Single session scoped to tenant. null if not found / not visible. */
export async function getVoiceSession(
  tenantId: string,
  sessionId: string,
): Promise<VoiceSessionRow | null> {
  const tid = requireTenantId(tenantId);
  if (!sessionId) throw new Error('Session-ID fehlt.');
  const sb = getSupabase();
  const { data, error } = await sb
    .from('voice_sessions')
    .select(SESSION_COLUMNS)
    .eq('tenant_id', tid)
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as VoiceSessionRow | null) ?? null;
}

export async function listVoiceToolRequests(
  tenantId: string,
  sessionId: string,
): Promise<VoiceToolRequestRow[]> {
  const tid = requireTenantId(tenantId);
  const sb = getSupabase();
  const { data, error } = await sb
    .from('voice_tool_requests')
    .select(TOOL_REQUEST_COLUMNS)
    .eq('tenant_id', tid)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VoiceToolRequestRow[];
}

export async function listVoiceExecutionsForRequests(
  tenantId: string,
  toolRequestIds: string[],
): Promise<VoiceExecutionRow[]> {
  const tid = requireTenantId(tenantId);
  if (toolRequestIds.length === 0) return [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('voice_executions')
    .select(EXECUTION_COLUMNS)
    .eq('tenant_id', tid)
    .in('tool_request_id', toolRequestIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as VoiceExecutionRow[];
}

export async function listVoiceEvidence(
  tenantId: string,
  sessionId: string,
): Promise<VoiceEvidenceRow[]> {
  const tid = requireTenantId(tenantId);
  const sb = getSupabase();
  const { data, error } = await sb
    .from('voice_evidence')
    .select(EVIDENCE_COLUMNS)
    .eq('tenant_id', tid)
    .eq('session_id', sessionId)
    .order('seq', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as VoiceEvidenceRow[];
}

export interface VoiceSessionDetail {
  session: VoiceSessionRow;
  toolRequests: VoiceToolRequestRow[];
  executionsByRequestId: Record<string, VoiceExecutionRow>;
  evidence: VoiceEvidenceRow[];
}

export async function loadVoiceSessionDetail(
  tenantId: string,
  sessionId: string,
): Promise<VoiceSessionDetail | null> {
  const session = await getVoiceSession(tenantId, sessionId);
  if (!session) return null;
  const toolRequests = await listVoiceToolRequests(tenantId, sessionId);
  const executions = await listVoiceExecutionsForRequests(
    tenantId,
    toolRequests.map((r) => r.id),
  );
  const executionsByRequestId: Record<string, VoiceExecutionRow> = {};
  for (const ex of executions) {
    executionsByRequestId[ex.tool_request_id] = ex;
  }
  const evidence = await listVoiceEvidence(tenantId, sessionId);
  return { session, toolRequests, executionsByRequestId, evidence };
}

/** Shorten a 64-hex digest for display (monospace metadata). */
export function shortenHash(hash: string, head = 8, tail = 6): string {
  if (typeof hash !== 'string' || hash.length < head + tail + 1) return hash || '—';
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
