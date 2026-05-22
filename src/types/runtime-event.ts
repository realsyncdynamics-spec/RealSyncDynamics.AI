/**
 * RuntimeEvent — gemeinsame interne Sprache der Governance Runtime.
 *
 * Alle Agenten (Drift, AI-Risk, Evidence, Policy), Scanner (gdpr-audit,
 * cookie-scanner, ai-endpoint-probe) und Evidence-Flows EMITTIEREN
 * RuntimeEvents. Die Surfaces (Dashboards, Audit-Result-Views, Triage)
 * KONSUMIEREN sie.
 *
 * Versionierung:
 *  - v0.1 (initial): minimal envelope — id, type, source, severity, payload, …
 *  - v0.2 (Operational Governance Kernel RFC §P0.2): optional kernel-v1
 *    envelope fields — event_tier, subject_ref, agent_ref, trace_id,
 *    retention_class, replayable, cost_snapshot. Defaults bleiben kompatibel,
 *    Konsumenten muessen `spec_version` pruefen bevor sie kernel-v1 Felder
 *    lesen. Bei unbekannter Version: log + skip (kein hard reject).
 *
 * Der schreibseitige Tier-Discipline-Enforcement (event_tier ist Pflicht,
 * Tier-Whitelist greift) kommt in P0-impl-3 (Edge-Function `governance-event`).
 * Dieses Modul stellt nur das Vokabular.
 */

export type RuntimeSpecVersion = '0.1' | '0.2';

export type RuntimeSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type RuntimeReviewStatus =
  | 'not_required'
  | 'review_required'
  | 'in_review'
  | 'approved'
  | 'rejected';

export type RuntimeEventSource =
  | 'browser_collector'
  | 'network_collector'
  | 'ai_probe'
  | 'policy_engine'
  | 'evidence_engine'
  | 'governance_agent'
  | 'audit_ui'
  | 'system';

export type RuntimeEventType =
  | 'scan.started'
  | 'scan.completed'
  | 'scan.failed'
  | 'tracker.detected'
  | 'tracker.pre_consent_detected'
  | 'consent.banner_detected'
  | 'consent.reject_missing'
  | 'header.missing'
  | 'form.email_detected'
  | 'vendor.detected'
  | 'vendor.unknown_detected'
  | 'ai.endpoint_found'
  | 'ai.risk_classified'
  | 'policy.violation_detected'
  | 'evidence.created'
  | 'remediation.suggested'
  | 'incident.opened'
  | 'incident.closed';

/**
 * Kernel-v1 envelope (RFC §P0.2). T0=audit-critical, T1=replay-relevant,
 * T2=operational, T3=ephemeral/debug. Mirrored to runtime_events.event_tier
 * CHECK constraint.
 */
export type RuntimeEventTier = 'T0' | 'T1' | 'T2' | 'T3';

/**
 * Retention bucket (RFC §P0.4). Mirrored to runtime_events.retention_class
 * CHECK constraint.
 */
export type RuntimeRetentionClass =
  | 'forever'
  | '7y'
  | '3y'
  | '1y'
  | '90d'
  | '30d'
  | '7d'
  | 'ephemeral';

/**
 * Cost snapshot — captured in T0/T1 events that cause cost (RFC §P4.4).
 * Doppelt geschrieben: hier am Event (fuer Replay-Diff) und parallel in
 * tenant_cost_ledger (fuer Aggregation + Cap-Enforcement).
 */
export interface RuntimeCostSnapshot {
  model_ref?: string;
  input_tokens?: number;
  output_tokens?: number;
  input_usd?: number;
  output_usd?: number;
  total_usd: number;
  vendor?: string;
}

export interface RuntimeEvidenceRef {
  id: string;
  type:
    | 'dom_snapshot'
    | 'network_request'
    | 'header_snapshot'
    | 'cookie_snapshot'
    | 'ai_trace'
    | 'policy_output'
    | 'audit_bundle';
  sha256?: string;
  url?: string;
  created_at: string;
}

export interface RuntimeActor {
  type: 'system' | 'agent' | 'user' | 'api';
  id?: string;
  name?: string;
}

