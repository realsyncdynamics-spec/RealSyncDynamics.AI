import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', tenants: [], loading: false }),
}));

vi.mock('@/src/features/governance/incidentsApi', () => ({
  fetchTenantIncidents: vi.fn(async () => []),
  transitionIncident: vi.fn(),
}));

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchTenantEvents: vi.fn(async () => []),
  fetchTenantEvidence: vi.fn(async () => []),
  countTenantEvidence: vi.fn(async () => 0),
  countTenantEvidenceHashed: vi.fn(async () => 0),
  countTenantEvidenceSince: vi.fn(async () => 0),
}));

vi.mock('@/src/features/evidence-vault/evidenceVaultApi', () => ({
  listTimeline: vi.fn(async () => []),
}));

vi.mock('@/src/features/governance/audit/auditExportApi', () => ({
  exportAnalytics: vi.fn(),
  triggerBlobDownload: vi.fn(),
  buildExportFilename: vi.fn(),
  defaultRange: () => ({ from: '', to: '' }),
}));

import { fetchTenantIncidents } from '@/src/features/governance/incidentsApi';
import { fetchTenantEvents, fetchTenantEvidence } from '@/src/features/governance/governanceApi';
import { RiskCenterView } from '@/src/features/governance/risks/RiskCenterView';
import { EvidenceVaultView } from '@/src/features/governance/evidence/EvidenceVaultView';

const mockedFetchTenantIncidents = vi.mocked(fetchTenantIncidents);
const mockedFetchTenantEvents = vi.mocked(fetchTenantEvents);
const mockedFetchTenantEvidence = vi.mocked(fetchTenantEvidence);

describe('honest empty states', () => {
  beforeEach(() => {
    mockedFetchTenantIncidents.mockReset();
    mockedFetchTenantEvents.mockReset();
    mockedFetchTenantEvidence.mockReset();
    mockedFetchTenantIncidents.mockResolvedValue([]);
    mockedFetchTenantEvents.mockResolvedValue([]);
    mockedFetchTenantEvidence.mockResolvedValue([]);
  });

  it('Risk Center shows no atelier-nord rows for an empty tenant', async () => {
    render(
      <MemoryRouter>
        <RiskCenterView />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Noch keine Vorfälle')).toBeInTheDocument();
    });
    expect(document.body.textContent).not.toMatch(/atelier-nord/i);
    expect(screen.getByText('Gesamt Risiken').parentElement?.textContent).toMatch(/0/);
  });

  it('Risk Center does not treat a load failure as an empty tenant', async () => {
    mockedFetchTenantIncidents.mockRejectedValue(new Error('rls denied'));
    render(
      <MemoryRouter>
        <RiskCenterView />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('risk-center-unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Risiken nicht verfügbar')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Vorfälle')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/atelier-nord/i);
  });

  it('Evidence Vault shows no demo timeline for an empty tenant', async () => {
    render(
      <MemoryRouter>
        <EvidenceVaultView />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Noch keine Nachweise')).toBeInTheDocument();
    });
    expect(document.body.textContent).not.toMatch(/atelier-nord/i);
    expect(document.body.textContent).not.toMatch(/1\.247/);
  });

  it('Evidence Vault does not treat a load failure as an empty tenant', async () => {
    mockedFetchTenantEvents.mockRejectedValue(new Error('rls denied'));
    mockedFetchTenantEvidence.mockRejectedValue(new Error('rls denied'));
    render(
      <MemoryRouter>
        <EvidenceVaultView />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Nachweise nicht verfügbar')).toBeInTheDocument();
    });
    expect(screen.queryByText('Noch keine Nachweise')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/atelier-nord/i);
    expect(document.body.textContent).not.toMatch(/1\.247/);
  });
});
