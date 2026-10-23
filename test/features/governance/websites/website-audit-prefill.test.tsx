/**
 * „Audit starten“ / Adresszeile → /app/websites?domain=…
 *
 * Die Vorbelegung öffnet für eine neue Domain den Dialog „Hinzufügen und
 * Audit starten“; für eine schon hinterlegte Domain ein Angebot mit Knopf.
 * Der Audit startet nie allein aus der URL — immer erst nach einem Klick.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({
  listWebsitesForTenant: vi.fn(),
  listScanRuns: vi.fn(),
  triggerTenantAudit: vi.fn(),
  addWebsiteForTenant: vi.fn(),
}));
vi.mock('../../../../src/features/governance/scans/scansApi', async (orig) => ({
  ...(await orig<typeof import('../../../../src/features/governance/scans/scansApi')>()),
  ...api,
}));
vi.mock('../../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    activeTenantId: 't1',
    tenants: [{ tenantId: 't1', name: 'Acme GmbH', role: 'owner' }],
    loading: false,
  }),
}));
vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
vi.mock('../../../../src/features/website-operations/TenantCustomDomainPanel', () => ({
  TenantCustomDomainPanel: () => null,
}));

import { WebsiteGovernanceView } from '../../../../src/features/governance/websites/WebsiteGovernanceView';

const SITE = {
  id: 'w1', tenant_id: 't1', domain: 'example.de', status: 'active', plan_tier: 'audit',
  created_at: '2026-09-01T10:00:00Z',
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <WebsiteGovernanceView />
    </MemoryRouter>,
  );
}

describe('Websites — Vorbelegung aus „Audit starten“', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listScanRuns.mockResolvedValue([]);
    api.triggerTenantAudit.mockResolvedValue({ scan_run_id: 's1', finding_count: 0, severity_max: null });
  });

  it('neue Domain: Dialog vorbelegt, Klick legt an und startet den Audit', async () => {
    api.listWebsitesForTenant.mockResolvedValue([SITE]);
    api.addWebsiteForTenant.mockResolvedValue({ ...SITE, id: 'w2', domain: 'neu.de' });

    renderAt('/app/websites?domain=neu.de&source=app-search');

    const submit = await screen.findByRole('button', { name: 'Hinzufügen und Audit starten' });
    expect(screen.getByDisplayValue('neu.de')).toBeInTheDocument();
    expect(api.triggerTenantAudit).not.toHaveBeenCalled();

    fireEvent.click(submit);

    await waitFor(() => expect(api.addWebsiteForTenant).toHaveBeenCalledWith('t1', 'neu.de'));
    await waitFor(() =>
      expect(api.triggerTenantAudit).toHaveBeenCalledWith('t1', 'neu.de', { website_id: 'w2' }),
    );
  });

  it('hinterlegte Domain: Angebot statt Dialog, Audit erst nach Klick', async () => {
    api.listWebsitesForTenant.mockResolvedValue([SITE]);

    renderAt('/app/websites?domain=https://Example.de/impressum');

    const offer = await screen.findByTestId('website-audit-offer');
    expect(offer.textContent).toContain('example.de');
    expect(screen.queryByRole('button', { name: 'Hinzufügen und Audit starten' })).toBeNull();
    expect(api.triggerTenantAudit).not.toHaveBeenCalled();

    const start = offer.querySelector('button');
    fireEvent.click(start!);

    await waitFor(() =>
      expect(api.triggerTenantAudit).toHaveBeenCalledWith('t1', 'example.de', { website_id: 'w1' }),
    );
    expect(api.addWebsiteForTenant).not.toHaveBeenCalled();
  });

  it('ohne ?domain= öffnet sich nichts', async () => {
    api.listWebsitesForTenant.mockResolvedValue([SITE]);

    renderAt('/app/websites');

    await screen.findByText('example.de');
    expect(screen.queryByTestId('website-audit-offer')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hinzufügen und Audit starten' })).toBeNull();
  });
});
