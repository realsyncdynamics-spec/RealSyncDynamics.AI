// tenant-audit pipeline core (scan_run → findings → complete/fail), split out
// of index.ts so vitest can exercise it without the Deno runtime.
//
// Bug fixed here (live v37): startScanRun returns
//   { ok: true, run: { scan_run_id, correlation_id } }
// but index.ts destructured `scan_run_id` / `correlation_id` from the TOP
// level. Both were undefined → completeScanRun(undefined) answered
// "scanRunId required" (500), findings were inserted with correlation_id ''
// (invalid uuid) and the scan_runs row stayed `running` forever.
//
// Contract now:
//   - ids come from `started.run`
//   - correlation_id is passed as `?? null`, never ''
//   - every error path after the run started marks the run `failed`
//     (including a failing completeScanRun and unexpected exceptions)

//
// Gate 2 (Website → Scan → Finding → Evidence → Dashboard):
//   - the website must belong to the tenant and match the scanned host;
//     otherwise no run is started (a foreign website_id used to anchor the
//     run to another tenant's asset)
//   - a detector response without a successful fetch fails the run: no
//     findings, no evidence, no auto-resolve (fail-closed)
//   - one hash-chained governance_evidence row per run (evidence-hash.ts
//     convention), written BEFORE the findings that cite it
//   - findings carry asset_id + evidence_id + dedupe_key; a re-scan refreshes
//     the open finding instead of duplicating it, reopens a `fixed` one that
//     is still observed and resolves the ones no longer observed (only on
//     full coverage). false_positive / ignored stay as the user set them.
//   Reference pattern: email-auth-rescan/handler.ts.

import {
  startScanRun,
  completeScanRun,
  failScanRun,
  type AdminLike,
} from '../_shared/scan-pipeline.ts';
import {
  categoryFor,
  confidenceFor,
  evidenceLevelFor,
} from '../_shared/audit-mapping.ts';
import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

export const DETECTOR = 'gdpr-audit';

export interface GdprAuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

export interface GdprAuditResponse {
  ok: boolean;
  audit_id: string;
  score: number;
  severity: string;
  domain: string;
  issues: GdprAuditIssue[];
  fetched_status: number | null;
  fetched: boolean;
  fetch_error: string | null;
  /** 'full' | 'limited' | 'failed' (scan-coverage.ts). Missing = not full. */
  coverage?: string;
}

export type RuntimeEventType = 'audit.scan_started' | 'audit.scan_completed' | 'audit.scan_failed';

export interface WebsiteRow {
  id: string;
  domain: string;
  governance_asset_id: string | null;
}

export type TrackedStatus = 'open' | 'acknowledged' | 'fixed' | 'false_positive' | 'ignored';

export interface TrackedFinding {
  id: string;
  dedupe_key: string;
  status: TrackedStatus;
  raw_payload: Record<string, unknown> | null;
}

/** Tenant-scoped persistence for the Gate-2 steps (service role, index.ts). */
export interface AuditRepo {
  /** The website with this id IN this tenant, or null. */
  findWebsite(tenantId: string, websiteId: string): Promise<WebsiteRow | null>;
  listWebsites(tenantId: string): Promise<WebsiteRow[]>;
  latestEvidenceHash(tenantId: string): Promise<string | null>;
  /**
   * Appends only while `expectedPreviousHash` is still the tenant's chain head
   * (append_governance_evidence, advisory lock per tenant); 'conflict' otherwise.
   */
  appendEvidence(row: Record<string, unknown>, expectedPreviousHash: string | null): Promise<{ id: string } | 'conflict'>;
  /** gdpr-audit findings of this tenant with a dedupe_key for `host`, status in TrackedStatus. */
  listTrackedFindings(tenantId: string, host: string): Promise<TrackedFinding[]>;
  /** 'conflict' when the open dedupe_key index already holds a row. */
  insertFinding(row: Record<string, unknown>): Promise<{ id: string } | 'conflict'>;
  /** Updates the row only while its status is still `expectStatus`; returns the rows changed. */
  updateFinding(id: string, expectStatus: TrackedStatus, patch: Record<string, unknown>): Promise<number>;
}

