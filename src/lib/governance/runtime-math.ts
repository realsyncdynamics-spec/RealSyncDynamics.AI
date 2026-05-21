/**
 * Pure governance-runtime helpers — TypeScript-mirrors der SQL-Formeln aus
 * SPEC-001 / RFC-002 / RFC-003 / RFC-004. Diese Funktionen sind die
 * verbindliche Referenz für Producer- und Konsumenten-Code; CI-Tests
 * vergleichen sie gegen SQL-Outputs (siehe test/runtime/).
 *
 * KEINE DB-Zugriffe, KEINE Side-Effects. Determinismus ist Vertrag —
 * dasselbe Input ⇒ exakt dasselbe Output, in TS und in SQL.
 */

// ============================================================
// SPEC-001 — Canonical bytes for hash chain
// ============================================================

export interface RuntimeEventEnvelope {
  id: string;
  tenant_id: string;
  global_seq: number;
  tenant_seq: number;
  spec_version: string;
  ts: string; // ISO-8601 UTC
  type: string;
  severity: string;
  source: string;
  review_status: string;
  subject_ref: string | null;
  payload: unknown;
  evidence_refs: unknown[];
  trace_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  prev_hash: Uint8Array | null;
}

/**
 * Canonical UTF-8 bytes der Event-Envelope, exakt wie
 * public.runtime_events_canonical_bytes(). Wenn diese Funktion drift't,
 * driftet die gesamte Hash-Chain.
 *
 * Schlüssel-Reihenfolge ist explizit definiert (NICHT Object-Property-
 * Insert-Order vertrauen — V8 garantiert das, andere Engines nicht
 * unbedingt). JSON.stringify mit eigenem Replacer für stabile Reihenfolge.
 */
export function canonicalEventBytes(e: RuntimeEventEnvelope): Uint8Array {
  // Postgres-Format: 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' — 6 stellige Mikrosekunden
  const tsCanonical = toPgMicroIso(e.ts);

  const ordered: Record<string, unknown> = {
    id: e.id,
    tenant_id: e.tenant_id,
    global_seq: e.global_seq,
    tenant_seq: e.tenant_seq,
    spec_version: e.spec_version,
    ts: tsCanonical,
    type: e.type,
    severity: e.severity,
    source: e.source,
    review_status: e.review_status,
    subject_ref: e.subject_ref,
    payload: e.payload,
    evidence_refs: e.evidence_refs,
    trace_id: e.trace_id,
    correlation_id: e.correlation_id,
    causation_id: e.causation_id,
    prev_hash: e.prev_hash ? bytesToHex(e.prev_hash) : null,
  };

  const json = stableStringify(ordered);
  return new TextEncoder().encode(json);
}

/**
 * Stabile JSON-Serialisierung: Schlüssel werden bei jedem Object-Level
 * alphabetisch sortiert. Postgres' jsonb_build_object → ::text sortiert
 * auch — diese Funktion spiegelt das.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}

function toPgMicroIso(iso: string): string {
  // Akzeptiert "2026-05-21T10:00:00Z" / "...000Z" / "...000000Z" und
  // normalisiert auf 6 Mikrosekunden-Stellen UTC.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`canonicalEventBytes: invalid ts ${iso}`);
  }
  const ms = d.getUTCMilliseconds().toString().padStart(3, '0');
  return (
    d.getUTCFullYear().toString().padStart(4, '0') +
    '-' +
    (d.getUTCMonth() + 1).toString().padStart(2, '0') +
    '-' +
    d.getUTCDate().toString().padStart(2, '0') +
    'T' +
    d.getUTCHours().toString().padStart(2, '0') +
    ':' +
    d.getUTCMinutes().toString().padStart(2, '0') +
    ':' +
    d.getUTCSeconds().toString().padStart(2, '0') +
    '.' +
    ms +
    '000Z'
  );
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// RFC-002 — Subject-Ref canonicalization
// ============================================================

/**
 * Identical zu `public.subject_ref_compute()` (RFC-002 §13.1):
 *   message = subject_kind + '\x1f' + lower(trim(value))
 * Output ist die HMAC-Input-Message — NICHT die HMAC selbst (die braucht
 * den Vault-Key und läuft serverseitig).
 */
export function subjectRefCanonicalMessage(
  subjectKind: string,
  value: string,
): Uint8Array {
  const normalized = value.trim().toLowerCase();
  return new TextEncoder().encode(subjectKind + '\x1f' + normalized);
}

// ============================================================
// RFC-004 — Risk scoring math
// ============================================================

export interface RiskComponents {
  /** 0..100 */ consent: number;
  /** 0..100 */ aiLoop: number;
  /** 0..100 */ memoryInflation: number;
  /** 0..100 */ incident: number;
}

/**
 * Tenant Risk Score — Gewichte aus RFC-004 §2.1.
 * Output ist auf 2 Nachkommastellen gerundet, exakt wie ::numeric(5,2).
 */
export function tenantRiskScore(c: RiskComponents): number {
  const raw =
    0.3 * clamp(c.consent, 0, 100) +
    0.2 * clamp(c.aiLoop, 0, 100) +
    0.2 * clamp(c.memoryInflation, 0, 100) +
    0.3 * clamp(c.incident, 0, 100);
  return roundTo(raw, 2);
}

export interface SubjectRiskInputs {
  /** 0..100 */ consent: number;
  /** 0..100 */ incident: number;
  /** 0..100 */ velocity: number;
}

/** Subject Risk Score — RFC-004 §2.2. */
export function subjectRiskScore(s: SubjectRiskInputs): number {
  const raw =
    0.4 * clamp(s.consent, 0, 100) +
    0.4 * clamp(s.incident, 0, 100) +
    0.2 * clamp(s.velocity, 0, 100);
  return roundTo(raw, 2);
}

// ============================================================
// RFC-004 Part C — RACPO + Quadrant
// ============================================================

export interface RacpoInputs {
  /** raw cost per completed outcome in USD */
  rawCostPerCompleted: number;
  /** 0..100 */ tenantRiskScore: number;
  /** 0..100 */ incidentPressure: number;
}

/** Risk-Adjusted Cost per Outcome — RFC-004 §8.1. */
export function racpo(i: RacpoInputs): number {
  const factor =
    (1 + clamp(i.tenantRiskScore, 0, 100) / 100) *
    (1 + clamp(i.incidentPressure, 0, 100) / 100);
  return roundTo(i.rawCostPerCompleted * factor, 6);
}

export type Quadrant =
  | 'reserved_capacity'
  | 'investigate'
  | 'premium_review'
  | 'red_alert';

/** Quadrant-Klassifikation aus RFC-004 §9. */
export function tenantQuadrant(
  riskScore: number,
  spend90d: number,
  cohortMedianSpend: number,
): Quadrant {
  const riskHigh = riskScore >= 50;
  const costHigh = spend90d >= cohortMedianSpend * 1.5;
  if (riskHigh && costHigh) return 'red_alert';
  if (riskHigh && !costHigh) return 'investigate';
  if (!riskHigh && costHigh) return 'premium_review';
  return 'reserved_capacity';
}

// ============================================================
// Utils
// ============================================================

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
