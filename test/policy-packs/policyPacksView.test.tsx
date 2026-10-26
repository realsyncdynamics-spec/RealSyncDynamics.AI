import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: () => ReactNode }) => <>{children()}</>,
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 'tenant-1',
    hasFeature: () => true,
    tenants: [{ tenantId: 'tenant-1', role: 'owner', industry: 'saas' }],
    refresh: vi.fn(),
  }),
}));

const mocks = vi.hoisted(() => ({
  listCatalog: vi.fn(),
  listActivations: vi.fn(),
  listTenantMappings: vi.fn(),
  setPackActive: vi.fn(),
  countRiskInventory: vi.fn(),
  fetchFrameworkControls: vi.fn(),
  fetchTenantAssets: vi.fn(),
  upsertMapping: vi.fn(),
  createAsset: vi.fn(),
  autoMapAsset: vi.fn(),
}));

vi.mock('@/src/features/policy-packs/policyPacksApi', () => ({
  listCatalog: mocks.listCatalog,
  listActivations: mocks.listActivations,
  listTenantMappings: mocks.listTenantMappings,
  setPackActive: mocks.setPackActive,
}));

vi.mock('@/src/features/governance/aiActRiskInventoryApi', () => ({
  countRiskInventory: mocks.countRiskInventory,
}));

vi.mock('@/src/features/governance/governanceApi', () => ({
  fetchFrameworkControls: mocks.fetchFrameworkControls,
  fetchTenantAssets: mocks.fetchTenantAssets,
}));

vi.mock('@/src/features/governance/resourcesApi', () => ({
  upsertMapping: mocks.upsertMapping,
  createAsset: mocks.createAsset,
  autoMapAsset: mocks.autoMapAsset,
}));

import { PolicyPacksView } from '@/src/features/policy-packs/PolicyPacksView';

describe('PolicyPacksView — Controls aufklappbar & per upsert_mapping umschaltbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCatalog.mockResolvedValue([
      {
        id: 'dsgvo-essentials',
        name: 'DSGVO Essentials',
        description: 'Basis-Controls für DSGVO',
        industry: 'all',
        frameworks: ['GDPR'],
        controls: [
          { framework: 'GDPR', control_code: 'Art.5' },
          { framework: 'GDPR', control_code: 'Art.30' },
        ],
      },
    ]);
    mocks.listActivations.mockResolvedValue(new Set(['dsgvo-essentials']));
    mocks.listTenantMappings.mockResolvedValue([
      { framework: 'GDPR', control_code: 'Art.5', status: 'in_progress' },
    ]);
    mocks.countRiskInventory.mockResolvedValue({ high_risk: 0 });
    mocks.fetchFrameworkControls.mockResolvedValue([
      { id: 'ctrl-5', framework: 'GDPR', control_code: 'Art.5', title: 'Grundsätze der Verarbeitung', description: null },
      { id: 'ctrl-30', framework: 'GDPR', control_code: 'Art.30', title: 'Verzeichnis von Verarbeitungstätigkeiten', description: null },
    ]);
    mocks.fetchTenantAssets.mockResolvedValue([
      { id: 'asset-1', tenant_id: 'tenant-1', asset_type: 'ai_system', name: 'Support Bot' },
    ]);
    mocks.upsertMapping.mockResolvedValue({ ok: true });
    mocks.setPackActive.mockResolvedValue({ kind: 'ok', data: { ok: true } });
    mocks.autoMapAsset.mockResolvedValue({ ok: true, applied: 2 });
  });

  it('rendert ohne doppelten Fullscreen-Header (kein min-h-screen) und klappt Controls auf/um', async () => {
    render(
      <MemoryRouter>
        <PolicyPacksView />
      </MemoryRouter>,
    );

    const view = await screen.findByTestId('policy-packs-view');
    expect(view.className).not.toContain('min-h-screen');

    const cov = await screen.findByTestId('pack-coverage-dsgvo-essentials');
    expect(cov).toHaveTextContent('0% · 0/2');

    const toggleBtn = screen.getByTestId('toggle-controls-dsgvo-essentials');
    fireEvent.click(toggleBtn);

    expect(await screen.findByTestId('pack-controls-list-dsgvo-essentials')).toBeInTheDocument();
    expect(screen.getByText('Grundsätze der Verarbeitung')).toBeInTheDocument();

    const implBtn = screen.getByTestId('control-status-GDPR-Art.5-implemented');
    fireEvent.click(implBtn);

    await waitFor(() =>
      expect(mocks.upsertMapping).toHaveBeenCalledWith('asset-1', 'ctrl-5', 'implemented'),
    );
    expect(screen.getByTestId('pack-coverage-dsgvo-essentials')).toHaveTextContent('50% · 1/2');
  });
});
