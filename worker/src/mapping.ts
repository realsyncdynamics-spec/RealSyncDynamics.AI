/**
 * Reine Mapping-Logik: Rule-Engine-Finding → public.findings-Zeile.
 *
 * Bewusst ohne Playwright-/DB-Import, damit vitest diese Funktionen direkt
 * testen kann (worker/src/crawler.ts zieht 'playwright' und ist im Node-Test
 * nicht importierbar).
 *
 * Schema-Quellen:
 *   - findings.category-CHECK  → 20260610200000_findings_domain_entity.sql
 *   - findings.severity-CHECK  → ebd.
 *   - scan_runs.severity_max   → 20260611000000_scan_runs_and_findings_link.sql
 *   - Rule-Engine-Kategorien   → src/rules/types.ts (RuleCategory)
 */

export type DbFindingCategory =
  | 'consent' | 'tracker' | 'ai_act' | 'tom' | 'dpa'
  | 'accessibility' | 'security' | 'transparency' | 'data_quality'
  | 'documentation' | 'other';

export type DbSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Rule-Engine-Kategorie (src/rules/types.ts) → DB-findings.category.
// Unbekannte/zukünftige Kategorien fallen auf 'other' zurück, damit ein
// neuer Rule-Typ nie den CHECK-Constraint bricht.
const RULE_CATEGORY_TO_DB: Record<string, DbFindingCategory> = {
  tracking: 'tracker',
  consent: 'consent',
  transparency: 'transparency',
  'data-transfer': 'other',
  rights: 'other',
  documentation: 'documentation',
  'ai-act': 'ai_act',
  security: 'security',
};

export function mapRuleCategory(category: string): DbFindingCategory {
  return RULE_CATEGORY_TO_DB[category] ?? 'other';
}

const VALID_SEVERITIES: ReadonlySet<DbSeverity> = new Set<DbSeverity>([
  'critical', 'high', 'medium', 'low', 'info',
]);

// Rule-Severities sind low|medium|high|critical — alle gültig. Unbekanntes
// (defensiv) → 'info', die niedrigste DB-Severity.
export function mapRuleSeverity(severity: string): DbSeverity {
  return VALID_SEVERITIES.has(severity as DbSeverity) ? (severity as DbSeverity) : 'info';
}

const SEVERITY_RANK: Record<DbSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
};

/** Höchste Severity einer Finding-Liste für scan_runs.severity_max. */
export function maxSeverity(severities: string[]): DbSeverity | null {
  let best: DbSeverity | null = null;
  let bestRank = -1;
  for (const s of severities) {
    const sev = mapRuleSeverity(s);
    const rank = SEVERITY_RANK[sev];
    if (rank > bestRank) { best = sev; bestRank = rank; }
  }
  return best;
}

/** Strukturell typisiertes Rule-Engine-Finding (vgl. src/rules/types.ts Finding). */
export interface RuleFindingLike {
  rule_id: string;
  title: string;
  description?: string;
  severity: string;
  category: string;
  norms?: string[];
  matched_facts?: Record<string, unknown>;
  remediation?: unknown;
}

export interface FindingRowContext {
  tenant_id: string;
  scan_run_id: string;
  correlation_id: string;
  website_id?: string | null;
  detector: string;
  evidence_ref?: string | null;
}

export interface DbFindingRow {
  tenant_id: string;
  website_id: string | null;
  scan_run_id: string;
  correlation_id: string;
  category: DbFindingCategory;
  severity: DbSeverity;
  status: 'open';
  detector: string;
  evidence_ref: string | null;
  summary: string;
  raw_payload: Record<string, unknown>;
}

// findings.summary-CHECK erlaubt 1..1000 Zeichen.
export function truncateSummary(s: string, max = 1000): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export function mapRuleFindingToRow(
  finding: RuleFindingLike,
  ctx: FindingRowContext,
): DbFindingRow {
  return {
    tenant_id: ctx.tenant_id,
    website_id: ctx.website_id ?? null,
    scan_run_id: ctx.scan_run_id,
    correlation_id: ctx.correlation_id,
    category: mapRuleCategory(finding.category),
    severity: mapRuleSeverity(finding.severity),
    status: 'open',
    detector: ctx.detector,
    evidence_ref: ctx.evidence_ref ?? null,
    // title kann leer sein → rule_id als Fallback, damit summary-CHECK (>=1) hält.
    summary: truncateSummary(finding.title || finding.rule_id),
    raw_payload: { ...finding },
  };
}
