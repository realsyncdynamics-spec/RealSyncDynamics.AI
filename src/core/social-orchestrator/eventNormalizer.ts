// Event normalizer.
//
// Pure transform: RuntimeEvent → SocialEvent. The normalizer is
// where anonymization happens — once a SocialEvent exists, downstream
// code is allowed to assume it is publicly safe modulo the
// approvalStatus.
//
// The function is async only because it needs SHA-256 (Web Crypto).

import type {
  RuntimeEvent,
  SocialEvent,
  ApprovalStatus,
} from './types';
import {
  preFilter,
  scrubFreeText,
  isBlockedNamespace,
  normaliseSeverity,
} from './contentPolicy';

// ── Public surface ─────────────────────────────────────────────────

/**
 * Normalize a RuntimeEvent into a SocialEvent. Always returns a
 * SocialEvent — even when the source is BLOCKED — so the caller has
 * a stable shape to log, audit and surface to a dashboard. The
 * `approvalStatus` field carries the actual decision.
 */
export async function normalize(event: RuntimeEvent): Promise<SocialEvent> {
  const decision = preFilter(event);

  const sourceEventId = await sha256Hex(event.id);
  const id = `soc_${ulidLikeFromHash(sourceEventId)}`;
  const generatedAt = new Date().toISOString();

  const severity = normaliseSeverity(event.severity);

  // publicSafe is the inverse of "the policy said BLOCKED".
  const publicSafe = decision.status !== 'BLOCKED' && !isBlockedNamespace(event.type);

  // Build the anonymized summary. If the source carries an explicit
  // `summary` field, scrub-and-use it. Otherwise synthesise from type.
  const rawSummary =
    typeof event.payload?.summary === 'string'
      ? (event.payload!.summary as string)
      : defaultSummaryForType(event.type);
  const anonymizedSummary = scrubFreeText(rawSummary, !!event.publicApproved);

  // Filtered metrics: only finite numbers, no over-precision.
  const metrics = event.metrics ? sanitiseMetrics(event.metrics) : undefined;

  // Region: keep only when generic (state/country level), drop when
  // the value is suspiciously specific (city codes, AZ-suffixed regions).
  const region = isSafeRegion(event.region) ? event.region : undefined;

  // Hashtags: derived from the event type, channel-agnostic. The
  // postTemplates layer adds channel-specific tags on top.
  const hashtags = baseHashtagsForType(event.type);

  // approvalStatus: pre-filter decision is authoritative for BLOCKED.
  // For REVIEW/AUTO the post-normalization decision (in
  // contentPolicy.decideForSocialEvent) gets the final say — but we
  // pre-populate with the pre-filter result so a caller that doesn't
  // re-run the policy still gets a safe default.
  const approvalStatus: ApprovalStatus = decision.status;

  return {
    id,
    sourceEventId,
    type: event.type,
    severity,
    publicSafe,
    approvalStatus,
    generatedAt,
    region,
    metrics,
    anonymizedSummary,
    hashtags,
  };
}

// ── Internal helpers ───────────────────────────────────────────────

const TYPE_TO_DEFAULT_SUMMARY: Record<string, string> = {
  'tracker.detected':
    'Neuer Tracker erkannt, klassifiziert und im Governance Event Log dokumentiert.',
  'ai.endpoint.detected':
    'Neuer AI-Endpoint detektiert und gegen den AI-Act-Use-Case-Katalog geprüft.',
  'consent.missing':
    'Datenverarbeitung ohne dokumentierten Consent festgestellt und als Befund versiegelt.',
  'high_risk.classified':
    'Eine Verarbeitung wurde als hochriskant klassifiziert; Review wurde angestoßen.',
  'evidence.anchor.created':
    'Ein neuer Evidence-Anchor wurde mit kryptographischem Hash in die Audit-Chain geschrieben.',
  'policy.violation.detected':
    'Eine Policy-Verletzung wurde erkannt und im Audit-Stream verankert.',
  'audit.bundle.generated':
    'Ein Audit-Bundle wurde generiert und ist bereit für die Übergabe an Reviewer oder Behörde.',
  'privacy.delta.generated':
    'Ein Privacy-Delta wurde berechnet und mit den letzten 30 Tagen verglichen.',
  'runtime.replay.completed':
    'Ein Governance-Event wurde reproduziert und das Ergebnis identisch verifiziert.',
};

function defaultSummaryForType(type: string): string {
  return (
    TYPE_TO_DEFAULT_SUMMARY[type]
    ?? `Ein Runtime-Event vom Typ ${type} wurde dokumentiert.`
  );
}

const TYPE_TO_BASE_HASHTAGS: Record<string, string[]> = {
  'tracker.detected':         ['#DSGVO', '#Tracking', '#Compliance'],
  'ai.endpoint.detected':     ['#AIAct', '#AIGovernance', '#Compliance'],
  'consent.missing':          ['#DSGVO', '#Consent', '#TDDDG'],
  'high_risk.classified':     ['#AIAct', '#AIGovernance', '#RiskManagement'],
  'evidence.anchor.created':  ['#AuditTrail', '#Evidence', '#Compliance'],
  'policy.violation.detected':['#Governance', '#Compliance', '#Audit'],
  'audit.bundle.generated':   ['#Audit', '#Compliance', '#DSGVO'],
  'privacy.delta.generated':  ['#PrivacyOps', '#DSGVO', '#Compliance'],
  'runtime.replay.completed': ['#Reproducibility', '#Audit', '#Compliance'],
};

function baseHashtagsForType(type: string): string[] {
  return TYPE_TO_BASE_HASHTAGS[type] ?? ['#Compliance'];
}

function sanitiseMetrics(m: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    if (!Number.isFinite(v)) continue;
    // Round to 2 decimals to drop ranking-grade precision.
    out[k] = Math.round(v * 100) / 100;
  }
  return out;
}

function isSafeRegion(region: string | undefined): boolean {
  if (!region) return false;
  // Accept ISO-style region codes: 2-letter country, optional sub-region.
  return /^[a-z]{2}(?:-[a-z0-9]{1,8})?$/i.test(region);
}

// SHA-256 → hex. Uses Web Crypto if available (browser, Deno, modern
// Node), falls back to require('crypto') in the Node test runner.
async function sha256Hex(input: string): Promise<string> {
  const cryptoObj = (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).crypto as Crypto | undefined) ?? null;
  if (cryptoObj?.subtle?.digest) {
    const buf = await cryptoObj.subtle.digest('SHA-256', new TextEncoder().encode(input));
    const bytes = new Uint8Array(buf);
    let out = '';
    for (const b of bytes) out += b.toString(16).padStart(2, '0');
    return out;
  }
  // Node fallback (vitest in jsdom usually has subtle, but defend).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(input).digest('hex');
}

/** Derive a ULID-shape suffix from a hex string (deterministic, not
 *  cryptographically a real ULID — just a stable, sortable-ish id). */
function ulidLikeFromHash(hexHash: string): string {
  // Take first 26 chars uppercased; ULIDs are 26-char Crockford
  // base32. Hex isn't base32 but the shape is OK for an id.
  return hexHash.slice(0, 26).toUpperCase();
}