/**
 * Generische Payload-Hülle. Konsumenten typisieren mit konkretem T
 * (z. B. `RuntimeEvent<TrackerDetectedPayload>`) — der gemeinsame
 * Default `Record<string, unknown>` haelt das Modul payload-agnostisch.
 */
export type RuntimeEventPayload<T = Record<string, unknown>> = T;

export interface RuntimeEvent<T = Record<string, unknown>> {
  id: string;
  spec_version: RuntimeSpecVersion;
  tenant_id?: string;
  session_id?: string;
  correlation_id?: string;
  causation_id?: string;
  type: RuntimeEventType;
  source: RuntimeEventSource;
  severity: RuntimeSeverity;
  actor: RuntimeActor;
  payload: RuntimeEventPayload<T>;
  evidence_refs?: RuntimeEvidenceRef[];
  review_status: RuntimeReviewStatus;
  created_at: string;

  // Kernel-v1 envelope (v0.2 — optional). Konsumenten muessen spec_version
  // pruefen bevor sie diese Felder als gesetzt voraussetzen.
  event_tier?: RuntimeEventTier;
  subject_ref?: string;       // HMAC-hashed — NEVER plain text
  agent_ref?: string;         // '<agent_type>:<agent_id>:<version>'
  trace_id?: string;          // end-to-end DAG correlation
  retention_class?: RuntimeRetentionClass;
  replayable?: boolean;       // T2/T3 MUST be false; T0/T1 MAY be true
  cost_snapshot?: RuntimeCostSnapshot;
}

/**
 * Erzeugt ein RuntimeEvent mit sensiblen Defaults.
 *
 * - `id` faellt auf `crypto.randomUUID()` zurueck, sonst Math.random-hex.
 * - `spec_version` defaultet auf '0.2' (kernel-v1-aware). Explizit '0.1'
 *   kann gesetzt werden für Producer die das envelope-Upgrade noch nicht
 *   leisten.
 * - `created_at` ist `new Date().toISOString()`.
 * - `severity` defaultet auf 'info'.
 * - `review_status` defaultet auf 'not_required'.
 *
 * Was die Funktion ABSICHTLICH NICHT tut:
 * - keine DB-Schreibung
 * - keine AJV-/Schema-Validation
 * - kein Network-Call
 * - kein event_tier-Default — Tier-Discipline greift erst in P0-impl-3
 *   im writer-pfad. Hier bleibt das Feld optional.
 */
export function createRuntimeEvent<T = Record<string, unknown>>(
  input: Omit<RuntimeEvent<T>, 'id' | 'spec_version' | 'created_at' | 'severity' | 'review_status'> & {
    id?: string;
    spec_version?: RuntimeSpecVersion;
    severity?: RuntimeSeverity;
    review_status?: RuntimeReviewStatus;
  },
): RuntimeEvent<T> {
  return {
    id: input.id ?? generateId(),
    spec_version: input.spec_version ?? '0.2',
    tenant_id: input.tenant_id,
    session_id: input.session_id,
    correlation_id: input.correlation_id,
    causation_id: input.causation_id,
    type: input.type,
    source: input.source,
    severity: input.severity ?? 'info',
    actor: input.actor,
    payload: input.payload,
    evidence_refs: input.evidence_refs,
    review_status: input.review_status ?? 'not_required',
    created_at: new Date().toISOString(),
    event_tier: input.event_tier,
    subject_ref: input.subject_ref,
    agent_ref: input.agent_ref,
    trace_id: input.trace_id,
    retention_class: input.retention_class,
    replayable: input.replayable,
    cost_snapshot: input.cost_snapshot,
  };
}

/**
 * `crypto.randomUUID()` ist Standard in modernen Browsern und in Node 19+,
 * aber wir wollen nicht crashen, falls das Modul in einem aelteren
 * Test-Runner oder einer minimal-Edge-Sandbox laeuft. Fallback ist ein
 * Math.random-basierter hex string. KEIN Sicherheits-Versprechen.
 */
function generateId(): string {
  if (typeof globalThis !== 'undefined') {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
  }
  // Fallback: 8-4-4-4-12 hex layout — KEIN echtes UUIDv4, KEIN Crypto-Anspruch.
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
}
