// Governed AI Routing Layer (R2) — Evidence/Observability sink (Deno-only I/O).
//
// Thin glue that persists a gateway call to public.ai_tool_runs. The row is
// built by the pure mapper in observability.ts; this module only owns the
// side effect (service-role insert). Server-only — mirrors the admin-client
// pattern used in ai-gateway/index.ts (readVaultSecret) and _shared/ai.ts.
//
// Design invariants:
//   - Fire-and-forget: never throws, never blocks the response's success. A
//     failed audit insert must not turn a successful inference into an error.
//   - Flag-gated by the caller: index.ts only calls this when GOVERNED_ROUTING
//     is on, so with the flag off there is zero behaviour change (no client
//     built, no insert attempted).
//   - Skips silently when there is no tenant_id (toToolRunRow returns null) or
//     when Supabase env is absent.

import type { AiGatewayRequest } from './types.ts';
import { toToolRunRow, type GatewayCallOutcome } from './observability.ts';

let cachedAdmin: unknown = null;

async function getAdmin(): Promise<{ from: (t: string) => { insert: (row: unknown) => Promise<unknown> } } | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return null;
  if (cachedAdmin) return cachedAdmin as never;
  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    cachedAdmin = createClient(url, srk, { auth: { persistSession: false } });
    return cachedAdmin as never;
  } catch {
    return null;
  }
}

/**
 * Record one gateway call to ai_tool_runs. Best-effort: any failure is
 * swallowed after a console.error so inference is never affected. Returns
 * true only when a row was actually inserted (useful for tests/metrics).
 */
export async function recordGatewayCall(
  request: AiGatewayRequest,
  outcome: GatewayCallOutcome,
): Promise<boolean> {
  try {
    const row = toToolRunRow(request, outcome);
    if (!row) return false; // no tenant_id → nothing to log
    const admin = await getAdmin();
    if (!admin) return false; // env not configured → skip silently
    const res = (await admin.from('ai_tool_runs').insert(row)) as { error?: unknown };
    if (res?.error) {
      console.error('ai-gateway observability insert failed', res.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('ai-gateway observability sink error', (e as Error)?.message ?? e);
    return false;
  }
}
