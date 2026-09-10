import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComplianceStatusView } from '../../../src/features/governance/dashboard/ComplianceStatusDashboard';
import type { CockpitData } from '../../../src/features/governance/cockpit/cockpitData';
import {
  computeEvidenceHealth,
  computeOpenMeasures,
  computeRiskIndex,
  EMPTY_SUMMARY_24H,
} from '../../../src/features/governance/dashboard/complianceStatus';
import { computeAuditReadiness, computeGovernanceScore, type CockpitCounts } from '../../../src/features/governance/cockpit/cockpitScore';

const ZERO: CockpitCounts = {
  incidents: 0,
  dpias: 0,
  dsr: { total: 0, overdue: 0 },
  approvals: 0,
  vendorsNoDpa: 0,
};

function fixture(overrides: Partial<CockpitData> = {}): CockpitData {
  const counts: CockpitCounts = overrides.counts ?? ZERO;
  const posture = overrides.posture === undefined ? null : overrides.posture;
  const evidenceHealth = overrides.evidenceHealth ?? computeEvidenceHealth({
    coveragePercent: posture?.assetEvidencePercent ?? null,
    evidence: [],
    newEvidence24h: 0,
    failedScans: 0,
  });
  const riskIndex = overrides.riskIndex ?? computeRiskIndex({
    assetScores: [],
    newRisks24h: 0,
    openIncidents: counts.incidents,
    dsrOverdue: counts.dsr.overdue,
  });
  return {
    counts,
    posture,
    score: overrides.score ?? computeGovernanceScore(counts, posture),
    readiness: overrides.readiness !== undefined ? overrides.readiness : computeAuditReadiness(posture),
    readinessTrend: overrides.readinessTrend ?? null,
    actions: overrides.actions ?? [],
    lastUpdated: overrides.lastUpdated ?? null,
    evidenceHealth,
    riskIndex,
    openMeasures: overrides.openMeasures ?? computeOpenMeasures(counts),
    summary24h: overrides.summary24h === undefined ? null : overrides.summary24h,
  };
}

function rendered(props: Partial<Parameters<typeof ComplianceStatusView>[0]> = {}) {
  const result = render(
    <MemoryRouter>
      <ComplianceStatusView
        tenantName="Acme GmbH"
        activeTenantId="tenant-1"
        data={null}
        loading={false}
        error={null}
        {...props}
      />
    </MemoryRouter>,
  );
  return result;
}

describe('ComplianceStatusView', () => {
  it('renders the live status surface, not a chat composer', () => {
    const { getByTestId, queryByPlaceholderText, getByText } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        score: 90,
        riskIndex: computeRiskIndex({
          assetScores: [40],
          newRisks24h: 0,
          openIncidents: 1,
          dsrOverdue: 0,
        }),
      }),
    });
    expect(getByTestId('compliance-status-dashboard')).toBeInTheDocument();
    expect(getByTestId('governance-score')).toBeInTheDocument();
    expect(getByTestId('risk-index')).toBeInTheDocument();
    expect(getByTestId('evidence-health')).toBeInTheDocument();
    expect(getByTestId('audit-readiness')).toBeInTheDocument();
    expect(getByTestId('open-measures')).toBeInTheDocument();
    expect(getByText('Status · Acme GmbH')).toBeInTheDocument();
    expect(queryByPlaceholderText(/nachricht/i)).toBeNull();
  });

  it('shows dashes instead of fake scores when the tenant is empty', () => {
    const { getByText, queryByTestId } = rendered({
      data: fixture(),
    });
    expect(getByText('Noch keine Governance-Daten')).toBeInTheDocument();
    expect(queryByTestId('governance-score')).toBeNull();
    expect(queryByTestId('risk-index')).toBeNull();
    expect(queryByTestId('evidence-health')).toBeNull();
    expect(queryByTestId('open-measures')).toBeNull();
  });

  it('lists prioritized open measures with deep links', () => {
    const { getByTestId, getByText } = rendered({
      data: fixture({
        counts: { incidents: 1, dpias: 0, dsr: { total: 1, overdue: 1 }, approvals: 0, vendorsNoDpa: 0 },
        actions: [{
          id: 'inc-1',
          kind: 'incident',
          title: 'Datenleck im CRM',
          detail: 'Meldefrist (72 h): 4 h überfällig',
          level: 'critical',
          deadline: '2026-09-09T10:00:00Z',
          hoursRemaining: -4,
          href: '/app/incidents',
          weight: 160,
        }],
      }),
    });
    expect(getByTestId('priority-actions').textContent).toContain('Datenleck im CRM');
    expect(getByText('Vorfälle').closest('a')).toHaveAttribute('href', '/app/incidents');
    expect(getByText('DSR überfällig').closest('a')).toHaveAttribute('href', '/app/dsr');
  });

  it('shows 24h summary only when the RPC returned data', () => {
    const withSummary = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        summary24h: { ...EMPTY_SUMMARY_24H, new_risks: 2, failed_scans: 1 },
      }),
    });
    expect(withSummary.getByTestId('summary-24h').textContent).toContain('Neue Risiken');
    withSummary.unmount();

    const without = rendered({
      data: fixture({ counts: { ...ZERO, incidents: 1 }, summary24h: null }),
    });
    expect(without.queryByTestId('summary-24h')).toBeNull();
  });

  it('asks for login when no tenant is active', () => {
    const { getByText } = rendered({
      tenantName: null,
      activeTenantId: null,
      data: null,
    });
    expect(getByText(/Bitte anmelden/)).toBeInTheDocument();
  });

  it('surfaces loader and error without inventing metrics', () => {
    const loading = rendered({ loading: true, data: null });
    expect(loading.getByText(/wird geladen/)).toBeInTheDocument();
    loading.unmount();

    const failed = rendered({ error: 'RPC timeout', data: null });
    expect(failed.getByText('RPC timeout')).toBeInTheDocument();
    expect(failed.queryByTestId('governance-score')).toBeNull();
  });
});
