// Security-Gate audit helper for the anon path of governance-agent.
//
// Contract:
//   - reserveAnonAudit() THROWS on insert failure. Callers must turn this
//     into an immediate 503 response; the anon work MUST NOT proceed.
//   - completeAnonAudit() is fire-and-forget for outcome metadata. Failure
//     here does not block the response — the reservation row is already
//     persisted, so the audit trail exists (outcome stays 'pending', which
//     incident-review can detect).
//
// Pure-helper design so vitest can import it without a Deno runtime.

export type AnonOp =
  | 'chat_anon'
  | 'start_audit_scan'
  | 'explain_finding'
  | 'generate_fix_snippet';

export type AnonOutcome =
  | 'pending'
  | 'success'
  | 'error'
  | 'rate_limited'
  | 'blocked';

export interface AnonAuditReservation {
  request_id: string;
  op:                     AnonOp;
  ip_hash:                string;
  user_agent_hash?:       string;
  acknowledge_us_routing?: boolean;
  session_id?:            string;
  correlation_id?:        string;
  payload_keys?:          string[];
}

export interface AnonAuditCompletion {
  outcome:       Exclude<AnonOutcome, 'pending'>;
  model?:        string;
  input_tokens?: number;
  output_tokens?: number;
  error_code?:   string;
  duration_ms?:  number;
}

// Minimal subset of the supabase-js admin client we depend on. Typed loose on
// purpose so this module stays portable between Deno (Edge Function) and
// node (vitest with mocked clients).
export interface AdminLike {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    update(patch: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Reserve an audit row in 'pending' outcome BEFORE the anon work runs.
 * Throws on DB failure — caller MUST translate to 503 and refuse the request.
 */
export async function reserveAnonAudit(
  admin: AdminLike,
  reservation: AnonAuditReservation,
): Promise<void> {
  const row: Record<string, unknown> = {
    request_id:             reservation.request_id,
    op:                     reservation.op,
    ip_hash:                reservation.ip_hash,
    outcome:                'pending',
  };
  if (reservation.user_agent_hash       !== undefined) row.user_agent_hash       = reservation.user_agent_hash;
  if (reservation.acknowledge_us_routing !== undefined) row.acknowledge_us_routing = reservation.acknowledge_us_routing;
  if (reservation.session_id            !== undefined) row.session_id            = reservation.session_id;
  if (reservation.correlation_id        !== undefined) row.correlation_id        = reservation.correlation_id;
  if (reservation.payload_keys          !== undefined) row.payload_keys          = reservation.payload_keys;

  const { error } = await admin.from('anon_chat_runs').insert(row);
  if (error) {
    throw new Error(`anon audit reserve failed: ${error.message}`);
  }
}

/**
 * Update the previously reserved row with the final outcome. Fire-and-forget:
 * a failure here is logged but does not propagate. The reservation already
 * gives us a row; an unfinalised row (outcome='pending') is itself a
 * detectable incident signal.
 */
export async function completeAnonAudit(
  admin:     AdminLike,
  requestId: string,
  patch:     AnonAuditCompletion,
): Promise<void> {
  const update: Record<string, unknown> = { outcome: patch.outcome };
  if (patch.model         !== undefined) update.model         = patch.model;
  if (patch.input_tokens  !== undefined) update.input_tokens  = patch.input_tokens;
  if (patch.output_tokens !== undefined) update.output_tokens = patch.output_tokens;
  if (patch.error_code    !== undefined) update.error_code    = patch.error_code;
  if (patch.duration_ms   !== undefined) update.duration_ms   = patch.duration_ms;

  try {
    const { error } = await admin
      .from('anon_chat_runs')
      .update(update)
      .eq('request_id', requestId);
    if (error) {
      // Swallow but surface via console — incident-review reads logs too.
      console.error('anon audit complete failed:', error.message, 'request_id=', requestId);
    }
  } catch (e) {
    console.error('anon audit complete threw:', (e as Error).message, 'request_id=', requestId);
  }
}

/**
 * Stable extractor for top-level body keys. NEVER returns values — only
 * key names that callers may pass through to payload_keys.
 */
export function extractPayloadKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body).sort();
}
