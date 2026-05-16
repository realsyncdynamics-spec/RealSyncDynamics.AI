/**
 * Governance Event Schema (frozen — Phase A).
 *
 * Two event families live in this codebase:
 *
 *   1. Lifecycle events (see `types.ts` → `RuntimeEventName`):
 *      `execution.started`, `approval.granted`, … — what the *runtime*
 *      does internally.
 *
 *   2. Governance signals (this file): `tracker.pre_consent.detected`,
 *      `vendor.added`, `consent.violated`, … — what the *customer's
 *      system* did, observed by our agents/collectors.
 *
 * Both persist into `public.runtime_events`. The `name` column carries
 * the event identifier; `payload` carries the discriminated body. The
 * mapper at the bottom of this file converts a typed governance event
 * into the shape required by the existing `RuntimeEvent` envelope so
 * subscribers/storage stay uniform.
 *
 * Changing any of the names, severities or payload shapes is a
 * BREAKING change to the customer evidence trail. Add new events;
 * never silently retype an existing one.
 */

import type { RuntimeEvent } from './types';

// ─── Vocabulary ─────────────────────────────────────────────────────────────

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Where the signal came from. */
export type ActorSource =
  | 'browser_collector'
  | 'playwright_scanner'
  | 'edge_function'
  | 'ai_telemetry_sdk'
  | 'cms_connector'
  | 'agent'
  | 'human';

export interface ActorRef {
  source: ActorSource;
  /** Stable id within the source (agent id, user id, scanner id…). */
  id: string;
}

export interface EvidenceRef {
  /** Hex-encoded SHA-256 of the canonical evidence body. */
  hash: string;
  /** Where the raw evidence lives. URI scheme is implementation-defined
   *  (e.g. `s3://…`, `supabase://bucket/path`, `inline:`). */
  uri?: string;
}

// ─── Event union ────────────────────────────────────────────────────────────

/**
 * Frozen names. Namespace = domain. Suffix describes the verb in past
 * tense ("happened"). All new events MUST follow this convention.
 */
export type GovernanceEventName =
  | 'tracker.pre_consent.detected'
  | 'tracker.removed'
  | 'consent.banner.detected'
  | 'consent.violated'
  | 'vendor.added'
  | 'vendor.dpa.missing'
  | 'ai.system.detected'
  | 'ai.risk.classified'
  | 'drift.detected'
  | 'incident.opened'
  | 'incident.resolved'
  | 'evidence.sealed';

interface BaseGovernanceEvent {
  tenant_id: string;
  severity: Severity;
  actor: ActorRef;
  /** Customer-facing target the signal is about (host, system, vendor). */
  target: string;
  /** ISO-8601. Set by the emitter. */
  occurred_at: string;
  /** Optional evidence pointer. Required for `evidence.sealed`. */
  evidence?: EvidenceRef;
  /** Optional id for grouping retries / replays of the same logical signal. */
  replay_id?: string;
}

// Discriminated payloads. Keep these tight — every field must justify
// its existence in the customer evidence trail.

export interface TrackerPreConsentDetected extends BaseGovernanceEvent {
  name: 'tracker.pre_consent.detected';
  payload: {
    tracker: string;
    request_url: string;
    consent_state: 'no_banner' | 'banner_shown_not_accepted' | 'rejected';
  };
}

export interface TrackerRemoved extends BaseGovernanceEvent {
  name: 'tracker.removed';
  payload: { tracker: string; remediation_id: string };
}

export interface ConsentBannerDetected extends BaseGovernanceEvent {
  name: 'consent.banner.detected';
  payload: { vendor: string; version?: string; framework?: 'iab_tcf' | 'custom' };
}

export interface ConsentViolated extends BaseGovernanceEvent {
  name: 'consent.violated';
  payload: { rule_id: string; description: string };
}

export interface VendorAdded extends BaseGovernanceEvent {
  name: 'vendor.added';
  payload: { vendor: string; first_seen_url: string };
}

export interface VendorDpaMissing extends BaseGovernanceEvent {
  name: 'vendor.dpa.missing';
  payload: { vendor: string };
}

export interface AiSystemDetected extends BaseGovernanceEvent {
  name: 'ai.system.detected';
  payload: { provider: string; model?: string; endpoint?: string };
}

export interface AiRiskClassified extends BaseGovernanceEvent {
  name: 'ai.risk.classified';
  payload: {
    system_id: string;
    classification: 'minimal' | 'limited' | 'high' | 'prohibited';
    rationale: string;
  };
}

export interface DriftDetected extends BaseGovernanceEvent {
  name: 'drift.detected';
  payload: { rule_id: string; before: unknown; after: unknown };
}

