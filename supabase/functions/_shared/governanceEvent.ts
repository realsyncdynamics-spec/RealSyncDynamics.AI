// Governance Event ingest helpers — shared between the Edge Function
// (`supabase/functions/governance-event/index.ts`) and the vitest parity
// suite. Pure functions only; no Deno globals so this file can be loaded
// from the app's vite/vitest pipeline too.
//
// SOURCE OF TRUTH for the schema is `src/core/runtime/governanceEvents.ts`.
// If you add or rename an event here, mirror it there in the same PR.
// The parity test in `test/edge/governance-event.test.ts` will fail
// otherwise.

// ─── Vocabulary (mirrors src/core/runtime/governanceEvents.ts) ──────────────

export const GOVERNANCE_EVENT_NAMES = [
  'tracker.pre_consent.detected',
  'tracker.removed',
  'consent.banner.detected',
  'consent.violated',
  'vendor.added',
  'vendor.dpa.missing',
  'ai.system.detected',
  'ai.risk.classified',
  'drift.detected',
  'incident.opened',
  'incident.resolved',
  'evidence.sealed',
] as const;

export type GovernanceEventName = (typeof GOVERNANCE_EVENT_NAMES)[number];

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ACTOR_SOURCES = [
  'browser_collector',
  'playwright_scanner',
  'edge_function',
  'ai_telemetry_sdk',
  'cms_connector',
  'agent',
  'human',
] as const;
export type ActorSource = (typeof ACTOR_SOURCES)[number];

const NAME_SET: ReadonlySet<string> = new Set(GOVERNANCE_EVENT_NAMES);
const SEVERITY_SET: ReadonlySet<string> = new Set(SEVERITIES);
const ACTOR_SOURCE_SET: ReadonlySet<string> = new Set(ACTOR_SOURCES);

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

export interface IngestPayload {
  name: string;
  tenant_id?: string;
  severity?: string;
  actor?: { source?: string; id?: string };
  target?: string;
  occurred_at?: string;
  evidence?: { hash?: string; uri?: string };
  replay_id?: string;
  payload?: Record<string, unknown>;
}

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validates an ingest payload. Tenant id is checked against `tenantId`
 * (the authenticated tenant from the request header) — payload tenant
 * id, if present, MUST match.
 */
export function validateIngestPayload(
  body: unknown,
  tenantId: string,
): readonly ValidationError[] {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== 'object') {
    return [{ path: '', message: 'body must be an object' }];
  }
  const p = body as IngestPayload;

  if (typeof p.name !== 'string' || !NAME_SET.has(p.name))
    errors.push({ path: 'name', message: `unknown event name: ${p.name}` });

  if (p.tenant_id !== undefined && p.tenant_id !== tenantId)
    errors.push({ path: 'tenant_id', message: 'tenant_id mismatch with auth' });

  if (!p.target || typeof p.target !== 'string')
    errors.push({ path: 'target', message: 'required' });

  if (typeof p.severity !== 'string' || !SEVERITY_SET.has(p.severity))
    errors.push({ path: 'severity', message: `unknown severity: ${p.severity}` });

  if (!p.actor || typeof p.actor !== 'object')
    errors.push({ path: 'actor', message: 'required' });
  else {
    if (typeof p.actor.source !== 'string' || !ACTOR_SOURCE_SET.has(p.actor.source))
      errors.push({ path: 'actor.source', message: `unknown source: ${p.actor.source}` });
    if (typeof p.actor.id !== 'string' || !p.actor.id)
      errors.push({ path: 'actor.id', message: 'required' });
  }

  if (typeof p.occurred_at !== 'string' || !ISO_8601.test(p.occurred_at))
    errors.push({ path: 'occurred_at', message: 'must be ISO-8601' });

  if (p.evidence) {
    if (typeof p.evidence.hash !== 'string' || !SHA256_HEX.test(p.evidence.hash))
      errors.push({ path: 'evidence.hash', message: 'must be 64-char lowercase hex' });
  }

  if (p.name === 'evidence.sealed' && !p.evidence)
    errors.push({ path: 'evidence', message: 'required for evidence.sealed' });

  if (p.payload !== undefined && (typeof p.payload !== 'object' || Array.isArray(p.payload)))
    errors.push({ path: 'payload', message: 'must be a plain object' });

  return errors;
}

// ─── Canonical hashing (mirrors src/core/runtime/evidence.ts) ───────────────

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalize: non-finite number');
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = normalize(v);
  return out;
}

export async function hashBody(body: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(body));
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('hashBody: Web Crypto SubtleCrypto unavailable');
  const digest = await subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < view.length; i += 1) out += view[i].toString(16).padStart(2, '0');
  return out;
}

// ─── Row builder for runtime_events ─────────────────────────────────────────

export interface RuntimeEventRow {
  tenant_id: string;
  execution_id: null;
  agent_id: string | null;
  skill_id: null;
  name: string;
  payload: Record<string, unknown>;
  occurred_at: string;
}

/**
 * Builds the row to insert into `runtime_events`. Hashes the inner body
 * deterministically; if the caller supplied an `evidence.hash`, it MUST
 * match — otherwise the receiver and sender disagree on what was sent.
 */
export async function buildRuntimeEventRow(
  payload: IngestPayload,
  tenantId: string,
): Promise<{ row: RuntimeEventRow; bodyHash: string }> {
  const bodyHash = await hashBody(payload.payload ?? {});

  if (payload.evidence?.hash && payload.evidence.hash !== bodyHash) {
    throw new Error(
      `evidence.hash mismatch: caller=${payload.evidence.hash} computed=${bodyHash}`,
    );
  }

  const agentId =
    payload.actor?.source === 'agent' && payload.actor.id ? payload.actor.id : null;

  return {
    bodyHash,
    row: {
      tenant_id: tenantId,
      execution_id: null,
      agent_id: agentId,
      skill_id: null,
      name: payload.name,
      occurred_at: payload.occurred_at!,
      payload: {
        severity: payload.severity,
        actor: payload.actor,
        target: payload.target,
        replay_id: payload.replay_id,
        evidence: {
          hash: bodyHash,
          uri: payload.evidence?.uri,
        },
        body: payload.payload ?? {},
      },
    },
  };
}
