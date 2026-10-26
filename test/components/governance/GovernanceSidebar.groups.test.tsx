/**
 * Seitenleiste mit Unterkategorien: Gruppe der aktuellen Seite offen, übrige
 * zu, einklappbar zur Icon-Rail.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({
    loading: false,
    entitlements: { byKey: {} },
    tenants: [{ tenantId: 't1', name: 'Acme GmbH' }],
    activeTenantId: 't1',
    hasFeature: () => true,
  }),
}));
vi.mock('../../../src/hooks/useModuleAccess', () => ({
  useActivePlan: () => ({ plan: 'enterprise', loading: false }),
}));
vi.mock('../../../src/components/governance-os/useShellCounts', () => ({
  useShellCounts: () => ({ systems: 2, unclassified: 0, policies: 1, evidence: 3, firstSystemId: null }),
}));

import { GovernanceSidebar, activeNavGroup } from '../../../src/components/governance-os/GovernanceSidebar';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GovernanceSidebar />
    </MemoryRouter>,
  );
}

function groupButton(id: string) {
  return within(screen.getByTestId(`side-group-${id}`)).getAllByRole('button', { hidden: true })[0];
}

afterEach(() => {
  window.localStorage.clear();
});

describe('activeNavGroup', () => {
  it.each([
    ['/app/dashboard', 'start'],
    ['/app/websites', 'capture'],
    ['/app/ai-systems', 'capture'],
    ['/app/risks', 'assess'],
    ['/app/policy-packs', 'enforce'],
    ['/app/evidence', 'prove'],
    ['/app/voice/abc', 'prove'],
    ['/app/bots', 'agents'],
    ['/app/billing', 'admin'],
  ])('%s → %s', (path, group) => {
    expect(activeNavGroup(path)).toBe(group);
  });
});

describe('GovernanceSidebar — Unterkategorien', () => {
  it('öffnet nur die Gruppe der aktuellen Seite', () => {
    renderAt('/app/evidence');
    expect(groupButton('prove')).toHaveAttribute('aria-expanded', 'true');
    expect(groupButton('start')).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('side-group-start')).toHaveAttribute('hidden');
    expect(screen.getByTestId('side-nav-evidence')).toHaveAttribute('aria-current', 'page');
  });

  it('zeigt die Anzahl je Gruppe und klappt auf Klick auf', () => {
    renderAt('/app/dashboard');
    expect(groupButton('enforce')).toHaveTextContent('8');
    fireEvent.click(groupButton('enforce'));
    expect(groupButton('enforce')).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('side-group-enforce')).not.toHaveAttribute('hidden');
  });

  it('markiert geplante Module mit „Geplant“', () => {
    renderAt('/app/dashboard');
    expect(screen.getByTestId('side-more-dpia')).toHaveTextContent('Geplant');
  });

  it('klappt zur Icon-Rail ein und wieder auf', () => {
    renderAt('/app/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Seitenleiste einklappen' }));
    const nav = screen.getByRole('navigation', { name: 'Modulnavigation' });
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(window.localStorage.getItem('rs.sidebar.collapsed')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Belegen' }));
    expect(screen.getByRole('navigation', { name: 'Modulnavigation' })).toHaveAttribute('data-collapsed', 'false');
    expect(groupButton('prove')).toHaveAttribute('aria-expanded', 'true');
  });
});
