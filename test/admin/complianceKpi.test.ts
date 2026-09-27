import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getComplianceGovernanceFixture,
  getComplianceGovernancePopulatedFixture,
} from '../../src/features/admin/compliance/complianceFixture';
import { loadComplianceKpiForTenant } from '../../src/features/admin/compliance/loadComplianceGovernance';
import {
  asMetric,
  BREAKDOWN_CHIP_DEFS,
  formatComplianceMetric,
  formatRiskTrend,
  parseRiskTrend,
} from '../../src/features/admin/compliance/complianceTypes';

const TENANT = '11111111-1111-1111-1111-111111111111';

type TableResult = {
  data?: unknown;
  count?: number | null;
  error?: { message: string } | null;
};

/**
 * Minimal Supabase stub — same contract as statusAdapter tests.
 * Supports order().limit(), eq/gte/lte chains, and head counts.
 */
function stubClient(tables: Record<string, TableResult>): SupabaseClient {
  const from = (table: string) => {
    const result = tables[table] ?? { error: { message: `unstubbed table ${table}` } };
    const payload = {
      data: result.data ?? null,
      count: result.count ?? null,
      error: result.error ?? null,
    };
    const chain = {
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => Promise.resolve(payload),
      maybeSingle: () => Promise.resolve(payload),
      then: (resolve: (value: typeof payload) => unknown) => Promise.resolve(payload).then(resolve),
    };
    return { select: () => chain };
  };
  return { from } as unknown as SupabaseClient;
}

describe('compliance KPI null-vs-0 contract', () => {
  it('formatComplianceMetric: null → "—", 0 → "0"', () => {
    expect(formatComplianceMetric(null)).toBe('—');
    expect(formatComplianceMetric(0)).toBe('0');
    expect(formatComplianceMetric(72)).toBe('72');
  });

  it('asMetric keeps 0 and drops non-finite', () => {
    expect(asMetric(0)).toBe(0);
    expect(asMetric(null)).toBeNull();
    expect(asMetric(undefined)).toBeNull();
    expect(asMetric(Number.NaN)).toBeNull();
  });

  it('parseRiskTrend accepts catalog values only', () => {
    expect(parseRiskTrend('improving')).toBe('improving');
    expect(parseRiskTrend('stable')).toBe('stable');
    expect(parseRiskTrend('declining')).toBe('declining');
    expect(parseRiskTrend('up')).toBeNull();
    expect(parseRiskTrend(null)).toBeNull();
  });

  it('formatRiskTrend EmptyState for null', () => {
    expect(formatRiskTrend(null)).toBe('—');
    expect(formatRiskTrend('stable')).toBe('stabil');
  });
});

describe('compliance fixtures', () => {
  it('empty fixture has null scores (never invents)', () => {
    const fix = getComplianceGovernanceFixture();
    expect(fix.source).toBe('fixture');
    expect(fix.compliance.score_overall).toBeNull();
    expect(fix.compliance.riskTrendDirection).toBeNull();
    expect(fix.compliance.newIncidents).toBeNull();
    expect(fix.compliance.criticalFindings).toBeNull();
    expect(fix.compliance.score_breakdown.score_gdpr).toBeNull();
    expect(fix.governance.quota.bots_used).toBeNull();
  });

  it('populated fixture proves 0 ≠ EmptyState', () => {
    const fix = getComplianceGovernancePopulatedFixture();
    expect(fix.compliance.score_overall).toBe(72);
    expect(fix.compliance.newIncidents).toBe(0);
    expect(fix.compliance.score_breakdown.incident_response).toBe(0);
    expect(fix.compliance.score_breakdown.score_dsa).toBeNull();
    expect(BREAKDOWN_CHIP_DEFS).toHaveLength(8);
  });
});

describe('loadComplianceKpiForTenant', () => {
  it('returns null scores when history is empty — not 0', async () => {
    const client = stubClient({
      compliance_score_history: { data: [] },
      incidents: { count: 0 },
      dpia_assessments: { count: 0 },
      audits: { data: [] },
      compliance_policies: { data: [] },
      vendors: { data: [] },
    });

    const kpi = await loadComplianceKpiForTenant(client, TENANT);
    expect(kpi.score_overall).toBeNull();
    expect(kpi.riskTrendDirection).toBeNull();
    expect(kpi.criticalFindings).toBeNull();
    expect(kpi.newIncidents).toBe(0);
    expect(kpi.upcomingDeadlines).toBe(0);
    expect(kpi.policies.documented).toBe(0);
    expect(kpi.vendors.active).toBe(0);
  });

  it('maps full score row including measured zeros and null breakdown fields', async () => {
    const client = stubClient({
      compliance_score_history: {
        data: [{
          score_overall: 0,
          score_gdpr: 80,
          score_nis2: null,
          score_dsa: 40,
          score_ai_act: 55,
          policy_compliance: 0,
          vendor_risk: null,
          incident_response: 10,
          data_governance: 12,
          trend_direction: 'declining',
        }],
      },
      incidents: { count: 2 },
      dpia_assessments: { count: 1 },
      audits: { data: [{ findings_count: 3 }] },
      compliance_policies: { data: [{ status: 'approved' }, { status: 'draft' }] },
      vendors: { data: [{ risk_level: 'high' }, { risk_level: 'low' }] },
    });

    const kpi = await loadComplianceKpiForTenant(client, TENANT);
    expect(kpi.score_overall).toBe(0);
    expect(kpi.score_breakdown.score_gdpr).toBe(80);
    expect(kpi.score_breakdown.score_nis2).toBeNull();
    expect(kpi.score_breakdown.policy_compliance).toBe(0);
    expect(kpi.riskTrendDirection).toBe('declining');
    expect(kpi.criticalFindings).toBe(3);
    expect(kpi.newIncidents).toBe(2);
    expect(kpi.policies.documented).toBe(1);
    expect(kpi.policies.pending).toBe(1);
    expect(kpi.vendors.highRisk).toBe(1);
  });

  it('returns null for digest counts when table queries fail', async () => {
    const client = stubClient({
      compliance_score_history: { data: [] },
      incidents: { error: { message: 'PGRST205' } },
      dpia_assessments: { error: { message: 'PGRST205' } },
      audits: { error: { message: 'PGRST205' } },
      compliance_policies: { error: { message: 'PGRST205' } },
      vendors: { error: { message: 'PGRST205' } },
    });

    const kpi = await loadComplianceKpiForTenant(client, TENANT);
    expect(kpi.newIncidents).toBeNull();
    expect(kpi.resolvedIncidents).toBeNull();
    expect(kpi.upcomingDeadlines).toBeNull();
    expect(kpi.criticalFindings).toBeNull();
    expect(kpi.policies.documented).toBeNull();
    expect(kpi.vendors.active).toBeNull();
  });
});
