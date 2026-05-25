/**
 * Scans API — typed client for reading scan_runs + findings + report.
 *
 * RLS-gated. The deny-by-default policies on scan_runs and findings
 * (migrations 20260610 / 20260611) mean an authenticated user can
 * only see rows belonging to a tenant they're a member of, so this
 * client doesn't need its own auth gate beyond ensuring the active
 * tenant is set.
 *
 * Uses the existing Supabase client; no Edge Function call. Score /
 * grade math runs client-side via reportMapping from PR 3 (#428) —
 * single source of truth for the formula.
 */

import { getSupabase } from '../../../lib/supabase';
import type { Finding } from '../../../types/governance/finding';
import type { ScanRun } from '../../../types/governance/scan-run';
import type { ReportPayload } from '../../../types/governance/report';
import { buildReportPayload } from '../../../lib/governance/reportMapping';

/**
 * List a tenant's most recent scan_runs. Default limit 50; UI
 * paginates if needed. RLS scopes to the caller's memberships
 * automatically — no tenant_id filter required for correctness,
 * but we pass one as a defensive query speed-up.
 */
export async function listScanRuns(
  tenantId: string,
  opts: { limit?: number; status?: ScanRun['status'] } = {},
): Promise<ScanRun[]> {
  const sb = getSupabase();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let q = sb.from('scan_runs')
    .select('*')
    .eq('tenant_id', tenantId);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScanRun[];
}

/** Single scan_run by id. Returns null on 404; throws on RLS/network. */
export async function getScanRun(scanRunId: string): Promise<ScanRun | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from('scan_runs')
    .select('*')
    .eq('id', scanRunId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ScanRun | null) ?? null;
}

/** All findings produced by a scan_run. */
export async function listFindingsForScan(scanRunId: string): Promise<Finding[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('findings')
    .select('*')
    .eq('scan_run_id', scanRunId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Finding[];
}

/**
 * Build the full ReportPayload for a scan_run. Joins scan_run +
 * findings, runs the pure mapping client-side. Matches what the
 * Edge-side `getReport` helper does (see PR 3) — same math.
 */
export async function getScanReport(
  scanRunId: string,
  opts: { topN?: number } = {},
): Promise<ReportPayload | null> {
  const [scan, findings] = await Promise.all([
    getScanRun(scanRunId),
    listFindingsForScan(scanRunId),
  ]);
  if (!scan) return null;
  return buildReportPayload(scan, findings, { topN: opts.topN ?? 10 });
}
