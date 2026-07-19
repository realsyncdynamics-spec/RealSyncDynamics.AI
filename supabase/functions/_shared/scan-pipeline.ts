// Scan-pipeline adapter — start/record/complete/fail a scan_run + the
// findings it produces, as one logical unit.
//
// Backed by migrations
//   20260610000000_findings_domain_entity.sql       (PR 1)
//   20260611000000_scan_runs_and_findings_link.sql  (PR 2 — this PR)
//
// Pipeline contract:
//
//   const { scan_run_id, correlation_id } = await startScanRun(admin, { ... });
//   try {
//     for (const f of detectorResults) {
//       await recordScanFinding(admin, scan_run_id, correlation_id, f);
//     }
//     await completeScanRun(admin, scan_run_id, { tenant_id });
//   } catch (e) {
//     await failScanRun(admin, scan_run_id, 'DETECTOR_ERROR', String(e));
//   }
//
// The pipeline:
//   - Stamps the same correlation_id on the scan_run and every finding
//   - Sets started_at on transition queued → running
//   - Computes finding_count + severity_max on completeScanRun by
//     querying findings.scan_run_id (single SELECT, not trigger)
//   - Enforces lifecycle constraints in code in addition to the DB
//     CHECK (which would catch them too, but slower + with worse errors)
//
// Out of scope (later PRs):
//   - Actually running detectors (PR 3+ wires gdpr-audit / cookie-scanner)
//   - runtime_events emission tied to scan_run lifecycle (separate PR)
//   - Webhook / SSE progress notifications

import {
  recordFinding,
  type AdminLike as FindingsAdminLike,
  type NewFinding,
  type FindingSeverity,
} from './findings.ts';

// Re-export so callers can pass one admin client through both modules.
export type AdminLike = FindingsAdminLike & {
  rpc?(name: string, args?: Record<string, unknown>): Promise<unknown>;
};

// ─────────────────────────────────────────────────────────────────────
// Types (subset; full TS-side types live in src/types/governance/scan-run.ts)
// ─────────────────────────────────────────────────────────────────────

export type ScanRunStatus =
  | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NewScanRunInput {
  tenant_id:       string;
  website_id?:     string | null;
  detector:        string;
  raw_payload?:    Record<string, unknown> | null;
  /** Optional — generated if omitted, so callers can stamp it onto
   *  their runtime_events row pre-flight. */
  correlation_id?: string | null;
}

export interface StartedScanRun {
  scan_run_id:    string;
  correlation_id: string;
}

// ─────────────────────────────────────────────────────────────────────
// Internal: minimal UUID v4 (avoids pulling crypto in Deno-or-Node ctx)
// ─────────────────────────────────────────────────────────────────────

