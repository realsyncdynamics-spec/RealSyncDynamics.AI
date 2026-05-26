/**
 * Finding domain entity — central compliance-evidence record.
 *
 * One row per (detector × subject × evidence) at creation time. Lifecycle
 * tracked via `status`. Persistent across scan runs, agent decisions,
 * remediation cycles. This is the entity the auditor reads.
 *
 * Storage: `public.findings` (migration 20260610000000).
 * Adapter: `supabase/functions/_shared/findings.ts`.
 * Cross-entity correlation: `correlation_id` joins runtime_events,
 *   anon_chat_runs, llm_query_history, and (future) scan_runs.
 *
 * Keep this file pure-types — no Supabase client, no fetch helpers.
 * UI imports from here; adapters import from here.
 */

export type FindingSeverity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'info';

export type FindingStatus =
  | 'open'           // never reviewed
  | 'acknowledged'   // human saw it, deferred decision
  | 'fixed'          // remediation applied (next re-scan should confirm)
  | 'false_positive' // detector wrong; should not re-fire same way
  | 'ignored'        // accepted risk
  | 'resolved';      // fixed + confirmed by re-scan

export type FindingCategory =
  | 'consent'        // banner / pre-consent tracker / TTDSG §25
  | 'tracker'        // unknown vendor, DPA missing, third-party script
  | 'ai_act'         // EU AI Act Annex III, transparency, oversight
  | 'tom'            // technical / organizational measures (Art. 32)
  | 'dpa'            // Data Processing Agreement (Art. 28)
  | 'accessibility'  // BFSG / WCAG
  | 'security'       // TLS, CSP, HSTS, headers
  | 'transparency'   // Art. 13/14 information duties
  | 'data_quality'   // duplicates, stale, missing fields
  | 'documentation'  // missing DPIA, missing register entry
  | 'other';

/**
 * Detector identity. Free-form text in the DB so future detectors
 * can register without a migration; canonical names listed here so
 * UI + analytics can branch on them consistently.
 */
export const KNOWN_DETECTORS = [
  'gdpr-audit',
  'governance-agent',
  'cookie-scanner',
  'ai-act-classifier',
  'shopify-scan',
  'manual',
] as const;
export type KnownDetector = typeof KNOWN_DETECTORS[number];

export interface Finding {
  id:              string;     // uuid
  tenant_id:       string;     // uuid; FK tenants(id)
  website_id:      string | null;   // uuid; FK websites(id) — null for tenant-level
  scan_run_id:     string | null;   // uuid; no FK yet (PR 2)

  category:        FindingCategory;
  severity:        FindingSeverity;
  status:          FindingStatus;

  detector:        string;     // see KNOWN_DETECTORS; free-form-tolerant
  evidence_ref:    string | null;   // opaque pointer (URL, sha256, storage key, …)

  summary:         string;     // 1..1000 chars
  raw_payload:     Record<string, unknown> | null;

  /**
   * Stable identity for "the same logical violation" — sha256_hex of
   * (detector | website_id | category | normalized(evidence_ref)).
   * Populated by the adapter on insert; backfilled in migration
   * 20260612000000. May be null on pre-migration rows or rows inserted
   * outside the adapter (will be backfilled on next manual sweep).
   * See: src/lib/governance/findingFingerprint.ts.
   */
  fingerprint:     string | null;

  /**
   * Joinable to:
   *   runtime_events.correlation_id   — activity-log backbone
   *   anon_chat_runs.correlation_id   — anon audit trail
   *   llm_query_history.correlation_id — LLM query log
   * Use the same UUID across all four when emitting them as one logical event.
   */
  correlation_id:  string | null;

  created_at:      string;     // ISO-8601
  updated_at:      string;     // ISO-8601
}

/** Input shape for inserting a new finding. */
export interface NewFinding {
  tenant_id:       string;
  website_id?:     string | null;
  scan_run_id?:    string | null;

  category:        FindingCategory;
  severity:        FindingSeverity;
  /** Defaults to 'open' if omitted. */
  status?:         FindingStatus;

  detector:        string;
  evidence_ref?:   string | null;

  summary:         string;
  raw_payload?:    Record<string, unknown> | null;

  correlation_id?: string | null;
}

/**
 * Output of status transitions used by the UI / adapters. Helps the
 * UI render the right CTA per status (e.g. an 'open' finding has
 * "Acknowledge" + "Mark fixed"; a 'resolved' one is read-only).
 */
export const FINDING_NEXT_STATUS: Record<FindingStatus, FindingStatus[]> = {
  open:            ['acknowledged', 'fixed', 'false_positive', 'ignored'],
  acknowledged:    ['fixed', 'false_positive', 'ignored', 'open'],
  fixed:           ['resolved', 'open'],
  false_positive:  ['open'],
  ignored:         ['open'],
  resolved:        ['open'],
};

/** Severity ordering for sort (high → low) and risk roll-ups. */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  critical: 4,
  high:     3,
  medium:   2,
  low:      1,
  info:     0,
};
