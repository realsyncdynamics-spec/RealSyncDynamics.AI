/**
 * Loads Admin Compliance KPI data from tables (not function HTTP bodies).
 *
 * Scores:    compliance_score_history (latest row per tenant)
 * Digest:    same source tables digest-generate uses (incidents, audits,
 *            dpia_assessments, compliance_policies, vendors) + trend from score row.
 *
 * Null-vs-0 contract (statusAdapter / target-architecture §3.1):
 *   query error or missing row  → null
 *   successful empty count      → 0
 *   measured score 0            → 0
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../../lib/supabase';
import type { MetricValue } from '../../../lib/status/statusAdapter';
import {
  asMetric,
  emptyGovernanceComplianceSnapshot,
  EMPTY_SCORE_BREAKDOWN,
  parseRiskTrend,
  type ComplianceKpiSnapshot,
  type GovernanceComplianceSnapshot,
} from './complianceTypes';

type MV = MetricValue;

interface ScoreRow {
  score_overall: number | null;
  score_gdpr: number | null;
  score_nis2: number | null;
  score_dsa: number | null;
  score_ai_act: number | null;
  policy_compliance: number | null;
  vendor_risk: number | null;
  incident_response: number | null;
  data_governance: number | null;
  trend_direction: string | null;
  recorded_at?: string;
}

/** Loose thenable chain — mirrors statusAdapter stub shape for tests. */
type FilterChain = {
  eq: (...args: unknown[]) => FilterChain;
  gte: (...args: unknown[]) => FilterChain;
  lte: (...args: unknown[]) => FilterChain;
  order: (...args: unknown[]) => FilterChain;
  limit: (...args: unknown[]) => PromiseLike<QueryPayload>;
  maybeSingle: () => PromiseLike<QueryPayload>;
  then: (resolve: (value: QueryPayload) => unknown, reject?: (reason: unknown) => unknown) => PromiseLike<unknown>;
};

type QueryPayload = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};

function mapScoreRow(row: ScoreRow | null): Pick<
  ComplianceKpiSnapshot,
  'score_overall' | 'score_breakdown' | 'riskTrendDirection'
> {
  if (!row) {
    return {
      score_overall: null,
      score_breakdown: { ...EMPTY_SCORE_BREAKDOWN },
      riskTrendDirection: null,
    };
  }
  return {
    score_overall: asMetric(row.score_overall),
    score_breakdown: {
      score_gdpr: asMetric(row.score_gdpr),
      score_nis2: asMetric(row.score_nis2),
      score_dsa: asMetric(row.score_dsa),
      score_ai_act: asMetric(row.score_ai_act),
      policy_compliance: asMetric(row.policy_compliance),
      vendor_risk: asMetric(row.vendor_risk),
      incident_response: asMetric(row.incident_response),
      data_governance: asMetric(row.data_governance),
    },
    riskTrendDirection: parseRiskTrend(row.trend_direction),
  };
}

async function headCount(chain: FilterChain): Promise<MV> {
  const { count, error } = await chain;
  if (error) return null;
  return count ?? 0;
}

/**
 * Load compliance KPI snapshot for one tenant.
 * Each source fails independently → null for that field only.
 */
export async function loadComplianceKpiForTenant(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ComplianceKpiSnapshot> {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  const since = twentyFourHoursAgo.toISOString();

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const until = thirtyDaysFromNow.toISOString();

  const scoreQuery = supabase
    .from('compliance_score_history')
    .select(
      'score_overall, score_gdpr, score_nis2, score_dsa, score_ai_act, policy_compliance, vendor_risk, incident_response, data_governance, trend_direction, recorded_at',
    )
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false })
    .limit(1) as unknown as PromiseLike<QueryPayload>;

  const newIncidentsQ = supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .eq('status', 'open') as unknown as FilterChain;

  const resolvedIncidentsQ = supabase
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('updated_at', since)
    .eq('status', 'resolved') as unknown as FilterChain;

  const deadlinesQ = supabase
    .from('dpia_assessments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lte('due_date', until) as unknown as FilterChain;

  const auditQuery = supabase
    .from('audits')
    .select('findings_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1) as unknown as PromiseLike<QueryPayload>;

  const policiesQuery = supabase
    .from('compliance_policies')
    .select('status')
    .eq('tenant_id', tenantId) as unknown as PromiseLike<QueryPayload>;

  const vendorsQuery = supabase
    .from('vendors')
    .select('risk_level')
    .eq('tenant_id', tenantId) as unknown as PromiseLike<QueryPayload>;

  const [
    scoreResult,
    newIncidents,
    resolvedIncidents,
    upcomingDeadlines,
    auditResult,
    policiesResult,
    vendorsResult,
  ] = await Promise.all([
    scoreQuery,
    headCount(newIncidentsQ),
    headCount(resolvedIncidentsQ),
    headCount(deadlinesQ),
    auditQuery,
    policiesQuery,
    vendorsQuery,
  ]);

  const scoreRow = scoreResult.error
    ? null
    : ((Array.isArray(scoreResult.data) ? scoreResult.data[0] : null) as ScoreRow | null);
  const scored = mapScoreRow(scoreRow);

  let criticalFindings: MV = null;
  if (!auditResult.error) {
    const row = Array.isArray(auditResult.data) ? auditResult.data[0] as { findings_count: unknown } | undefined : undefined;
    criticalFindings = row ? asMetric(row.findings_count) : null;
  }

  let policiesDocumented: MV = null;
  let policiesPending: MV = null;
  if (!policiesResult.error) {
    const rows = (Array.isArray(policiesResult.data) ? policiesResult.data : []) as Array<{ status: string }>;
    policiesDocumented = rows.filter((p) => p.status === 'approved').length;
    policiesPending = rows.filter((p) => p.status === 'draft').length;
  }

  let vendorsActive: MV = null;
  let vendorsHighRisk: MV = null;
  if (!vendorsResult.error) {
    const rows = (Array.isArray(vendorsResult.data) ? vendorsResult.data : []) as Array<{ risk_level: string }>;
    vendorsActive = rows.length;
    vendorsHighRisk = rows.filter((v) => v.risk_level === 'high').length;
  }

  return {
    ...scored,
    criticalFindings,
    newIncidents,
    resolvedIncidents,
    upcomingDeadlines,
    policies: { documented: policiesDocumented, pending: policiesPending },
    vendors: { active: vendorsActive, highRisk: vendorsHighRisk },
  };
}

export async function loadGovernanceCompliance(opts: {
  tenantId?: string | null;
  supabase?: SupabaseClient;
}): Promise<GovernanceComplianceSnapshot> {
  const supabase = opts.supabase ?? getSupabase();
  const tenantId = opts.tenantId ?? null;

  if (!tenantId) {
    return emptyGovernanceComplianceSnapshot({
      source: 'live',
      generated_at: new Date().toISOString(),
      tenant_id: null,
    });
  }

  const compliance = await loadComplianceKpiForTenant(supabase, tenantId);
  return emptyGovernanceComplianceSnapshot({
    source: 'live',
    generated_at: new Date().toISOString(),
    tenant_id: tenantId,
    compliance,
  });
}
