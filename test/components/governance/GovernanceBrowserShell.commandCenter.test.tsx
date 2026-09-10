import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../src/components/governance-os/PaymentGraceBanner', () => ({
  PaymentGraceBanner: () => null,
}));
vi.mock('../../../src/components/governance-os/GovernanceTabs', () => ({
  GovernanceTabs: () => <div data-testid="tabs" />,
}));
vi.mock('../../../src/components/governance-os/GovernanceCanvas', () => ({
  GovernanceCanvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
}));
vi.mock('../../../src/components/governance-os/GovernanceStatusBar', () => ({
  GovernanceStatusBar: () => null,
}));
vi.mock('../../../src/components/governance-os/MobileBottomNavigation', () => ({
  MobileBottomNavigation: () => null,
}));
vi.mock('../../../src/components/governance-os/GovernanceChatSidebar', () => ({
  GovernanceChatSidebar: ({ open }: { open: boolean }) => (
    <div data-testid="assistant" data-open={open ? '1' : '0'} />
  ),
}));
vi.mock('../../../src/components/governance-os/GovernanceAddressBar', () => ({
  GovernanceAddressBar: () => <div data-testid="address-bar" />,
}));
vi.mock('../../../src/core/access/RouteEntitlementGate', () => ({
  RouteEntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { GovernanceBrowserShell } from '../../../src/components/governance-os/GovernanceBrowserShell';

function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderShell(initial = '/app/home') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="*"
          element={
            <GovernanceBrowserShell>
              <LocationProbe />
              <div>shell-body</div>
            </GovernanceBrowserShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GovernanceBrowserShell — Command Center', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('öffnet das Command Center mit Ctrl+K', () => {
    renderShell();
    expect(screen.queryByRole('dialog', { name: 'Command Center' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Command Center' })).toBeInTheDocument();
  });

  it('öffnet das Command Center mit Meta+K (Cmd)', () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByRole('dialog', { name: 'Command Center' })).toBeInTheDocument();
  });

  it('öffnet über den Suchen-Button in der Topbar', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Command Center öffnen' }));
    expect(screen.getByRole('dialog', { name: 'Command Center' })).toBeInTheDocument();
  });

  it('navigiert zu einer echten Route beim Ausführen eines Befehls', () => {
    renderShell('/app/home');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    fireEvent.change(screen.getByLabelText('Was möchtest du tun?'), {
      target: { value: 'Evidence' },
    });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByTestId('location')).toHaveTextContent('/app/evidence');
    expect(screen.queryByRole('dialog', { name: 'Command Center' })).not.toBeInTheDocument();
  });

  it('schließt mit Escape und toggelt mit erneutem Ctrl+K', () => {
    renderShell();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
