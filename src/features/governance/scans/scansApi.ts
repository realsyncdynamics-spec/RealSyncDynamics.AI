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
import { getSupabaseUrl } from '../../../lib/supabaseUrl';
import type { Finding, FindingStatus } from '../../../types/governance/finding';
import { FINDING_NEXT_STATUS } from '../../../types/governance/finding';
import type { ScanRun } from '../../../types/governance/scan-run';
import type { ReportPayload } from '../../../types/governance/report';
import { buildReportPayload } from '../../../lib/governance/reportMapping';
import { notifyTenantDataChanged } from '../tenantDataEvents';

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

/**
 * Status, in denen ein Befund noch nicht erledigt ist. `fixed` gehört dazu:
 * Die Behebung ist gemeldet, aber erst die Nachprüfung setzt `resolved`
 * (FINDING_NEXT_STATUS; der Report zählt `fixed` noch mit 50 %).
 */
export const OPEN_FINDING_STATUSES: readonly FindingStatus[] = ['open', 'acknowledged', 'fixed'];

/** Schlanke Befund-Zeile fürs Dashboard (kein raw_payload). */
export type OpenFindingRow = Pick<
  Finding,
  'id' | 'severity' | 'status' | 'summary' | 'detector' | 'scan_run_id' | 'website_id' | 'created_at'
> & {
  /**
   * governance_events-Zwilling (raw_payload.event_id): email-auth-rescan
   * schreibt denselben Befund in beide Speicher — zum Entdoppeln.
   */
  event_id?: string | null;
};

/** Stufen, die als Handlungsbedarf zählen — nie durch das Limit verdrängt. */
const PRIORITY_SEVERITIES = ['critical', 'high', 'medium'] as const;

const OPEN_FINDING_COLUMNS =
  'id,severity,status,summary,detector,scan_run_id,website_id,created_at,event_id:raw_payload->>event_id';

/**
 * Offene Befunde eines Mandanten aus der kanonischen `findings`-Tabelle —
 * dorthin schreibt der Website-Audit (tenant-audit). Neueste zuerst.
 * Wirft bei RLS-/Netzfehler; der Aufrufer darf das nicht als „0 Befunde“ lesen.
 *
 * Zwei Abfragen: die neuesten `limit` Befunde UND die neuesten `limit`
 * Befunde mit Handlungsbedarf (kritisch/hoch/mittel). Sonst könnten 50
 * jüngere Niedrig-/Info-Befunde einen älteren kritischen verdrängen, und das
 * Dashboard meldete „keine kritischen Befunde“.
 */
