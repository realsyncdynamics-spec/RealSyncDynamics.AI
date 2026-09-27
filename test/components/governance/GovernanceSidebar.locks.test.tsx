/**
 * P0-2 — Seitenleiste eines Free-Mandanten: Schlösser aus tenant_entitlements.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PLAN_ENTITLEMENTS } from '@/shared/pricing';

const free = PLAN_ENTITLEMENTS.free_audit as Record<string, number | undefined>;

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    loading: false,
    entitlements: { byKey: {} },
    tenants: [{ tenantId: 't1', name: 'Acme GmbH' }],
    activeTenantId: 't1',
    hasFeature: (key: string) => {
      const v = free[key];
      return v !== undefined && (v === -1 || v > 0);
    },
  }),
}));
// Plan bewusst „enterprise“: Schlösser dürfen NICHT mehr vom Plan abhängen.
vi.mock('../../../src/hooks/useModuleAccess', () => ({
  useActivePlan: () => ({ plan: 'enterprise', loading: false }),
}));
vi.mock('../../../src/components/governance-os/useShellCounts', () => ({
  useShellCounts: () => ({ systems: 0, unclassified: 0, policies: 0, evidence: 1, firstSystemId: null }),
}));

import { GovernanceSidebar } from '../../../src/components/governance-os/GovernanceSidebar';
import { MobileBottomNavigation } from '../../../src/components/governance-os/MobileBottomNavigation';
import { MobileShellMenu } from '../../../src/components/governance-os/MobileShellMenu';

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <GovernanceSidebar />
    </MemoryRouter>,
  );
}

describe('GovernanceSidebar — Free-Mandant', () => {
  it('Enforcement zu, KI-Systeme offen, Klassifizierung zu', () => {
    renderSidebar();
    expect(screen.getByTestId('side-nav-enforce')).toHaveAttribute('data-locked', 'true');
    expect(screen.getByTestId('side-nav-systems')).toHaveAttribute('data-locked', 'false');
    expect(screen.getByTestId('side-nav-classify')).toHaveAttribute('data-locked', 'true');
  });

  it('gesperrter Punkt zeigt kein Badge (Enforcement-Badge 0 entfällt)', () => {
    renderSidebar();
    expect(screen.queryByTestId('side-badge-enforce')).toBeNull();
    expect(screen.getByTestId('side-badge-systems')).toHaveTextContent('0');
    expect(screen.getByTestId('side-badge-evidence')).toHaveTextContent('1');
  });

  it('Tooltip nennt den Mindestplan bzw. ehrlich „nicht enthalten“', () => {
    renderSidebar();
    expect(screen.getByTestId('side-nav-enforce')).toHaveAttribute('title', expect.stringMatching(/ab Starter/));
    expect(screen.getByTestId('side-nav-classify')).toHaveAttribute('title', expect.stringMatching(/nicht enthalten/));
  });

  it('Risiken, Monitoring, Security Signals, Dienstleister, Alerts bleiben zu', () => {
    renderSidebar();
    for (const id of ['risks', 'monitoring', 'security-signals', 'vendors', 'alerts']) {
      expect(screen.getByTestId(`side-more-${id}`), id).toHaveAttribute('data-locked', 'true');
    }
    for (const id of ['websites', 'activation', 'modules']) {
      expect(screen.getByTestId(`side-more-${id}`), id).toHaveAttribute('data-locked', 'false');
    }
  });
});

describe('Mobile Navigation — gleiche Schlösser wie die Seitenleiste', () => {
  it('Tab-Bar: Enforcement zu, KI-Systeme offen', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <MobileBottomNavigation />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Enforcement/ })).toHaveAttribute('data-locked', 'true');
    expect(screen.getByRole('link', { name: /KI-Systeme/ })).toHaveAttribute('data-locked', 'false');
  });

  it('Burger-Menü: Enforcement und Klassifizierung mit Schloss-Titel', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <MobileShellMenu />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Enforcement/ })).toHaveAttribute('title', expect.stringMatching(/ab Starter/));
    expect(screen.getByRole('link', { name: /Klassifizierung/ })).toHaveAttribute('title', expect.stringMatching(/nicht enthalten/));
    expect(screen.getByRole('link', { name: /^KI-Systeme$/ })).not.toHaveAttribute('title');
  });
});