export interface IncidentOpened extends BaseGovernanceEvent {
  name: 'incident.opened';
  payload: { incident_id: string; rule_id: string; sla_hours: number };
}

export interface IncidentResolved extends BaseGovernanceEvent {
  name: 'incident.resolved';
  payload: { incident_id: string; resolution: string };
}

export interface EvidenceSealed extends BaseGovernanceEvent {
  name: 'evidence.sealed';
  /** `evidence` is required for this event. */
  evidence: EvidenceRef;
  payload: { event_count: number; bundle_period_start: string; bundle_period_end: string };
}

export type GovernanceEvent =
  | TrackerPreConsentDetected
  | TrackerRemoved
  | ConsentBannerDetected
  | ConsentViolated
  | VendorAdded
  | VendorDpaMissing
  | AiSystemDetected
  | AiRiskClassified
  | DriftDetected
  | IncidentOpened
  | IncidentResolved
  | EvidenceSealed;

// ─── Validation ─────────────────────────────────────────────────────────────

const KNOWN_NAMES: ReadonlySet<GovernanceEventName> = new Set<GovernanceEventName>([
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
]);

const KNOWN_SEVERITIES: ReadonlySet<Severity> = new Set<Severity>([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

const KNOWN_ACTOR_SOURCES: ReadonlySet<ActorSource> = new Set<ActorSource>([
  'browser_collector',
  'playwright_scanner',
  'edge_function',
  'ai_telemetry_sdk',
  'cms_connector',
  'agent',
  'human',
]);

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export type ValidationError = { path: string; message: string };

/**
 * Validates a governance event without throwing. Returns the list of
 * errors found. Empty list = valid.
 *
 * Intentionally hand-rolled to keep `src/core/runtime/` dependency-free.
 */
export function validateGovernanceEvent(
  event: GovernanceEvent,
): readonly ValidationError[] {
  const errors: ValidationError[] = [];

  if (!event.tenant_id) errors.push({ path: 'tenant_id', message: 'required' });
  if (!event.target) errors.push({ path: 'target', message: 'required' });
  if (!KNOWN_NAMES.has(event.name))
    errors.push({ path: 'name', message: `unknown name: ${event.name}` });
  if (!KNOWN_SEVERITIES.has(event.severity))
    errors.push({ path: 'severity', message: `unknown severity: ${event.severity}` });
  if (!event.actor || !KNOWN_ACTOR_SOURCES.has(event.actor.source))
    errors.push({ path: 'actor.source', message: 'unknown or missing source' });
  if (!event.actor || !event.actor.id)
    errors.push({ path: 'actor.id', message: 'required' });
  if (!ISO_8601.test(event.occurred_at))
    errors.push({ path: 'occurred_at', message: 'must be ISO-8601' });

  if (event.evidence) {
    if (!SHA256_HEX.test(event.evidence.hash))
      errors.push({ path: 'evidence.hash', message: 'must be 64-char lowercase hex' });
  }

  if (event.name === 'evidence.sealed' && !event.evidence) {
    errors.push({ path: 'evidence', message: 'required for evidence.sealed' });
  }

  return errors;
}

/** Throws `GovernanceEventValidationError` if invalid. */
export function assertValidGovernanceEvent(event: GovernanceEvent): void {
  const errors = validateGovernanceEvent(event);
  if (errors.length > 0) {
    throw new GovernanceEventValidationError(errors);
  }
}

export class GovernanceEventValidationError extends Error {
  constructor(readonly errors: readonly ValidationError[]) {
    super(
      `Invalid governance event: ${errors
        .map((e) => `${e.path}: ${e.message}`)
        .join('; ')}`,
    );
    this.name = 'GovernanceEventValidationError';
  }
}

// ─── Mapping to runtime envelope ────────────────────────────────────────────

/**
 * Maps a typed governance event onto the existing `RuntimeEvent` envelope
 * used by the event bus and `runtime_events` table. The lifecycle event
 * names in `RuntimeEventName` and the governance event names in
 * `GovernanceEventName` share a namespace deliberately — both end up in
 * the same append-only log.
 *
 * We cast the name through `unknown` because `RuntimeEvent.name` is the
 * lifecycle union; the storage layer accepts any string and discriminates
 * by the `.` prefix at read time.
 */
export function toRuntimeEvent(event: GovernanceEvent): RuntimeEvent {
  return {
    name: event.name as unknown as RuntimeEvent['name'],
    tenant_id: event.tenant_id,
    payload: {
      severity: event.severity,
      actor: event.actor,
      target: event.target,
      evidence: event.evidence,
      replay_id: event.replay_id,
      body: event.payload,
    },
    occurred_at: event.occurred_at,
  };
}
