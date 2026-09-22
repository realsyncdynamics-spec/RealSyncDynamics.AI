/**
 * Canonical stub for GET /admin/dashboard/governance-compliance — all scores null.
 * Populated fixture exists only for visual/layout verify (?fixture=populated).
 * Never used as live fallback that invents tenant scores.
 */
import {
  emptyGovernanceComplianceSnapshot,
  type GovernanceComplianceSnapshot,
} from './complianceTypes';

/** Empty/unknown stub — EmptyState path (matches uploaded stub). */
export function getComplianceGovernanceFixture(): GovernanceComplianceSnapshot {
  return emptyGovernanceComplianceSnapshot({
    source: 'fixture',
    generated_at: '2026-09-18T11:57:53.650954+00:00',
    tenant_id: null,
  });
}

/**
 * Layout-verify fixture with measured zeros + known scores.
 * Includes score_overall 0 and newIncidents 0 to prove 0 ≠ EmptyState.
 */
export function getComplianceGovernancePopulatedFixture(): GovernanceComplianceSnapshot {
  return emptyGovernanceComplianceSnapshot({
    source: 'fixture',
    generated_at: '2026-09-18T11:57:53.650954+00:00',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    compliance: {
      score_overall: 72,
      score_breakdown: {
        score_gdpr: 80,
        score_nis2: 65,
        score_dsa: null,
        score_ai_act: 70,
        policy_compliance: 75,
        vendor_risk: 60,
        incident_response: 0,
        data_governance: 68,
      },
      riskTrendDirection: 'stable',
      criticalFindings: 2,
      newIncidents: 0,
      resolvedIncidents: 1,
      upcomingDeadlines: 3,
      policies: { documented: 4, pending: 2 },
      vendors: { active: 5, highRisk: 1 },
    },
  });
}
