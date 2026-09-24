import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    tenants: [{ tenantId: 'tenant-1', name: 'Acme GmbH' }],
  }),
}));

vi.mock('../../../../src/features/governance/cockpit/cockpitData', () => ({
  loadCockpitData: vi.fn(),
}));

vi.mock('../../../../src/features/governance/cockpit/GovernanceBriefCard', () => ({
  GovernanceBriefCard: () => <div data-testid="governance-brief-card" />,
}));

vi.mock('../../../../src/features/api/ApiStatusCard', () => ({
  ApiStatusCard: () => <div data-testid="api-status-card" />,
}));

import { CeoCockpitView } from '../../../../src/features/governance/cockpit/CeoCockpitView';
import { loadCockpitData, type CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';

const mockedLoadCockpitData = vi.mocked(loadCockpitData);

function makeData(overrides: Partial<CockpitData> = {}): CockpitData {
  return {
    counts: {
      incidents: 0,
      dpias: 0,
      dsr: { total: 0, overdue: 0 },
      approvals: 0,
      vendorsNoDpa: 0,
    },
    posture: null,
    score: null,
    readiness: null,
    readinessTrend: null,
    actions: [],
    lastUpdated: null,
    evidenceHealth: {
      percent: null,
      hashedCount: 0,
      totalCount: 0,
      newEvidence24h: 0,
      failedScans: 0,
      level: 'unknown',
      label: 'Keine Evidence',
    },
    riskIndex: {
      score: null,
      assetCount: 0,
      highRiskAssets: 0,
      avgAssetRisk: null,
      newRisks24h: 0,
      level: 'unknown',
      label: 'Kein Residualrisiko erfasst',
    },
    openMeasures: {
      incidents: 0,
      dsrOverdue: 0,
      dsrOpen: 0,
      dpias: 0,
      approvals: 0,
      vendorsNoDpa: 0,
      total: 0,
    },
    summary24h: null,
    recentEvents: [],
    riskDistribution: [
      { id: 'critical', label: 'Kritisch', count: 0 },
      { id: 'high', label: 'Hoch', count: 0 },
      { id: 'medium', label: 'Mittel', count: 0 },
      { id: 'low', label: 'Gering', count: 0 },
      { id: 'passed', label: 'Stabil', count: 0 },
    ],
    assetFlows: [],
    partialFailures: [],
    ...overrides,
  };
}

describe('CeoCockpitView', () => {
  beforeEach(() => {
    mockedLoadCockpitData.mockReset();
  });

  it('shows "Noch nicht bewertet" when the governance score is null', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData({ score: null }));

    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Noch nicht bewertet')).toBeInTheDocument();
    });
    expect(screen.getByText('Cockpit · Acme GmbH')).toBeInTheDocument();
  });
});