export interface PipelineDeps {
  admin: AdminLike;
  repo: AuditRepo;
  /** Calls gdpr-audit. Returns the parsed body, or { httpStatus, text } on non-2xx. Throws on network error. */
  callGdprAudit: () => Promise<GdprAuditResponse | { httpStatus: number; text: string }>;
  emit: (args: {
    type: RuntimeEventType;
    severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
    correlation_id: string | null;
    payload: Record<string, unknown>;
  }) => Promise<void>;
  uuid?: () => string;
  now?: () => Date;
}

export interface PipelineInput {
  tenantId: string;
  websiteId: string | null;
  url: string;
  userId: string;
}

export interface FindingOutcome {
  created: number;
  refreshed: number;
  reopened: number;
  resolved: number;
  suppressed: number;
}

export type PipelineResult =
  | {
    ok: true;
    scan_run_id: string;
    correlation_id: string | null;
    finding_count: number;
    severity_max: string | null;
    gdpr_audit_id: string;
    score: number;
    severity: string;
    website_id: string | null;
    asset_id: string | null;
    evidence_id: string;
    findings: FindingOutcome;
  }
  | { ok: false; status: number; code: string; message: string; scan_run_id?: string; details?: Record<string, unknown> };

/** Host without scheme, port, path and leading `www.` — lowercase. '' when unparsable. */
export function siteHost(urlOrDomain: string): string {
  const raw = (urlOrDomain ?? '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function dedupeKey(issueId: string, host: string): string {
  return `gdpr_audit.${issueId}:${host}`;
}

/** Attempts to append to the evidence chain before the run fails. */
export const EVIDENCE_APPEND_ATTEMPTS = 3;

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

type ResolvedTarget =
  | { ok: true; website: WebsiteRow | null }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

/**
 * The website a scan is anchored to. A given website_id must belong to the
 * tenant and match the scanned host; without one:
 *   0 matches → unanchored scan (defined: asset_binding 'none')
 *   1 match   → that website
 *   >1        → 409 WEBSITE_AMBIGUOUS with the candidates — never guessed;
 *               the caller must choose a website_id or abort (2026-09-29).
 */
export async function resolveTarget(repo: AuditRepo, input: PipelineInput, host: string): Promise<ResolvedTarget> {
  if (input.websiteId) {
    const w = await repo.findWebsite(input.tenantId, input.websiteId);
    if (!w) return { ok: false, status: 404, code: 'WEBSITE_NOT_FOUND', message: 'website not found in this tenant' };
    if (siteHost(w.domain) !== host) {
      return { ok: false, status: 400, code: 'URL_WEBSITE_MISMATCH', message: `url host ${host} does not match website ${siteHost(w.domain)}` };
    }
    return { ok: true, website: w };
  }
  const matches = (await repo.listWebsites(input.tenantId)).filter((w) => siteHost(w.domain) === host);
  if (matches.length > 1) {
    return {
      ok: false,
      status: 409,
      code: 'WEBSITE_AMBIGUOUS',
      message: `${matches.length} websites of this tenant match ${host}; choose website_id`,
      details: { candidates: matches.map((w) => ({ id: w.id, domain: w.domain })) },
    };
  }
  return { ok: true, website: matches[0] ?? null };
}

function uuidv4(): string {
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).crypto.randomUUID();
}

function withHistory(
  raw: Record<string, unknown> | null,
  entry: { from: string; to: string; at: string; scan_run_id: string },
): Record<string, unknown> {
  const base = raw ?? {};
  const history = Array.isArray(base.status_history) ? base.status_history : [];
  return { ...base, status_history: [...history, { ...entry, by: 'scanner' }] };
}

