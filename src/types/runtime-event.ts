/**
 * RuntimeEvent — gemeinsame interne Sprache der Governance Runtime.
 *
 * Alle Agenten (Drift, AI-Risk, Evidence, Policy), Scanner (gdpr-audit,
 * cookie-scanner, ai-endpoint-probe) und Evidence-Flows EMITTIEREN
 * RuntimeEvents. Die Surfaces (Dashboards, Audit-Result-Views, Triage)
 * KONSUMIEREN sie.
 *
 * Phase 1 (dieses Modul): pures Type-Layer. KEINE DB-Schreibops, KEIN
 * Ingest-Reject, KEINE AJV-Validation, KEIN Verhalten — nur Vokabular
 * und ein Konstruktions-Helper.
 *
 * Versionierung: spec_version='0.1'. Konsumenten muessen die Version
 * pruefen, bevor sie auf payload-Felder zugreifen. Bei unbekannter
 * Version: log + skip (kein hard reject). Der Rollout-Plan zur strikten
 * Validation steht in docs/architecture/runtime-event-standard.md.
 */

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
  spec_version: '0.1';
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
}

/**
 * Erzeugt ein RuntimeEvent mit sensiblen Defaults.
 *
 * - `id` faellt auf `crypto.randomUUID()` zurueck, sonst Math.random-hex.
 * - `spec_version` ist immer '0.1' (Konstante des Moduls).
 * - `created_at` ist `new Date().toISOString()`.
 * - `severity` defaultet auf 'info'.
 * - `review_status` defaultet auf 'not_required'.
 *
 * Was die Funktion ABSICHTLICH NICHT tut:
 * - keine DB-Schreibung
 * - keine AJV-/Schema-Validation
 * - kein Network-Call
 *
 * Die Validation folgt in einem spaeteren PR (Phase 2: shadow validation).
 */
export function createRuntimeEvent<T = Record<string, unknown>>(
  input: Omit<RuntimeEvent<T>, 'id' | 'spec_version' | 'created_at' | 'severity' | 'review_status'> & {
    id?: string;
    severity?: RuntimeSeverity;
    review_status?: RuntimeReviewStatus;
  },
): RuntimeEvent<T> {
  return {
    id: input.id ?? generateId(),
    spec_version: '0.1',
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
