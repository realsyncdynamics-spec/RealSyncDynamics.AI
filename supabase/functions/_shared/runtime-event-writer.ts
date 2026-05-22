// Kernel-v1 RuntimeEvent writer with tier-discipline enforcement.
//
// P0-impl-3 of the Operational Governance Kernel RFC (§P0.2, §6).
//
// Single canonical write path for kernel-v1 (spec_version='0.2') events.
// All future kernel-aware producers (governance-event Edge Function,
// agent runtime writers, anon-audit adapters, ...) call writeKernelV1Event()
// instead of `admin.from('runtime_events').insert(...)`.
//
// What this enforces BEFORE the row reaches the DB:
//   1. event_tier is required and within the T0..T3 whitelist
//   2. T2 / T3 events MUST have replayable = false (RFC §P0.2 hard rule)
//   3. retention_class is required and within the documented whitelist
//   4. subject_ref MUST NOT contain raw email- or IP-like patterns (no
//      plaintext leak — must be HMAC output from supabase/functions/_shared/subject-ref.ts)
//   5. spec_version is locked to '0.2' for this writer (legacy v0.1 writers
//      keep using their direct insert path)
//   6. event_type is required (free-form, granular identifier)
//
// What this does NOT do:
//   - Schema migration (lives in 20260608000000_runtime_events_v02_tier_required.sql)
//   - Cost-ledger mirror (P4-impl-2)
//   - shadow_runtime_events routing (P1-impl-1/2)
//   - Computing subject_ref — caller passes a pre-derived HMAC value
//
// Pure helper: no Deno-only imports so vitest can load it directly.

export type EventTier = 'T0' | 'T1' | 'T2' | 'T3';

export type RetentionClass =
  | 'forever'
  | '7y'
  | '3y'
  | '1y'
  | '90d'
  | '30d'
  | '7d'
  | 'ephemeral';

export interface KernelV1Event {
  tenant_id:        string;
  event_type:       string;
  event_tier:       EventTier;
  retention_class:  RetentionClass;
  replayable?:      boolean;
  // Legacy `name` is reused for the v0.1-compat field; new writers can set
  // it equal to event_type. The DB column is still NOT NULL on legacy
  // schema, so we default it from event_type if the caller omits it.
  name?:            string;
  occurred_at?:     string;
  payload?:         Record<string, unknown>;
  // Kernel-v1 envelope (all optional except event_tier + retention_class):
  subject_ref?:     string;
  agent_ref?:       string;
  trace_id?:        string;
  correlation_id?:  string;
  causation_id?:    number;
  cost_snapshot?:   Record<string, unknown>;
  // Legacy linkage to existing executor pipeline (back-compat with
  // SupabaseEventLog producers).
  execution_id?:    string;
  agent_id?:        string;
  skill_id?:        string;
}

export class TierDisciplineError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TierDisciplineError';
  }
}

// Loose admin shape — see comments in subject-ref.ts.
// deno-lint-ignore no-explicit-any
export type AdminClient = any;

const TIER_SET     = new Set<EventTier>(['T0', 'T1', 'T2', 'T3']);
const RETENTION_SET = new Set<RetentionClass>([
  'forever', '7y', '3y', '1y', '90d', '30d', '7d', 'ephemeral',
]);

// Anti-leak patterns for subject_ref. The HMAC output is hex (64 chars
// from sha256). Anything matching an email or IPv4 in the input is a
// programmer error — refuse rather than persist.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const IPV4_RE  = /(?:^|[^0-9])(?:\d{1,3}\.){3}\d{1,3}(?:[^0-9]|$)/;
// Hex output of the subject-ref helper is exactly 64 lowercase hex chars.
const HEX64_RE = /^[0-9a-f]{64}$/;

