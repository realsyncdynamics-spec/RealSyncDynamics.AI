/**
 * Admin Compliance KPI shell — field contract from RSD backend catalog
 * (compliance_score_history + digest payload keys). Anzeige only; never invent scores.
 *
 * Rules:
 *   null  → unknown / EmptyState ("—")
 *   0     → measured zero (valid display)
 */

import { formatMetric, type MetricValue } from '../../../lib/status/statusAdapter';

export type RiskTrendDirection = 'improving' | 'stable' | 'declining';

export interface ComplianceScoreBreakdown {
  score_gdpr: MetricValue;
  score_nis2: MetricValue;
  score_dsa: MetricValue;
  score_ai_act: MetricValue;
  policy_compliance: MetricValue;
  vendor_risk: MetricValue;
  incident_response: MetricValue;
  data_governance: MetricValue;
}

/** Compliance slice aligned with GET /admin/dashboard/governance-compliance stub. */
export interface ComplianceKpiSnapshot {
  score_overall: MetricValue;
  score_breakdown: ComplianceScoreBreakdown;
  riskTrendDirection: RiskTrendDirection | null;
  criticalFindings: MetricValue;
  newIncidents: MetricValue;
  resolvedIncidents: MetricValue;
  /** Count of upcoming deadlines (digest). Array length or SQL count — never invent. */
  upcomingDeadlines: MetricValue;
  policies: {
    documented: MetricValue;
    pending: MetricValue;
  };
  vendors: {
    active: MetricValue;
    highRisk: MetricValue;
  };
}

export interface ComplianceRefreshMeta {
  ok: boolean;
  action?: string;
  updated_count?: number;
  insights_generated?: number;
  digests_created?: number;
  timestamp_utc?: string;
  error?: string;
}

export interface GovernanceComplianceSnapshot {
  source: 'live' | 'fixture';
  generated_at: string;
  tenant_id: string | null;
  compliance: ComplianceKpiSnapshot;
  /** Quota/roles deferred — stub nulls only this PR. */
  governance: {
    quota: {
      bots_used: MetricValue;
      bots_limit_key: string;
      bots_usage_key: string;
      bot_messages_used: MetricValue;
      bot_messages_limit_key: string;
    };
    roles: readonly string[];
  };
  last_refresh_meta: ComplianceRefreshMeta | null;
}

export const BREAKDOWN_CHIP_DEFS: ReadonlyArray<{
  key: keyof ComplianceScoreBreakdown;
  label: string;
}> = [
  { key: 'score_gdpr', label: 'GDPR' },
  { key: 'score_nis2', label: 'NIS2' },
  { key: 'score_dsa', label: 'DSA' },
  { key: 'score_ai_act', label: 'AI-Act' },
  { key: 'policy_compliance', label: 'Policy' },
  { key: 'vendor_risk', label: 'Vendor' },
  { key: 'incident_response', label: 'Incident' },
  { key: 'data_governance', label: 'Data Gov' },
];

export const EMPTY_SCORE_BREAKDOWN: ComplianceScoreBreakdown = {
  score_gdpr: null,
  score_nis2: null,
  score_dsa: null,
  score_ai_act: null,
  policy_compliance: null,
  vendor_risk: null,
  incident_response: null,
  data_governance: null,
};

export const EMPTY_COMPLIANCE_KPI: ComplianceKpiSnapshot = {
  score_overall: null,
  score_breakdown: { ...EMPTY_SCORE_BREAKDOWN },
  riskTrendDirection: null,
  criticalFindings: null,
  newIncidents: null,
  resolvedIncidents: null,
  upcomingDeadlines: null,
  policies: { documented: null, pending: null },
  vendors: { active: null, highRisk: null },
};

export function emptyGovernanceComplianceSnapshot(
  overrides?: Partial<GovernanceComplianceSnapshot>,
): GovernanceComplianceSnapshot {
  return {
    source: 'live',
    generated_at: new Date().toISOString(),
    tenant_id: null,
    compliance: {
      ...EMPTY_COMPLIANCE_KPI,
      score_breakdown: { ...EMPTY_SCORE_BREAKDOWN },
      policies: { documented: null, pending: null },
      vendors: { active: null, highRisk: null },
    },
    governance: {
      quota: {
        bots_used: null,
        bots_limit_key: 'limit.bots',
        bots_usage_key: 'bots.count',
        bot_messages_used: null,
        bot_messages_limit_key: 'limit.bot_messages_monthly',
      },
      roles: ['owner', 'admin', 'dpo', 'editor', 'viewer_auditor'] as const,
    },
    last_refresh_meta: null,
    ...overrides,
  };
}

/** Display helper — re-exports statusAdapter rule (null → "—", 0 → "0"). */
export function formatComplianceMetric(value: MetricValue, suffix = ''): string {
  return formatMetric(value, suffix);
}

export function formatRiskTrend(direction: RiskTrendDirection | null): string {
  if (direction === null) return '—';
  switch (direction) {
    case 'improving':
      return 'steigend';
    case 'stable':
      return 'stabil';
    case 'declining':
      return 'sinkend';
    default:
      return '—';
  }
}

export function parseRiskTrend(value: unknown): RiskTrendDirection | null {
  if (value === 'improving' || value === 'stable' || value === 'declining') return value;
  return null;
}

/** Coerce a DB number field: missing/non-finite → null; 0 stays 0. */
export function asMetric(value: unknown): MetricValue {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
