// Content policy for the social orchestrator.
//
// Pure functions. No side effects, no async, no external state.
//
// The policy answers two questions for any candidate (RuntimeEvent or
// SocialEvent):
//   1. Is the event allowed to leave the runtime at all?
//      (BLOCKED namespaces, PII, customer-private data)
//   2. If allowed: does it auto-publish or does a human review first?
//      (severity + event type + presence of reviewer-only triggers)
//
// The policy is deliberately conservative. False-positive REVIEW
// is acceptable; false-positive AUTO is not.

import type {
  RuntimeEvent,
  SocialEvent,
  ApprovalDecision,
  ApprovalStatus,
} from './types';

// ── Blocked namespaces ─────────────────────────────────────────────
//
// Any event whose `type` starts with one of these prefixes is BLOCKED
// regardless of payload contents. Match is by literal prefix; the
// trailing `.` matters so `tenant.internal.foo` matches but
// `tenant_internal_foo` does not.

export const BLOCKED_NAMESPACES = [
  'tenant.internal.',
  'customer.private.',
  'financial.',
  'personal_data.',
  'pii.',
] as const;

// ── PII / customer-identity patterns ───────────────────────────────
//
// These are conservative regexes. A match in a payload string field
// means BLOCKED; a match in a numeric metric is not flagged here
// (numeric PII like phone-number-as-int is exotic enough to skip).

const EMAIL_RX        = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_DE_RX     = /(?:\+49|0)[\s-]?\d{2,4}[\s-]?\d{3,12}/;
const IBAN_RX         = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/;
const NAME_HINT_RX    = /\b[A-ZÄÖÜ][a-zäöüß]+\s+(GmbH|AG|KG|OHG|UG|SE|GbR|e\.V\.)\b/;
const CARD_NUMBER_RX  = /\b(?:\d[ -]*?){13,19}\b/;

const PII_PATTERNS: Array<[RegExp, string]> = [
  [EMAIL_RX,       'email'],
  [PHONE_DE_RX,    'phone_de'],
  [IBAN_RX,        'iban'],
  [NAME_HINT_RX,   'company_name'],
  [CARD_NUMBER_RX, 'card_number'],
];

// ── Payload keys that always carry tenant-private data ─────────────

const PRIVATE_PAYLOAD_KEYS = new Set([
  'customer_name', 'tenant_name', 'company_name',
  'customer_email', 'tenant_email', 'contact_email',
  'customer_id', 'user_id', 'employee_id',
  'iban', 'bic', 'vat_id', 'tax_id',
  'amount', 'amount_gross', 'amount_net', 'revenue',
  'phone', 'phone_number', 'mobile',
  'address', 'street', 'city', 'zip',
  'birthdate', 'date_of_birth',
]);

// ── Event-type taxonomy ────────────────────────────────────────────

const HIGH_VIRALITY_TYPES = new Set([
  'tracker.detected',
  'ai.endpoint.detected',
  'consent.missing',
  'high_risk.classified',
  'evidence.anchor.created',
  'policy.violation.detected',
]);

const MEDIUM_TYPES = new Set([
  'audit.bundle.generated',
  'privacy.delta.generated',
  'runtime.replay.completed',
]);

/**
 * Event types that, even when publicSafe, MUST go through human
 * review before posting. The instinct is "high virality but
 * potentially sensitive framing".
 */
const ALWAYS_REVIEW_TYPES = new Set([
  'high_risk.classified',
  'policy.violation.detected',
]);

// ── Public surface ─────────────────────────────────────────────────

/**
 * Decide if a raw RuntimeEvent is allowed to enter the social pipeline
 * at all. This runs BEFORE normalization. Returns BLOCKED for events
 * in blocked namespaces or with payload that contains obvious PII.
 *
 * NOTE: this is a coarse pre-filter. The full per-channel decision
 * happens in `decideForSocialEvent` after normalization.
 */
export function preFilter(event: RuntimeEvent): ApprovalDecision {
  const reasons: string[] = [];

  // 1. Blocked namespace.
  const blockedNs = BLOCKED_NAMESPACES.find(ns => event.type.startsWith(ns));
  if (blockedNs) {
    reasons.push(`blocked_namespace:${blockedNs}`);
    return { status: 'BLOCKED', reasons };
  }

  // 2. Payload PII scan.
  if (event.payload) {
    const piiHits = scanPayloadForPii(event.payload);
    if (piiHits.length > 0) {
      reasons.push(...piiHits.map(h => `pii:${h}`));
      return { status: 'BLOCKED', reasons };
    }

    // 3. Tenant-private payload keys.
    const privateKeys = Object.keys(event.payload).filter(
      k => PRIVATE_PAYLOAD_KEYS.has(k.toLowerCase()),
    );
    if (privateKeys.length > 0) {
      reasons.push(...privateKeys.map(k => `private_key:${k}`));
      return { status: 'BLOCKED', reasons };
    }
  }

  // 4. Critical without explicit publicApproved → REVIEW.
  if ((event.severity === 'critical') && !event.publicApproved) {
    reasons.push('severity_critical_needs_review');
    return { status: 'REVIEW', reasons };
  }

  // Otherwise: continue to normalization. Final approval decided
  // downstream after the SocialEvent is built.
  return { status: 'AUTO', reasons: [] };
}

/**
 * Decide the approval status for a fully-normalized SocialEvent.
 * Called by the orchestrator after eventNormalizer has produced the
 * scrubbed shape.
 */
