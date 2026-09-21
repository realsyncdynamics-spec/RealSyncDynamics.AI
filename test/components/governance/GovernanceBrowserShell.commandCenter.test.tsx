import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../src/components/governance-os/PaymentGraceBanner', () => ({
  PaymentGraceBanner: () => null,
}));
vi.mock('../../../src/components/governance-os/GovernanceTabs', () => ({
  GovernanceTabs: () => <Link to="/app/evidence">Nachweise öffnen</Link>,
}));
// Die Seitenleiste ist ab `lg` die Modulnavigation — vorher lag sie als
// Tab-Leiste oben. Der Mock traegt deshalb einen echten Link: Ohne ihn
// haette der Desktop-Fall ueberhaupt keinen Navigationsweg, und der Test
// unten wuerde ein Verhalten pruefen, das es so nicht mehr gibt.
vi.mock('../../../src/components/governance-os/GovernanceSidebar', () => ({
  GovernanceSidebar: () => <Link to="/app/evidence">Nachweise öffnen</Link>,
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
  GovernanceAddressBar: ({ onLoadUrl }: { onLoadUrl: (url: string) => void }) => (
    <button onClick={() => onLoadUrl('https://example.com')}>Website öffnen</button>
  ),
}));
vi.mock('../../../src/components/governance-os/EmbeddedBrowserCanvas', () => ({
  EmbeddedBrowserCanvas: () => <div data-testid="embedded-page" />,
}));
vi.mock('../../../src/core/access/RouteEntitlementGate', () => ({
  RouteEntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'test-user' },
    logout: vi.fn().mockResolvedValue(undefined),
  }),
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

  it('öffnet das mobile Systemmenü und schließt nach einer Modulwahl', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Systemmenü öffnen' }));
    const menu = screen.getByRole('navigation', { name: 'Systemmenü' });
    expect(screen.getByRole('button', { name: 'Systemmenü schließen' })).toHaveAttribute('aria-controls', menu.id);
    fireEvent.click(within(menu).getByRole('link', { name: 'Nachweise öffnen' }));
    expect(screen.queryByRole('navigation', { name: 'Systemmenü' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/evidence');
  });

  it('öffnet die Befehlssuche aus dem mobilen Menü', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Systemmenü öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Module und Aktionen suchen' }));
    expect(screen.getByRole('dialog', { name: 'Command Center' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Systemmenü' })).not.toBeInTheDocument();
  });

  it('schließt das mobile Menü mit Escape', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Systemmenü öffnen' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Systemmenü' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Systemmenü öffnen' })).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['/app/home', '/app/evidence'])('entfernt die Website beim Modulwechsel von %s', (initial) => {
    renderShell(initial);
    fireEvent.click(screen.getByRole('button', { name: 'Website öffnen' }));
    expect(screen.getByTestId('embedded-page')).toBeInTheDocument();
    // Modulwechsel ueber die Seitenleiste — der Weg, den der Desktop seit
    // dem Wegfall der oberen Tab-Leiste tatsaechlich nimmt.
    fireEvent.click(screen.getByRole('link', { name: 'Nachweise öffnen' }));
    expect(screen.queryByTestId('embedded-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/evidence');
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

    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
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
