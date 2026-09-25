/**
 * Übernommen aus Draft #1571 (Copilot, 24.09.2026) und an den P0-Score-Status
 * angepasst: „Noch nicht bewertbar“ statt „Noch nicht bewertet“, plus
 * Fehlerzustand mit Retry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    scoreStatus: 'insufficient_data',
    scoreBasis: { aiSystems: 0, controlMappings: 0 },
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

  it('zeigt „Noch nicht bewertbar“ mit erstem Schritt, wenn der Score nicht bewertbar ist', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData());

    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Noch nicht bewertbar')).toBeInTheDocument();
    });
    expect(screen.getByTestId('cockpit-score-state-first-step')).toHaveAttribute('href', '/app/onboarding');
    expect(screen.getByText('Cockpit · Acme GmbH')).toBeInTheDocument();
    expect(screen.queryByText('Sehr gut')).toBeNull();
  });

  it('zeigt bei unzuverlässigen Daten den Fehlerzustand und lädt per Retry neu', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData({ scoreStatus: 'unreliable', partialFailures: ['kpi: rpc down'] }));

    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('cockpit-score-state-error')).toBeInTheDocument());
    expect(mockedLoadCockpitData).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('cockpit-score-state-retry'));
    await waitFor(() => expect(mockedLoadCockpitData).toHaveBeenCalledTimes(2));
  });

  it('Backend-Review A: Fußzeile ohne KPI-Snapshot sagt „Score noch nicht bewertbar“', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData({ counts: { incidents: 1, dpias: 0, dsr: { total: 0, overdue: 0 }, approvals: 0, vendorsNoDpa: 0 } }));
    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/KPI-Snapshot noch nicht verfügbar — Score noch nicht bewertbar\./)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Echtzeit-Zählern/)).toBeNull();
  });

  it('Backend-Review B: fehlgeschlagene Zähler zeigen „nicht geladen“ statt 0', async () => {
    mockedLoadCockpitData.mockResolvedValue(
      makeData({ partialFailures: ['incidents: timeout', 'vendors: rls denied'] }),
    );
    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText('nicht geladen')).toHaveLength(2));
    const metric = (label: string) => screen.getByText(label).parentElement!.firstElementChild!.textContent;
    expect(metric('Offene Vorfälle')).toBe('nicht geladen');
    expect(metric('Vendoren ohne AVV')).toBe('nicht geladen');
    // Geladene Zähler bleiben Zahlen.
    expect(metric('DSR überfällig')).toBe('0');
    expect(metric('Offene DSFA')).toBe('0');
  });

  it('Backend-Review B: kein Erststart-Banner, wenn Zähler fehlgeschlagen sind', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData({ partialFailures: ['dsr: timeout'] }));
    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('nicht geladen')).toBeInTheDocument());
    expect(screen.queryByText('Willkommen im Governance-Cockpit!')).toBeNull();
  });

  it('zeigt den Erststart-Banner weiterhin ohne partialFailures', async () => {
    mockedLoadCockpitData.mockResolvedValue(makeData());
    render(
      <MemoryRouter>
        <CeoCockpitView />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Willkommen im Governance-Cockpit!')).toBeInTheDocument());
    expect(screen.queryByText('nicht geladen')).toBeNull();
  });
});