export function decideForSocialEvent(event: SocialEvent): ApprovalDecision {
  const reasons: string[] = [];

  // Critical → always REVIEW even if publicSafe (last line of defence).
  if (event.severity === 'critical') {
    reasons.push('severity_critical_needs_review');
    return { status: 'REVIEW', reasons };
  }

  // ALWAYS_REVIEW types — typically reputational-risk types like
  // policy.violation.detected. Even AUTO-eligible severities go to
  // human review for these.
  if (ALWAYS_REVIEW_TYPES.has(event.type)) {
    reasons.push(`type_always_review:${event.type}`);
    return { status: 'REVIEW', reasons };
  }

  // High + publicSafe + high-virality type → AUTO is OK.
  if (event.severity === 'high' && event.publicSafe && HIGH_VIRALITY_TYPES.has(event.type)) {
    return { status: 'AUTO', reasons: [] };
  }

  // High + publicSafe + medium type → REVIEW (severity outpaces template-fitness).
  if (event.severity === 'high' && event.publicSafe && MEDIUM_TYPES.has(event.type)) {
    reasons.push('high_severity_medium_type');
    return { status: 'REVIEW', reasons };
  }

  // Medium / low + publicSafe → AUTO.
  if ((event.severity === 'medium' || event.severity === 'low') && event.publicSafe) {
    return { status: 'AUTO', reasons: [] };
  }

  // Anything not publicSafe → REVIEW.
  if (!event.publicSafe) {
    reasons.push('not_public_safe');
    return { status: 'REVIEW', reasons };
  }

  // Catch-all conservative default.
  reasons.push('catch_all_review');
  return { status: 'REVIEW', reasons };
}

// ── Public language guardrails (used by postGenerator) ─────────────
//
// The orchestrator never claims:
//   - rechtliche Bewertung / Rechtsberatung
//   - "garantiert DSGVO-konform"
//   - "Bußgeld droht" als Tatsachenbehauptung
//   - "AI Act erfüllt" als binäre Aussage
//
// These functions sanity-check generated post bodies. A post that
// fails these MUST be downgraded to BLOCKED.

const FORBIDDEN_PHRASES = [
  /\bgarantiert\s+(?:DSGVO|GDPR|AI[- ]?Act)[- ]?konform\b/i,
  /\b(?:rechtsverbindlich|verbindliche?\s+rechtsberatung)\b/i,
  /\bBu(?:ß|ss)geld\s+droht\s+sicher\b/i,
  /\bdefinitiv\s+nicht\s+strafbar\b/i,
];

export function checkPostBodyForForbiddenLanguage(body: string): string[] {
  const hits: string[] = [];
  for (const rx of FORBIDDEN_PHRASES) {
    if (rx.test(body)) hits.push(rx.source);
  }
  return hits;
}

// ── Helpers ────────────────────────────────────────────────────────

function scanPayloadForPii(payload: Record<string, unknown>): string[] {
  const hits: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === 'string') {
      for (const [rx, label] of PII_PATTERNS) {
        if (rx.test(v)) hits.push(label);
      }
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === 'object') {
      Object.values(v as Record<string, unknown>).forEach(visit);
    }
  };
  visit(payload);
  // De-duplicate while preserving order.
  return Array.from(new Set(hits));
}

/**
 * Coalesce a possibly-`info` severity from the runtime side onto the
 * orchestrator's tighter 4-level scale. Pure helper used by both
 * normalizer and policy.
 */
export function normaliseSeverity(s: RuntimeEvent['severity']): 'low' | 'medium' | 'high' | 'critical' {
  if (s === 'critical') return 'critical';
  if (s === 'high')     return 'high';
  if (s === 'low' || s === 'info') return 'low';
  return 'medium';
}

/**
 * Convenience exposed for tests/UIs that want to know what category an
 * event-type falls into without re-running the whole policy.
 */
export function eventTypeTier(eventType: string): 'high_virality' | 'medium' | 'unknown' {
  if (HIGH_VIRALITY_TYPES.has(eventType)) return 'high_virality';
  if (MEDIUM_TYPES.has(eventType))        return 'medium';
  return 'unknown';
}

export function isBlockedNamespace(eventType: string): boolean {
  return BLOCKED_NAMESPACES.some(ns => eventType.startsWith(ns));
}

/**
 * Apply a string-level scrub for inline names/domains/emails. Used by
 * the normalizer when building `anonymizedSummary` from operator-
 * provided text. Domains are kept only when `publicApproved` is true.
 */
export function scrubFreeText(input: string, publicApproved: boolean): string {
  let out = input;
  out = out.replace(EMAIL_RX, '[redacted-email]');
  out = out.replace(PHONE_DE_RX, '[redacted-phone]');
  out = out.replace(IBAN_RX, '[redacted-iban]');
  out = out.replace(CARD_NUMBER_RX, '[redacted-card]');
  out = out.replace(NAME_HINT_RX, '[customer]');
  if (!publicApproved) {
    // Replace bare domain-shaped tokens like example.com / x.de when
    // the operator has not explicitly approved customer identity.
    out = out.replace(
      /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi,
      (m) => /^realsyncdynamicsai\.de$/i.test(m) ? m : '[customer-domain]',
    );
  }
  return out;
}

export function approvalStatusFromDecisions(decisions: ApprovalDecision[]): ApprovalStatus {
  // Strictest wins: BLOCKED > REVIEW > AUTO.
  if (decisions.some(d => d.status === 'BLOCKED')) return 'BLOCKED';
  if (decisions.some(d => d.status === 'REVIEW'))  return 'REVIEW';
  return 'AUTO';
}
