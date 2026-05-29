/**
 * ScanRun — one execution of a detector against a subject.
 *
 * Storage: `public.scan_runs` (migration 20260611000000).
 * Pipeline adapter: `supabase/functions/_shared/scan-pipeline.ts`.
 * Cross-entity correlation: `correlation_id` joins runtime_events
 *   (activity-log backbone) and findings (this run's outputs).
 *
 * Lifecycle:
 *   queued → running → completed
 *                   ↘  failed
 *                   ↘  cancelled
 * Terminal states (completed/failed/cancelled) MUST have completed_at
 * set; the DB CHECK enforces this so a half-finished UPDATE doesn't
 * leave a "completed but no timestamp" row.
 */

import type { FindingSeverity } from './finding';

export type ScanRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const TERMINAL_SCAN_RUN_STATUSES: readonly ScanRunStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

/**
 * Allowed forward transitions. A scan_run that's been cancelled
 * cannot be moved back to running — caller starts a new run.
 */
export const SCAN_RUN_NEXT_STATUS: Record<ScanRunStatus, ScanRunStatus[]> = {
  queued:    ['running', 'cancelled'],
  running:   ['completed', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  cancelled: [],
};

export interface ScanRun {
  id:             string;     // uuid
  tenant_id:      string;     // uuid, FK tenants(id)
  website_id:     string | null;   // uuid, FK websites(id)

  detector:       string;     // free-form, same vocabulary as findings.detector
  status:         ScanRunStatus;

  started_at:     string | null;   // ISO-8601; null while queued
  completed_at:   string | null;   // ISO-8601; null until terminal
  duration_ms:    number | null;   // populated alongside completed_at

  finding_count:  number;          // denormalized; updated on completion
  severity_max:   FindingSeverity | null;  // denormalized; null until findings recorded

  error_code:     string | null;   // populated on status=failed
  error_message:  string | null;

  raw_payload:    Record<string, unknown> | null;
  correlation_id: string | null;

  created_at:     string;
  updated_at:     string;
}

/** Input for starting a new scan run (creates row in 'queued' state). */
export interface NewScanRun {
  tenant_id:       string;
  website_id?:     string | null;
  detector:        string;
  raw_payload?:    Record<string, unknown> | null;
  correlation_id?: string | null;
}

/** Patch shape for status transitions. */
export interface ScanRunStatusPatch {
  status:        ScanRunStatus;
  started_at?:   string;
  completed_at?: string;
  duration_ms?:  number;
  finding_count?: number;
  severity_max?: FindingSeverity | null;
  error_code?:   string | null;
  error_message?: string | null;
}