export function validateKernelV1Event(ev: KernelV1Event): void {
  if (!ev.tenant_id || ev.tenant_id.length === 0) {
    throw new TierDisciplineError('TENANT_REQUIRED', 'tenant_id is required');
  }
  if (!ev.event_type || ev.event_type.length === 0) {
    throw new TierDisciplineError('EVENT_TYPE_REQUIRED', 'event_type is required');
  }
  if (!ev.event_tier || !TIER_SET.has(ev.event_tier)) {
    throw new TierDisciplineError(
      'EVENT_TIER_INVALID',
      `event_tier must be one of T0/T1/T2/T3 (got: ${String(ev.event_tier)})`,
    );
  }
  if (!ev.retention_class || !RETENTION_SET.has(ev.retention_class)) {
    throw new TierDisciplineError(
      'RETENTION_CLASS_INVALID',
      `retention_class must be one of forever/7y/3y/1y/90d/30d/7d/ephemeral (got: ${String(ev.retention_class)})`,
    );
  }
  // T2 / T3 MUST NOT be replayable. Mirror of RFC §P0.2 + DB CHECK
  // runtime_events_replayable_tier_check.
  if (
    (ev.event_tier === 'T2' || ev.event_tier === 'T3')
    && ev.replayable === true
  ) {
    throw new TierDisciplineError(
      'REPLAYABLE_FORBIDDEN_FOR_TIER',
      `replayable=true is forbidden for tier ${ev.event_tier} (RFC §P0.2)`,
    );
  }
  // subject_ref anti-leak guards.
  if (ev.subject_ref !== undefined) {
    if (ev.subject_ref.length === 0) {
      throw new TierDisciplineError(
        'SUBJECT_REF_EMPTY',
        'subject_ref must be omitted or a non-empty HMAC hex string',
      );
    }
    if (EMAIL_RE.test(ev.subject_ref)) {
      throw new TierDisciplineError(
        'SUBJECT_REF_LOOKS_LIKE_EMAIL',
        'subject_ref appears to contain a plaintext email — must be HMAC output',
      );
    }
    if (IPV4_RE.test(ev.subject_ref)) {
      throw new TierDisciplineError(
        'SUBJECT_REF_LOOKS_LIKE_IP',
        'subject_ref appears to contain a plaintext IPv4 — must be HMAC output',
      );
    }
    if (!HEX64_RE.test(ev.subject_ref)) {
      throw new TierDisciplineError(
        'SUBJECT_REF_NOT_HEX64',
        'subject_ref must be a 64-character lowercase hex string (HMAC-SHA-256 output)',
      );
    }
  }
}

/**
 * Validate the event and persist it to public.runtime_events with
 * spec_version='0.2'. Throws TierDisciplineError on validation failure
 * BEFORE any DB call; throws a plain Error on DB insert failure.
 */
export async function writeKernelV1Event(
  admin: AdminClient,
  ev:    KernelV1Event,
): Promise<void> {
  validateKernelV1Event(ev);

  const row: Record<string, unknown> = {
    tenant_id:       ev.tenant_id,
    name:            ev.name ?? ev.event_type, // legacy NOT NULL
    event_type:      ev.event_type,
    event_tier:      ev.event_tier,
    retention_class: ev.retention_class,
    spec_version:    '0.2',
    occurred_at:     ev.occurred_at ?? new Date().toISOString(),
    payload:         ev.payload ?? {},
  };
  // Replayable: default true at the type level (RFC §P0.2), but for T2/T3
  // we already enforced false above. For T0/T1, default to false here too —
  // it is safer than implicit-true; callers wanting replay opt in.
  row.replayable = ev.replayable ?? false;

  if (ev.subject_ref    !== undefined) row.subject_ref    = ev.subject_ref;
  if (ev.agent_ref      !== undefined) row.agent_ref      = ev.agent_ref;
  if (ev.trace_id       !== undefined) row.trace_id       = ev.trace_id;
  if (ev.correlation_id !== undefined) row.correlation_id = ev.correlation_id;
  if (ev.causation_id   !== undefined) row.causation_id   = ev.causation_id;
  if (ev.cost_snapshot  !== undefined) row.cost_snapshot_json = ev.cost_snapshot;
  if (ev.execution_id   !== undefined) row.execution_id   = ev.execution_id;
  if (ev.agent_id       !== undefined) row.agent_id       = ev.agent_id;
  if (ev.skill_id       !== undefined) row.skill_id       = ev.skill_id;

  const { error } = await admin.from('runtime_events').insert(row);
  if (error) {
    throw new Error(`writeKernelV1Event insert failed: ${error.message}`);
  }
}

// Internal exports for tests — DO NOT use from production code.
export const __internals = { EMAIL_RE, IPV4_RE, HEX64_RE };
