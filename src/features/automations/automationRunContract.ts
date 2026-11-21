/** Contract for asynchronous automation runs. Never synthesize a scan result. */
export type AutomationRunStatus = 'queued' | 'running' | 'success' | 'error' | 'timeout' | 'cancelled';

export interface AuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
}

export interface AuditResult {
  audit_id: string;
  score: number;
  severity: string;
  domain: string;
  issues: AuditIssue[];
  coverage: string;
  coverage_notice?: string | null;
}

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const TERMINAL = new Set<AutomationRunStatus>(['success', 'error', 'timeout', 'cancelled']);

export function isTerminalRun(status: string): boolean {
  return TERMINAL.has(status as AutomationRunStatus);
}

/** Returns null for incomplete/unknown n8n payloads; the UI must show an error. */
export function parseAuditRunResult(value: unknown): AuditResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (typeof data.audit_id !== 'string' || !data.audit_id ||
      typeof data.domain !== 'string' || !data.domain ||
      typeof data.score !== 'number' || !Number.isFinite(data.score) ||
      data.score < 0 || data.score > 100 ||
      typeof data.severity !== 'string' || !Array.isArray(data.issues)) return null;
  const issues: AuditIssue[] = [];
  for (const issue of data.issues) {
    if (!issue || typeof issue !== 'object' || Array.isArray(issue)) return null;
    const row = issue as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string' ||
        typeof row.detail !== 'string' || typeof row.severity !== 'string' ||
        !SEVERITIES.has(row.severity)) return null;
    issues.push({ id: row.id, title: row.title, detail: row.detail, severity: row.severity as AuditIssue['severity'] });
  }
  return {
    audit_id: data.audit_id,
    score: data.score,
    domain: data.domain,
    severity: data.severity,
    issues,
    coverage: typeof data.coverage === 'string' ? data.coverage : 'unknown',
    coverage_notice: typeof data.coverage_notice === 'string' ? data.coverage_notice : null,
  };
}