export async function runTenantAuditPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineResult> {
  const { admin, repo, emit } = deps;
  const uuid = deps.uuid ?? uuidv4;
  const now = deps.now ?? (() => new Date());

  // 0. Anchor — before the run exists, so a foreign website never gets one.
  const host = siteHost(input.url);
  if (!host) return { ok: false, status: 400, code: 'INVALID_URL', message: 'unparsable url' };
  let target: ResolvedTarget;
  try {
    target = await resolveTarget(repo, input, host);
  } catch (e) {
    return { ok: false, status: 500, code: 'WEBSITE_LOOKUP_FAILED', message: (e as Error)?.message ?? String(e) };
  }
  if (!target.ok) return target;
  const website = target.website;
  const websiteId = website?.id ?? null;
  const assetId = website?.governance_asset_id ?? null;

  // 1. Start the run before the detector, so a detector failure is reportable.
  const started = await startScanRun(admin, {
    tenant_id: input.tenantId,
    website_id: websiteId,
    detector: DETECTOR,
    raw_payload: { url: input.url, host, triggered_by: input.userId },
  });
  if (!started.ok) return { ok: false, status: 500, code: 'PIPELINE_START_FAILED', message: started.error };
  const scan_run_id = started.run.scan_run_id;
  const correlation_id = started.run.correlation_id ?? null;

  const fail = async (status: number, code: string, message: string, extra: Record<string, unknown> = {}): Promise<PipelineResult> => {
    const f = await failScanRun(admin, scan_run_id, code, message.slice(0, 1000));
    if (!f.ok) {
      console.error(JSON.stringify({ level: 'error', scope: 'tenant_audit_fail_scan_run_failed', scan_run_id, error: f.error }));
    }
    await emit({
      type: 'audit.scan_failed', severity: 'medium', correlation_id,
      payload: { scan_run_id, error_code: code, message: message.slice(0, 300), ...extra },
    });
    return { ok: false, status, code, message, scan_run_id };
  };

  try {
    await emit({
      type: 'audit.scan_started',
      correlation_id,
      payload: { scan_run_id, url: input.url, website_id: websiteId, asset_id: assetId, triggered_by: input.userId, detector: DETECTOR },
    });

    // 2. Detector (gdpr-audit stays the single source of truth for the rules).
    let auditResp: GdprAuditResponse;
    try {
      const r = await deps.callGdprAudit();
      if ('httpStatus' in r) {
        // Limit des Detektors erreicht: als 429 weitergeben, nicht als 502.
        if (r.httpStatus === 429) {
          return await fail(429, 'RATE_LIMITED', 'detector rate limit reached, retry later', { status: 429 });
        }
        return await fail(502, 'GDPR_AUDIT_HTTP', `${r.httpStatus}: ${r.text.slice(0, 300)}`, { status: r.httpStatus });
      }
      auditResp = r;
    } catch (e) {
      return await fail(502, 'GDPR_AUDIT_FETCH', `gdpr-audit fetch failed: ${(e as Error)?.message ?? String(e)}`);
    }

    // 3. Fail-closed: without a fetched page there is no observation — no
    //    findings, no evidence, and above all nothing gets auto-resolved.
    if (!auditResp.fetched) {
      return await fail(502, 'TARGET_UNREACHABLE',
        `target not fetched (status ${auditResp.fetched_status ?? 'none'}): ${auditResp.fetch_error ?? 'unknown'}`,
        { fetched_status: auditResp.fetched_status });
    }

    // One issue per id; the detector may repeat an id (subpages).
    const issues = new Map<string, GdprAuditIssue>();
    for (const issue of auditResp.issues ?? []) {
      if (!issue || typeof issue.id !== 'string' || !SEVERITIES.has(issue.severity)) {
        return await fail(502, 'DETECTOR_INVALID', 'gdpr-audit returned a malformed issue');
      }
      if (!issues.has(issue.id)) issues.set(issue.id, issue);
    }
    const fullCoverage = auditResp.coverage === 'full';
    const checkedAt = now().toISOString();

    // 4. Evidence first — every finding written below cites it. Appended by
    //    compare-and-swap on the chain head: a concurrent writer moves the
    //    head, we re-read, re-hash (previous_hash is part of the snapshot)
    //    and retry — the chain never branches.
    const evidenceId = uuid();
    let evidence: { id: string } | null = null;
    try {
      for (let attempt = 0; attempt < EVIDENCE_APPEND_ATTEMPTS && !evidence; attempt++) {
        const previousHash = await repo.latestEvidenceHash(input.tenantId);
        const snapshot = {
          tenant_id: input.tenantId,
          asset_id: assetId,
          website_id: websiteId,
          scan_run_id,
          evidence_id: evidenceId,
          detector: DETECTOR,
          url: input.url,
          host,
          checked_at: checkedAt,
          gdpr_audit_id: auditResp.audit_id,
          fetched_status: auditResp.fetched_status,
          coverage: auditResp.coverage ?? null,
          score: auditResp.score,
          severity: auditResp.severity,
          issues: [...issues.values()].map((i) => ({
            id: i.id, severity: i.severity, title: i.title, paragraph_ref: i.paragraph_ref ?? null,
          })),
          previous_hash: previousHash,
        };
        const appended = await repo.appendEvidence({
          id: evidenceId,
          tenant_id: input.tenantId,
          event_id: null,
          asset_id: assetId,
          evidence_type: 'json',
          title: `Website-Audit ${host}`.slice(0, 500),
          storage_path: null,
          content_hash: await evidenceContentHash(snapshot),
          previous_hash: previousHash,
          metadata: {
            source: 'tenant-audit',
            detector: DETECTOR,
            scan_run_id,
            gdpr_audit_id: auditResp.audit_id,
            url: input.url,
            hash_method: EVIDENCE_HASH_METHOD,
            snapshot,
          },
        }, previousHash);
        if (appended !== 'conflict') evidence = appended;
      }
    } catch (e) {
      return await fail(500, 'EVIDENCE_INSERT', (e as Error)?.message ?? String(e));
    }
    if (!evidence) {
      return await fail(503, 'EVIDENCE_CHAIN_CONFLICT',
        `evidence chain head kept moving (${EVIDENCE_APPEND_ATTEMPTS} attempts)`);
    }
    const evidenceRow = evidence;

    // 5. Findings — refresh / reopen / create / resolve against the tracked set.
    const outcome: FindingOutcome = { created: 0, refreshed: 0, reopened: 0, resolved: 0, suppressed: 0 };
    try {
      const tracked = (await repo.listTrackedFindings(input.tenantId, host))
        .filter((f) => f.dedupe_key.startsWith('gdpr_audit.') && f.dedupe_key.endsWith(`:${host}`));
      const byKey = new Map<string, TrackedFinding[]>();
      for (const f of tracked) byKey.set(f.dedupe_key, [...(byKey.get(f.dedupe_key) ?? []), f]);
      const pick = (key: string, statuses: TrackedStatus[]) =>
        (byKey.get(key) ?? []).find((f) => statuses.includes(f.status)) ?? null;

      const observed = new Set<string>();
      for (const issue of issues.values()) {
        const key = dedupeKey(issue.id, host);
        observed.add(key);
        const fields = {
          scan_run_id,
          correlation_id,
          evidence_id: evidenceRow.id,
          asset_id: assetId,
          website_id: websiteId,
          severity: issue.severity,
          summary: issue.title.slice(0, 1000),
        };
        const payload = {
          detail: issue.detail,
          paragraph_ref: issue.paragraph_ref ?? null,
          original_id: issue.id,
          source_audit_id: auditResp.audit_id,
          last_seen_at: checkedAt,
          last_scan_run_id: scan_run_id,
        };

        const active = pick(key, ['open', 'acknowledged']);
        if (active) {
          if (await repo.updateFinding(active.id, active.status, { ...fields, raw_payload: { ...(active.raw_payload ?? {}), ...payload } })) {
            outcome.refreshed++;
          }
          continue;
        }
        const suppressed = pick(key, ['false_positive', 'ignored']);
        if (suppressed) {
          // The user's decision stands; only the sighting is recorded.
          const n = await repo.updateFinding(suppressed.id, suppressed.status, {
            raw_payload: { ...(suppressed.raw_payload ?? {}), last_seen_at: checkedAt, last_scan_run_id: scan_run_id, last_evidence_id: evidenceRow.id },
          });
          if (n) outcome.suppressed++;
          continue;
        }
        const fixed = pick(key, ['fixed']);
        if (fixed) {
          // Marked fixed, still observed: the scan contradicts it → reopen.
          const n = await repo.updateFinding(fixed.id, 'fixed', {
            ...fields, status: 'open', resolved_at: null,
            raw_payload: withHistory({ ...(fixed.raw_payload ?? {}), ...payload }, { from: 'fixed', to: 'open', at: checkedAt, scan_run_id }),
          });
          if (n) outcome.reopened++;
          continue;
        }
        const ins = await repo.insertFinding({
          ...fields,
          id: uuid(),
          tenant_id: input.tenantId,
          category: categoryFor(issue.id),
          status: 'open',
          detector: DETECTOR,
          dedupe_key: key,
          raw_payload: { ...payload, first_seen_at: checkedAt, first_scan_run_id: scan_run_id },
          confidence_score: confidenceFor(issue.id),
          evidence_level: evidenceLevelFor(issue.id),
          verification_status: 'unverified',
        });
        if (ins !== 'conflict') outcome.created++;
      }

      // No longer observed → resolved, with this run's evidence as the proof.
      // Only on full coverage: a limited scan proves no absence.
      if (fullCoverage) {
        for (const f of tracked) {
          if (observed.has(f.dedupe_key)) continue;
          if (f.status !== 'open' && f.status !== 'acknowledged' && f.status !== 'fixed') continue;
          const n = await repo.updateFinding(f.id, f.status, {
            status: 'resolved',
            resolved_at: checkedAt,
            evidence_id: evidenceRow.id,
            raw_payload: withHistory(f.raw_payload, { from: f.status, to: 'resolved', at: checkedAt, scan_run_id }),
          });
          if (n) outcome.resolved++;
        }
      }
    } catch (e) {
      return await fail(500, 'FINDING_INSERT', (e as Error)?.message ?? String(e), { evidence_id: evidenceRow.id });
    }

    // 6. Complete — counters are aggregated from the findings stamped with this run.
    const completed = await completeScanRun(admin, scan_run_id);
    if (!completed.ok) return await fail(500, 'PIPELINE_COMPLETE_FAILED', completed.error ?? 'unknown');

    const findingCount = completed.finding_count ?? issues.size;
    await emit({
      type: 'audit.scan_completed',
      severity: completed.severity_max === 'critical' || completed.severity_max === 'high' ? 'high' : 'info',
      correlation_id,
      payload: {
        scan_run_id,
        finding_count: findingCount,
        severity_max: completed.severity_max ?? null,
        gdpr_audit_id: auditResp.audit_id,
        score: auditResp.score,
        evidence_id: evidenceRow.id,
        asset_id: assetId,
        findings: outcome,
      },
    });

    return {
      ok: true,
      scan_run_id,
      correlation_id,
      finding_count: findingCount,
      severity_max: completed.severity_max ?? null,
      gdpr_audit_id: auditResp.audit_id,
      score: auditResp.score,
      severity: auditResp.severity,
      website_id: websiteId,
      asset_id: assetId,
      evidence_id: evidenceRow.id,
      findings: outcome,
    };
  } catch (e) {
    // Never leave the run `running`.
    return await fail(500, 'INTERNAL', (e as Error)?.message ?? String(e));
  }
}
