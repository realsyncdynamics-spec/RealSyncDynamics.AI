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
import type { Finding, FindingStatus } from '../../../types/governance/finding';
import { FINDING_NEXT_STATUS } from '../../../types/governance/finding';
import type { ScanRun } from '../../../types/governance/scan-run';
import type { ReportPayload } from '../../../types/governance/report';
import { buildReportPayload } from '../../../lib/governance/reportMapping';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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

// ─── Website registry ───────────────────────────────────────────────

export interface TenantWebsite {
  id:         string;
  tenant_id:  string;
  domain:     string;
  plan_tier:  'audit' | 'rebuild' | 'managed';
  status:     string;
  created_at: string;
}

/** Lists the tenant's registered websites, most-recent first. */
export async function listWebsitesForTenant(tenantId: string): Promise<TenantWebsite[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('websites')
    .select('id, tenant_id, domain, plan_tier, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TenantWebsite[];
}

/**
 * Adds a website to the tenant's registry. Domain is normalised
 * lowercase + scheme-stripped. Caller is responsible for being a
 * tenant member; the server-side RLS / service-role-only insert
 * policy is the actual gate (this just shapes the row).
 */
export async function addWebsiteForTenant(
  tenantId: string,
  rawInput: string,
): Promise<TenantWebsite> {
  const sb = getSupabase();
  const domain = normaliseDomain(rawInput);
  if (!domain) throw new Error('Bitte eine gültige Domain angeben.');
  const { data, error } = await sb.from('websites')
    .insert({
      tenant_id: tenantId,
      domain,
      plan_tier: 'audit',
      status:    'lead',
    })
    .select('id, tenant_id, domain, plan_tier, status, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data as TenantWebsite;
}

function normaliseDomain(raw: string): string | null {
  const s = (raw ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.\-]/g, '');
  if (!s) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    return null;
  }
  return s;
}

/** Exported for unit tests. */
export const __test = { normaliseDomain };

// ─── Tenant-scoped scan trigger (via tenant-audit Edge Function) ────

/**
 * Trigger an authenticated scan for the active tenant. Calls the
 * `tenant-audit` Edge Function which fans out to `gdpr-audit` and
 * persists into `scan_runs` + `findings`.
 */
export async function triggerTenantAudit(
  tenantId: string,
  url: string,
  opts: { website_id?: string } = {},
): Promise<{ scan_run_id: string; finding_count: number; severity_max: string | null }> {
  const sb = getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const accessToken = sess?.session?.access_token;
  if (!accessToken) throw new Error('Bitte einloggen, um einen Scan zu starten.');

  const r = await fetch(`${SUPABASE_URL}/functions/v1/tenant-audit`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-Id':   tenantId,
    },
    body: JSON.stringify({ url, website_id: opts.website_id }),
  });

  if (!r.ok) {
    const text = await r.text();
    let errorMsg = `tenant-audit fehlgeschlagen (HTTP ${r.status})`;
    try {
      const errObj = JSON.parse(text);
      errorMsg = errObj.error?.message ?? errorMsg;
    } catch {
      // Response is not JSON, use HTTP status message
    }
    throw new Error(errorMsg);
  }

  const body = await r.json() as {
    ok?: boolean;
    scan_run_id?: string;
    finding_count?: number;
    severity_max?: string | null;
    error?: { message?: string };
  };

  if (!body.ok || !body.scan_run_id) {
    throw new Error(body.error?.message ?? 'tenant-audit fehlgeschlagen (ungültige Response)');
  }
  return {
    scan_run_id:   body.scan_run_id,
    finding_count: body.finding_count ?? 0,
    severity_max:  body.severity_max ?? null,
  };
}

// ─── Finding status transitions ─────────────────────────────────────

/**
 * Update a finding's status. Validates the transition against
 * FINDING_NEXT_STATUS client-side before hitting the DB — the DB
 * doesn't enforce the transition map (only the value range), but
 * surfacing an invalid transition early gives a clearer error.
 */
export async function updateFindingStatus(
  findingId:   string,
  currentStatus: FindingStatus,
  nextStatus:    FindingStatus,
): Promise<void> {
  const allowed = FINDING_NEXT_STATUS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Übergang von „${currentStatus}" auf „${nextStatus}" nicht erlaubt.`,
    );
  }
  const sb = getSupabase();
  const { error } = await sb.from('findings')
    .update({ status: nextStatus })
    .eq('id', findingId);
  if (error) throw new Error(error.message);
}
