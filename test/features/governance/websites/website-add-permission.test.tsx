/**
 * Websites anlegen nur mit schreibender Rolle (RLS 20261005150000). Die
 * Oberfläche bietet viewer_auditor keinen Knopf an, den der Server ablehnt,
 * und legt den Domain-Vorschlag aus dem Konto nicht automatisch für ihn an.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tenant = vi.hoisted(() => ({ role: 'viewer_auditor' as string }));
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
  useTenant: () => ({ activeTenantId: 't1', tenants: [{ tenantId: 't1', name: 'Acme GmbH', role: tenant.role }], loading: false }),
}));
vi.mock('../../../../src/lib/supabase', () => ({
  // Sitzung mit Domain-Hinweis aus dem Konto — wird nur für schreibende Rollen automatisch angelegt.
  getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: { user: { user_metadata: { website: 'https://acme.de' } } } } }) } }),
}));
vi.mock('../../../../src/features/website-operations/TenantCustomDomainPanel', () => ({
  TenantCustomDomainPanel: () => null,
}));

import { WebsiteGovernanceView } from '../../../../src/features/governance/websites/WebsiteGovernanceView';

beforeEach(() => {
  api.listWebsitesForTenant.mockReset().mockResolvedValue([]);
  api.listScanRuns.mockReset().mockResolvedValue([]);
  api.addWebsiteForTenant.mockReset().mockResolvedValue({
    id: 'w1', tenant_id: 't1', domain: 'acme.de', plan_tier: 'audit', status: 'lead', created_at: '2026-10-05T00:00:00Z',
  });
});

describe('Websites — Anlegen nach Rolle', () => {
  it('viewer_auditor: Knöpfe gesperrt mit Begründung, kein automatisches Anlegen', async () => {
    tenant.role = 'viewer_auditor';
    render(<MemoryRouter><WebsiteGovernanceView /></MemoryRouter>);
    expect(await screen.findByTestId('websites-empty')).toBeInTheDocument();
    expect(screen.getByTestId('website-add')).toBeDisabled();
    expect(screen.getByTestId('website-add-readonly')).toHaveTextContent('Ihre Rolle darf keine Websites anlegen.');
    expect(await screen.findByText(/Vorschlag aus dem Konto: acme.de/)).toBeInTheDocument();
    expect(api.addWebsiteForTenant).not.toHaveBeenCalled();
  });

  it('owner: der Vorschlag aus dem Konto wird angelegt', async () => {
    tenant.role = 'owner';
    render(<MemoryRouter><WebsiteGovernanceView /></MemoryRouter>);
    await waitFor(() => expect(api.addWebsiteForTenant).toHaveBeenCalledWith('t1', 'acme.de'));
  });

  it('editor: Knopf aktiv', async () => {
    tenant.role = 'editor';
    api.listWebsitesForTenant.mockResolvedValue([
      { id: 'w0', tenant_id: 't1', domain: 'shop.acme.de', plan_tier: 'audit', status: 'lead', created_at: '2026-10-01T00:00:00Z' },
    ]);
    render(<MemoryRouter><WebsiteGovernanceView /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('website-add')).toBeEnabled());
  });
});
