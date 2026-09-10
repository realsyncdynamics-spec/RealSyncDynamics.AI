import { describe, expect, it, vi } from 'vitest';
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

import { RiskCenterView } from '@/src/features/governance/risks/RiskCenterView';
import { EvidenceVaultView } from '@/src/features/governance/evidence/EvidenceVaultView';

describe('honest empty states', () => {
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
});
