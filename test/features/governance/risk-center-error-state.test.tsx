import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DbIncident } from '@/src/features/governance/incidentsApi';

const { tenantState, fetchTenantIncidentsMock } = vi.hoisted(() => ({
  tenantState: { activeTenantId: 'tenant-a' },
  fetchTenantIncidentsMock: vi.fn<() => Promise<DbIncident[]>>(),
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: tenantState.activeTenantId, tenants: [], loading: false }),
}));

vi.mock('@/src/features/governance/incidentsApi', () => ({
  fetchTenantIncidents: fetchTenantIncidentsMock,
  transitionIncident: vi.fn(),
}));

import { RiskCenterView } from '@/src/features/governance/risks/RiskCenterView';

function incident(overrides: Partial<DbIncident> = {}): DbIncident {
  return {
    id: 'inc-1',
    tenant_id: tenantState.activeTenantId,
    triggering_event_id: 'evt-1',
    asset_id: null,
    title: 'Datenabfluss erkannt',
    description: 'RLS-Prüfung fehlgeschlagen.',
    severity: 'high',
    status: 'open',
    breach_confirmed: false,
    personal_data_affected: true,
    affected_data_types: ['pii'],
    estimated_affected_subjects: null,
    detected_at: '2026-09-10T10:00:00Z',
    notification_deadline_at: '2026-09-12T10:00:00Z',
    contained_at: null,
    resolved_at: null,
    reported_to_authority_at: null,
    authority_reference: null,
    timeline: [],
    assigned_to: 'dpo@example.de',
    ...overrides,
  };
}

describe('RiskCenterView error handling', () => {
  beforeEach(() => {
    tenantState.activeTenantId = 'tenant-a';
    fetchTenantIncidentsMock.mockReset();
  });

  it('shows an unavailable state instead of claiming there are no incidents on initial load failure', async () => {
    fetchTenantIncidentsMock.mockRejectedValueOnce(new Error('RLS blockiert'));

    render(
      <MemoryRouter>
        <RiskCenterView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('RLS blockiert')).toBeInTheDocument();
    });

    expect(screen.queryByText('Noch keine Vorfälle')).not.toBeInTheDocument();
    expect(screen.queryByText('Keine Risiken für diesen Filter')).not.toBeInTheDocument();
  });

  it('does not clear tenant risks in the fetch error path', () => {
    const source = readFileSync('src/features/governance/risks/RiskCenterView.tsx', 'utf8');
    expect(source).not.toContain('setActiveRisks([]);\n        setLoadError');
    expect(source).toContain('const showUnavailableState = Boolean(loadError) && !loading && activeRisks.length === 0;');
    expect(source).toContain('activeTenantIdRef');
    expect(source).toContain('tenantId !== activeTenantIdRef.current');
    expect(source).not.toContain('if (tenantId !== activeTenantId) return;');
  });
});