export async function listOpenFindingsForTenant(tenantId: string, limit = 50): Promise<OpenFindingRow[]> {
  const sb = getSupabase();
  const base = () => sb.from('findings')
    .select(OPEN_FINDING_COLUMNS)
    .eq('tenant_id', tenantId)
    .in('status', [...OPEN_FINDING_STATUSES]);
  const [recent, priority] = await Promise.all([
    base().order('created_at', { ascending: false }).limit(limit),
    base().in('severity', [...PRIORITY_SEVERITIES]).order('created_at', { ascending: false }).limit(limit),
  ]);
  if (recent.error) throw new Error(recent.error.message);
  if (priority.error) throw new Error(priority.error.message);
  const byId = new Map<string, OpenFindingRow>();
  for (const row of [...(priority.data ?? []), ...(recent.data ?? [])] as OpenFindingRow[]) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
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

// ─── Website registry ───────────────────────────────

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

/** Rollen, die Websites anlegen dürfen (wie public.is_tenant_writer, RLS 20261005150000). */
export const WEBSITE_WRITER_ROLES: ReadonlySet<string> = new Set(['owner', 'admin', 'dpo', 'editor']);

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
  if (error) {
    // RLS (20261005150000): nur owner/admin/dpo/editor legen Websites an.
    if (error.code === '42501') throw new Error('Ihre Rolle darf keine Websites anlegen.');
    if (error.code === '23505') throw new Error('Diese Domain ist bereits registriert.');
    throw new Error(error.message);
  }
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

/**
 * tenant-audit verlangt eine absolute http(s)-URL. Die Registry speichert
 * nur den Host. Ohne Schema würde die Function 400 INVALID_URL liefern.
 */
export function auditTargetUrl(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

/** Exported for unit tests. */
export const __test = { normaliseDomain, auditTargetUrl };

// ─── Tenant-scoped scan trigger (via tenant-audit Edge Function) ────

function scanErrorForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Keine Berechtigung für diesen Scan.';
  if (status === 405) return 'Scan-Dienst nicht unter dieser Adresse erreichbar (HTTP 405).';
  if (status === 429) return 'Scan-Limit erreicht. Bitte später erneut versuchen.';
  if (status === 504) return 'Der Scan hat zu lange gedauert (Timeout).';
  if (status >= 500)  return `Website-Audit fehlgeschlagen — der Audit-Dienst meldet einen Serverfehler (HTTP ${status}). Bitte später erneut versuchen.`;
  return `Scan fehlgeschlagen (HTTP ${status}).`;
}

/** Gate-2-Fehlercodes von tenant-audit, die ein Nutzer verstehen und beheben kann. */
const SCAN_ERROR_BY_CODE: Record<string, string> = {
  TARGET_UNREACHABLE:
    'Die Website war nicht erreichbar. Es wurde nichts bewertet und kein Befund geändert.',
  WEBSITE_NOT_FOUND: 'Diese Website gehört nicht zu Ihrem Workspace.',
  URL_WEBSITE_MISMATCH: 'Die Scan-Adresse passt nicht zur hinterlegten Domain der Website.',
  WEBSITE_AMBIGUOUS: 'Mehrere Websites passen zu dieser Domain. Bitte die gemeinte Website wählen.',
  URL_BLOCKED: 'Dieses Ziel darf nicht gescannt werden (private Netze, lokale Adressen, Metadaten-Endpunkte).',
  // Keine Zahl im Text: Das Limit setzt der Server (tenant-audit bzw. Detektor).
  RATE_LIMITED: 'Scan-Limit erreicht. Bitte später erneut versuchen.',
};

/** Fehler von tenant-audit mit stabilem Code (z. B. für die Asset-Auswahl bei WEBSITE_AMBIGUOUS). */
export class TenantAuditError extends Error {
  constructor(message: string, readonly code: string | null, readonly status: number, readonly details?: unknown) {
    super(message);
    this.name = 'TenantAuditError';
  }
}

/**
 * Trigger an authenticated scan for the active tenant. Calls the
 * `tenant-audit` Edge Function which fans out to `gdpr-audit` and
 * persists into `scan_runs` + `findings`.
 */
export async function triggerTenantAudit(
  tenantId: string,
  url: string,
  opts: { website_id?: string } = {},
): Promise<{
  scan_run_id: string;
  finding_count: number;
  severity_max: string | null;
  asset_binding: 'website' | 'none';
  website_id: string | null;
  evidence_id: string | null;
}> {
  const sb = getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const accessToken = sess?.session?.access_token;
  if (!accessToken) throw new Error('Bitte einloggen, um einen Scan zu starten.');

  const target = auditTargetUrl(url);
  const endpoint = `${getSupabaseUrl()}/functions/v1/tenant-audit`;

  let r: Response;
  try {
    r = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Tenant-Id':   tenantId,
      },
      body: JSON.stringify({ url: target, website_id: opts.website_id }),
    });
  } catch {
    throw new Error('Scan-Dienst nicht erreichbar. Bitte Verbindung prüfen und erneut versuchen.');
  }
  // Auch ein fehlgeschlagener Lauf ist als `scan_runs`-Zeile geschrieben.
  notifyTenantDataChanged(tenantId);

  // Die Edge Function antwortet bei Gateway-Timeouts und 5xx teils mit leerem
  // Body — r.json() würde dann „Unexpected end of JSON input“ ins UI werfen.
  const raw = await r.text().catch(() => '');
  let body: {
    ok?: boolean;
    scan_run_id?: string;
    finding_count?: number;
    severity_max?: string | null;
    error?: { code?: string; message?: string; details?: unknown };
    asset_binding?: 'website' | 'none';
    website_id?: string | null;
    evidence_id?: string;
  } = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(
        r.ok
          ? 'Ungültige Antwort vom Scan-Dienst erhalten.'
          : scanErrorForStatus(r.status),
      );
    }
  }

  if (!r.ok) {
    const code = body.error?.code ?? null;
    const known = code ? SCAN_ERROR_BY_CODE[code] : undefined;
    if (known) throw new TenantAuditError(known, code, r.status, body.error?.details);
    // 5xx u. a. (tenant-audit antwortet derzeit mit 500): Status immer
    // sichtbar, Server-Detail nur als Zusatz — nie still verschlucken.
    const detail = body.error?.message;
    throw new TenantAuditError(
      detail ? `${scanErrorForStatus(r.status)} Details: ${detail}` : scanErrorForStatus(r.status),
      code,
      r.status,
      body.error?.details,
    );
  }
  if (!body.ok || !body.scan_run_id) {
    throw new Error(body.error?.message ?? 'Website-Audit fehlgeschlagen — der Audit-Dienst hat keinen Lauf angelegt.');
  }
  return {
    scan_run_id:   body.scan_run_id,
    finding_count: body.finding_count ?? 0,
    severity_max:  body.severity_max ?? null,
    asset_binding: body.asset_binding ?? (body.website_id ? 'website' : 'none'),
    website_id:    body.website_id ?? null,
    evidence_id:   body.evidence_id ?? null,
  };
}

// ─── Finding status transitions ─────────────────────────────

/**
 * Update a finding's status through the `set_finding_status` RPC — the only
 * client write path (Gate 2). A direct `findings` UPDATE matched 0 rows under
 * RLS without an error, so the UI reported success for a change that never
 * happened. The RPC checks role, tenant and transition server-side and
 * returns the written row; no row means nothing was saved, which is an error.
 */
export async function updateFindingStatus(
  findingId:   string,
  currentStatus: FindingStatus,
  nextStatus:    FindingStatus,
  tenantId?:     string | null,
): Promise<void> {
  const allowed = FINDING_NEXT_STATUS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Übergang von „${currentStatus}" auf „${nextStatus}" nicht erlaubt.`,
    );
  }
  const sb = getSupabase();
  const { data, error } = await sb.rpc('set_finding_status', {
    p_finding_id: findingId,
    p_status:     nextStatus,
  });
  if (error) throw new Error(findingStatusError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || (row as { status?: string }).status !== nextStatus) {
    throw new Error('Status wurde nicht gespeichert.');
  }
  if (tenantId) notifyTenantDataChanged(tenantId);
}

/** Maps RPC error codes of `set_finding_status` to user-facing text. */
export function findingStatusError(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case '42501': return 'Keine Berechtigung, den Status dieses Befunds zu ändern.';
    case 'P0002': return 'Befund nicht gefunden.';
    case '22023': return 'Dieser Statuswechsel ist nicht erlaubt.';
    case '23505': return 'Für diesen Sachverhalt ist bereits ein offener Befund vorhanden.';
    default:      return error.message || 'Status konnte nicht gespeichert werden.';
  }
}
