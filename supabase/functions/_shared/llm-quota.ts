// LLM monthly quota + history helpers, shared by governance-agent/index.ts
// and unit tests. Pure-logic where possible; the Supabase admin client is
// passed as a structural parameter (`AdminLike`) so vitest can mock it
// without pulling in Deno-only specifiers.
//
// Backed by migration 20260609000000_llm_query_quota_history.sql:
//   - public.llm_quota_for_tenant(uuid)         → int  (-1 = unlimited)
//   - public.llm_quota_used_for_tenant(uuid)    → int  (current month)
//   - public.llm_quota_for_anon()               → int  (constant 10)
//   - public.llm_quota_used_for_anon(text)      → int  (current month)
//   - public.llm_query_history table            (RLS deny-by-default)

// Structural admin shape — mirrors what supabase-js admin client provides
// for the operations we use here. Tests pass a hand-rolled mock; the Edge
// Function passes the real createClient(SRK) instance.
export interface AdminLike {
  rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

// Result of a quota check. `allowed=true` means the caller should
// proceed with the LLM call; `allowed=false` carries the user-facing
// reason + the current used/cap state so the UI can render an
// honest "X/Y used" message.
export interface QuotaResult {
  allowed:   boolean;
  cap?:      number;   // -1 = unlimited
  used?:     number;
  reason?:   string;
  errorCode?: 'QUOTA_LOOKUP_FAILED' | 'QUOTA_EXCEEDED';
}

// Single-value-return shape — Supabase RPCs sometimes return the scalar
// directly, sometimes a single-row array. Normalize both.
function readScalarInt(data: unknown): number | null {
  if (typeof data === 'number') return data;
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') return data[0];
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0]) {
    const v = Object.values(data[0])[0];
    return typeof v === 'number' ? v : null;
  }
  return null;
}

export async function checkTenantQuota(
  admin: AdminLike,
  tenantId: string,
): Promise<QuotaResult> {
  const { data: capData, error: capErr } = await admin.rpc('llm_quota_for_tenant', { p_tenant_id: tenantId });
  if (capErr) {
    return { allowed: false, errorCode: 'QUOTA_LOOKUP_FAILED', reason: capErr.message };
  }
  const cap = readScalarInt(capData);
  if (cap === null) {
    return { allowed: false, errorCode: 'QUOTA_LOOKUP_FAILED', reason: 'no cap value' };
  }
  if (cap === -1) return { allowed: true, cap: -1, used: 0 };

  const { data: usedData, error: usedErr } = await admin.rpc('llm_quota_used_for_tenant', { p_tenant_id: tenantId });
  if (usedErr) {
    return { allowed: false, errorCode: 'QUOTA_LOOKUP_FAILED', reason: usedErr.message };
  }
  const used = readScalarInt(usedData) ?? 0;

  if (used >= cap) {
    return {
      allowed:   false,
      cap, used,
      errorCode: 'QUOTA_EXCEEDED',
      reason: `Monatslimit für LLM-Anfragen erreicht (${used}/${cap}).`,
    };
  }
  return { allowed: true, cap, used };
}

export async function checkAnonQuota(
  admin: AdminLike,
  ipHash: string,
): Promise<QuotaResult> {
  const { data: capData } = await admin.rpc('llm_quota_for_anon');
  const cap = readScalarInt(capData) ?? 10;
  if (cap === -1) return { allowed: true, cap: -1, used: 0 };

  const { data: usedData, error: usedErr } = await admin.rpc('llm_quota_used_for_anon', { p_ip_hash: ipHash });
  if (usedErr) {
    return { allowed: false, errorCode: 'QUOTA_LOOKUP_FAILED', reason: usedErr.message };
  }
  const used = readScalarInt(usedData) ?? 0;

  if (used >= cap) {
    return {
      allowed:   false,
      cap, used,
      errorCode: 'QUOTA_EXCEEDED',
      reason:    `Monatslimit für anonyme LLM-Anfragen erreicht (${used}/${cap}).`,
    };
  }
  return { allowed: true, cap, used };
}

export interface ChatHistoryRow {
  tenant_id?:        string | null;
  user_id?:          string | null;
  session_id?:       string | null;
  op:                'chat' | 'chat_anon';
  provider:          string;
  model:             string;
  query_text:        string;
  response_summary?: string | null;
  input_tokens?:     number | null;
  output_tokens?:    number | null;
  correlation_id?:   string | null;
}

// Best-effort write. Failures are returned, never thrown — the caller
// has already produced a user-visible response by the time this runs,
// so an audit-log miss MUST NOT bubble up. Caller may log the
// returned error to ops telemetry.
export async function recordChatHistory(
  admin: AdminLike,
  args: ChatHistoryRow,
): Promise<{ ok: boolean; error?: string }> {
  // Truncate the summary defensively so a runaway model output doesn't
  // produce 100KB rows that bloat the table.
  const summary = (args.response_summary ?? '').slice(0, 280) || null;
  // Truncate query_text too — UI list view never shows the full text.
  const queryText = (args.query_text ?? '').slice(0, 4000);

  // Sanity: the migration's CHECK enforces tenant_id OR session_id.
  // Reject early with a clear message so a programmer error here
  // produces a useful test failure instead of a Postgres CHECK error.
  if (!args.tenant_id && !args.session_id) {
    return { ok: false, error: 'tenant_id or session_id required' };
  }

  const { error } = await admin.from('llm_query_history').insert({
    tenant_id:        args.tenant_id        ?? null,
    user_id:          args.user_id          ?? null,
    session_id:       args.session_id       ?? null,
    op:               args.op,
    provider:         args.provider,
    model:            args.model,
    query_text:       queryText,
    response_summary: summary,
    input_tokens:     args.input_tokens     ?? null,
    output_tokens:    args.output_tokens    ?? null,
    correlation_id:   args.correlation_id   ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
