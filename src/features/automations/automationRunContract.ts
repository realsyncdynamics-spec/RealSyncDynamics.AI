/** Contract for the asynchronous automation-trigger -> automation_runs pipeline. */
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'error' | 'timeout' | 'cancelled';

export interface AuditIssue {
  id: string;
  severity: string;
  title: string;
}

export interface AuditResult {
  audit_id: string;
  score: number;
  severity: string;
  domain: string;
  issues: AuditIssue[];
  coverage_notice?: string | null;
}

const terminal: readonly AutomationRunStatus[] = ['success', 'error', 'timeout', 'cancelled'];
export function isTerminalAutomationStatus(status: string): boolean {
  return terminal.includes(status as AutomationRunStatus);
}

/** n8n result is untrusted JSON. Never render an invented or unvalidated audit result. */
export function parseAutomationAuditResult(value: unknown): AuditResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.audit_id !== 'string' || typeof r.domain !== 'string' ||
      typeof r.severity !== 'string' || typeof r.score !== 'number' ||
      !Number.isFinite(r.score) || r.score < 0 || r.score > 100 ||
      !Array.isArray(r.issues)) return null;
  if (!r.issues.every((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const issue = item as Record<string, unknown>;
    return typeof issue.id === 'string' && typeof issue.severity === 'string' &&
      typeof issue.title === 'string';
  })) return null;
  return {
    audit_id: r.audit_id, domain: r.domain, severity: r.severity,
    score: r.score, issues: r.issues as AuditIssue[],
    coverage_notice: typeof r.coverage_notice === 'string' ? r.coverage_notice : null,
  };
}

/** Local input validation (server-side authorization is always authoritative). */
export function isHttpTarget(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !!url.hostname;
  } catch {
    return false;
  }
}