function uuidv4(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Last-resort fallback for environments without web-crypto.
  const r = (n: number) => Math.floor(Math.random() * n).toString(16).padStart(2, '0');
  const hex = Array.from({ length: 16 }, () => r(256)).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ─────────────────────────────────────────────────────────────────────
// startScanRun — INSERT row in 'queued', then move to 'running' so the
// row reflects in-flight state immediately. Two-step keeps the queued
// state observable for future async-worker designs.
// ─────────────────────────────────────────────────────────────────────

export async function startScanRun(
  admin: AdminLike,
  input: NewScanRunInput,
): Promise<{ ok: true; run: StartedScanRun } | { ok: false; error: string }> {
  if (!input.tenant_id) return { ok: false, error: 'tenant_id required' };
  if (!input.detector)  return { ok: false, error: 'detector required' };

  const id             = uuidv4();
  const correlation_id = input.correlation_id ?? uuidv4();
  const now            = new Date().toISOString();

  const { error } = await admin.from('scan_runs').insert({
    id,
    tenant_id:      input.tenant_id,
    website_id:     input.website_id     ?? null,
    detector:       input.detector,
    status:         'running',
    started_at:     now,
    raw_payload:    input.raw_payload    ?? null,
    correlation_id,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, run: { scan_run_id: id, correlation_id } };
}

// ─────────────────────────────────────────────────────────────────────
// recordScanFinding — wrapper around recordFinding that auto-stamps
// scan_run_id + correlation_id. Detector code does not pass these
// itself; the pipeline owns them.
// ─────────────────────────────────────────────────────────────────────

export async function recordScanFinding(
  admin:          AdminLike,
  scanRunId:      string,
  correlationId:  string,
  f:              Omit<NewFinding, 'scan_run_id' | 'correlation_id' | 'tenant_id'> & {
    tenant_id: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  return recordFinding(admin, {
    ...f,
    scan_run_id:    scanRunId,
    correlation_id: correlationId,
  });
}

// ─────────────────────────────────────────────────────────────────────
// completeScanRun — moves status running → completed, computes
// denormalized counters via a single roll-up query, sets timestamps.
// ─────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

function maxSeverity(rows: { severity: FindingSeverity }[]): FindingSeverity | null {
  if (rows.length === 0) return null;
  let best = rows[0].severity;
  let bestRank = SEVERITY_ORDER[best] ?? 0;
  for (const r of rows) {
    const rank = SEVERITY_ORDER[r.severity] ?? 0;
    if (rank > bestRank) { best = r.severity; bestRank = rank; }
  }
  return best;
}

export interface CompleteScanRunArgs {
  /** Optional: caller-supplied counters skip the DB roll-up — useful
   *  when the detector kept its own tally and a second SELECT would
   *  be wasted RTT. */
  finding_count?: number;
  severity_max?:  FindingSeverity | null;
}

export async function completeScanRun(
  admin:      AdminLike,
  scanRunId:  string,
  args:       CompleteScanRunArgs = {},
): Promise<{ ok: boolean; error?: string; finding_count?: number; severity_max?: FindingSeverity | null }> {
  if (!scanRunId) return { ok: false, error: 'scanRunId required' };

  let findingCount = args.finding_count;
  let severityMax  = args.severity_max ?? null;

  if (findingCount === undefined) {
    // Compute the roll-up. select() chain shape varies between
    // supabase-js builder + our mocks; typed with double cast to keep
    // adapter testable in both shapes.
    const q: Promise<{ data: { severity: FindingSeverity }[] | null; error: { message: string } | null }> = admin.from('findings').select('severity').eq('scan_run_id', scanRunId) as unknown as Promise<{ data: { severity: FindingSeverity }[] | null; error: { message: string } | null }>;
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    const rows = data ?? [];
    findingCount = rows.length;
    severityMax  = maxSeverity(rows);
  }

  const completedAt = new Date().toISOString();
  const { error } = await admin.from('scan_runs')
    .update({
      status:        'completed',
      completed_at:  completedAt,
      finding_count: findingCount,
      severity_max:  severityMax,
    })
    .eq('id', scanRunId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, finding_count: findingCount, severity_max: severityMax };
}

// ─────────────────────────────────────────────────────────────────────
// failScanRun — terminal failure with error_code + message. The CHECK
// constraint on the table requires error_code when status=failed.
// ─────────────────────────────────────────────────────────────────────

export async function failScanRun(
  admin:        AdminLike,
  scanRunId:    string,
  errorCode:    string,
  errorMessage: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!scanRunId) return { ok: false, error: 'scanRunId required' };
  if (!errorCode) return { ok: false, error: 'errorCode required' };

  const completedAt = new Date().toISOString();
  const { error } = await admin.from('scan_runs')
    .update({
      status:        'failed',
      completed_at:  completedAt,
      error_code:    errorCode,
      error_message: errorMessage,
    })
    .eq('id', scanRunId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────
// cancelScanRun — admin-initiated stop. Same shape as failScanRun but
// without the mandatory error_code; reason goes into error_message.
// ─────────────────────────────────────────────────────────────────────

export async function cancelScanRun(
  admin:     AdminLike,
  scanRunId: string,
  reason:    string,
): Promise<{ ok: boolean; error?: string }> {
  if (!scanRunId) return { ok: false, error: 'scanRunId required' };
  const completedAt = new Date().toISOString();
  const { error } = await admin.from('scan_runs')
    .update({
      status:        'cancelled',
      completed_at:  completedAt,
      error_message: reason,
    })
    .eq('id', scanRunId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
