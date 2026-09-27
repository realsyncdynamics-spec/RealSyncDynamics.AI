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

import {
  startScanRun,
  recordScanFinding,
  completeScanRun,
  failScanRun,
  type AdminLike,
} from '../_shared/scan-pipeline.ts';
import {
  categoryFor,
  confidenceFor,
  evidenceLevelFor,
} from '../_shared/audit-mapping.ts';

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
}

export type RuntimeEventType = 'audit.scan_started' | 'audit.scan_completed' | 'audit.scan_failed';

export interface PipelineDeps {
  admin: AdminLike;
  /** Calls gdpr-audit. Returns the parsed body, or { httpStatus, text } on non-2xx. Throws on network error. */
  callGdprAudit: () => Promise<GdprAuditResponse | { httpStatus: number; text: string }>;
  emit: (args: {
    type: RuntimeEventType;
    severity?: 'info' | 'low' | 'medium' | 'high' | 'critical';
    correlation_id: string | null;
    payload: Record<string, unknown>;
  }) => Promise<void>;
}

export interface PipelineInput {
  tenantId: string;
  websiteId: string | null;
  url: string;
  userId: string;
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
  }
  | { ok: false; status: number; code: string; message: string; scan_run_id?: string };

export async function runTenantAuditPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineResult> {
  const { admin, emit } = deps;

  // 1. Start the run before the detector, so a detector failure is reportable.
  const started = await startScanRun(admin, {
    tenant_id: input.tenantId,
    website_id: input.websiteId,
    detector: 'gdpr-audit',
    raw_payload: { url: input.url, triggered_by: input.userId },
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
      payload: { scan_run_id, url: input.url, website_id: input.websiteId, triggered_by: input.userId, detector: 'gdpr-audit' },
    });

    // 2. Detector (gdpr-audit stays the single source of truth for the rules).
    let auditResp: GdprAuditResponse;
    try {
      const r = await deps.callGdprAudit();
      if ('httpStatus' in r) {
        return await fail(502, 'GDPR_AUDIT_HTTP', `${r.httpStatus}: ${r.text.slice(0, 300)}`, { status: r.httpStatus });
      }
      auditResp = r;
    } catch (e) {
      return await fail(502, 'GDPR_AUDIT_FETCH', `gdpr-audit fetch failed: ${(e as Error)?.message ?? String(e)}`);
    }

    // 3. Issues → findings. A failed insert fails the whole run.
    for (const issue of auditResp.issues ?? []) {
      const r = await recordScanFinding(admin, scan_run_id, correlation_id, {
        tenant_id: input.tenantId,
        website_id: input.websiteId,
        category: categoryFor(issue.id),
        severity: issue.severity,
        detector: 'gdpr-audit',
        summary: issue.title.slice(0, 1000),
        raw_payload: {
          detail: issue.detail,
          paragraph_ref: issue.paragraph_ref ?? null,
          original_id: issue.id,
          source_audit_id: auditResp.audit_id,
        },
        confidence_score: confidenceFor(issue.id),
        evidence_level: evidenceLevelFor(issue.id),
        verification_status: 'unverified',
      });
      if (!r.ok) return await fail(500, 'FINDING_INSERT', r.error ?? 'unknown');
    }

    // 4. Complete — counters are aggregated from the findings just written.
    const completed = await completeScanRun(admin, scan_run_id);
    if (!completed.ok) return await fail(500, 'PIPELINE_COMPLETE_FAILED', completed.error ?? 'unknown');

    const findingCount = completed.finding_count ?? (auditResp.issues ?? []).length;
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
    };
  } catch (e) {
    // Never leave the run `running`.
    return await fail(500, 'INTERNAL', (e as Error)?.message ?? String(e));
  }
}
