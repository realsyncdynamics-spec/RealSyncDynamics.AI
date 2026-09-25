/**
 * Korrektur P0-5 (25.09.2026): Der Scan-CTA ruft tenant-audit (derzeit HTTP
 * 500). Ehrliche Bezeichnung + sichtbarer Fehlerzustand an der Karte, kein
 * stilles Scheitern.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  useTenant: () => ({ activeTenantId: 't1', tenants: [{ tenantId: 't1', name: 'Acme GmbH' }], loading: false }),
}));
vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));
vi.mock('../../../../src/features/website-operations/TenantCustomDomainPanel', () => ({
  TenantCustomDomainPanel: () => null,
}));

import { WebsiteGovernanceView } from '../../../../src/features/governance/websites/WebsiteGovernanceView';
import { WEBSITE_AUDIT_CTA_LABEL } from '../../../../src/features/governance/dashboard/dashboardSignals';

describe('Website-Audit-CTA', () => {
  it('heißt ehrlich „Website-Audit (HTML/Header) starten“ und zeigt HTTP 500 an der Karte', async () => {
    api.listWebsitesForTenant.mockResolvedValue([
      { id: 'w1', tenant_id: 't1', domain: 'example.de', status: 'active', plan_tier: 'free', created_at: '2026-09-01T10:00:00Z' },
    ]);
    api.listScanRuns.mockResolvedValue([]);
    api.triggerTenantAudit.mockRejectedValue(
      new Error('Website-Audit fehlgeschlagen — der Audit-Dienst meldet einen Serverfehler (HTTP 500). Bitte später erneut versuchen.'),
    );

    render(<MemoryRouter><WebsiteGovernanceView /></MemoryRouter>);

    const label = await screen.findByText(WEBSITE_AUDIT_CTA_LABEL);
    const button = label.closest('button');
    expect(button).not.toBeNull();
    expect(screen.queryByText(/^Scannen$/)).toBeNull();
    fireEvent.click(button!);

    const alert = await screen.findByTestId('website-scan-error-w1');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert.textContent).toMatch(/HTTP 500/);
  });
});
