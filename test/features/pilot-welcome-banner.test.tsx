/**
 * Das Willkommensbanner nach der Pilot-Aktivierung.
 *
 * Zwei Zusagen werden hier festgehalten:
 *   1) Der Banner erscheint NUR bei `?welcome=pilot` und nennt die Domain.
 *   2) Er gilt für beide Dashboard-Zweige (Free und Paid) — der Entitlement-
 *      Cache braucht einen Moment, bis ein frisch angelegter Starter-Trial
 *      sichtbar ist, und der Nutzer darf in dieser Zeit nicht ohne Bestätigung
 *      dastehen.
 *
 * Zusätzlich: im Paid-Zweig darf der Cockpit-eigene First-Time-Hinweis nicht
 * zusätzlich erscheinen, sonst stehen zwei Begrüßungen übereinander.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockUseEntitlements = vi.fn();
const mockCeoCockpit = vi.fn();

vi.mock('../../src/core/billing/useEntitlements', () => ({
  useEntitlements: () => mockUseEntitlements(),
}));

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', tenants: [] }),
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  getSupabase: () => {
    throw new Error('nicht konfiguriert — der Banner muss auch ohne Daten rendern');
  },
}));

vi.mock('../../src/lib/performance', () => ({
  usePerformanceMonitor: () => undefined,
}));

vi.mock('../../src/features/governance/dashboard/FreeTierDashboard', () => ({
  FreeTierDashboard: () => <div data-testid="free-dashboard">Free</div>,
}));

vi.mock('../../src/features/governance/cockpit/CeoCockpitView', () => ({
  CeoCockpitView: (props: { suppressFirstTimeBanner?: boolean }) => {
    mockCeoCockpit(props);
    return <div data-testid="ceo-dashboard">Cockpit</div>;
  },
}));

const { DashboardRouter } = await import('../../src/features/governance/dashboard/DashboardRouter');

function renderDashboard(search: string, tier: string) {
  mockUseEntitlements.mockReturnValue({ tier, loading: false });
  return render(
    <MemoryRouter initialEntries={[`/app/dashboard${search}`]}>
      <DashboardRouter />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockCeoCockpit.mockClear();
});

describe('PilotWelcomeBanner im DashboardRouter', () => {
  it('erscheint bei ?welcome=pilot mit der geforderten Zusage', () => {
    renderDashboard('?welcome=pilot&domain=example.com', 'starter');

    expect(screen.getByTestId('pilot-welcome-banner')).toBeInTheDocument();
    expect(
      screen.getByText('Deine Governance-Runtime für example.com ist jetzt aktiv (14 Tage Pilot)'),
    ).toBeInTheDocument();
  });

  it('erscheint nicht ohne den Parameter', () => {
    renderDashboard('', 'starter');
    expect(screen.queryByTestId('pilot-welcome-banner')).toBeNull();
  });

  it('erscheint nicht bei einem anderen welcome-Wert', () => {
    renderDashboard('?welcome=checkout&domain=example.com', 'starter');
    expect(screen.queryByTestId('pilot-welcome-banner')).toBeNull();
  });

  it('gilt auch im Free-Zweig — der Entitlement-Cache hinkt kurz nach', () => {
    renderDashboard('?welcome=pilot&domain=example.com', 'free');

    expect(screen.getByTestId('free-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('pilot-welcome-banner')).toBeInTheDocument();
    expect(screen.getByText(/example.com ist jetzt aktiv/)).toBeInTheDocument();
  });

  it('unterdrückt den Cockpit-First-Time-Hinweis, solange der Banner steht', () => {
    renderDashboard('?welcome=pilot&domain=example.com', 'starter');
    expect(screen.getByTestId('ceo-dashboard')).toBeInTheDocument();
    expect(mockCeoCockpit).toHaveBeenCalledWith(
      expect.objectContaining({ suppressFirstTimeBanner: true }),
    );
  });

  it('lässt das normale First-Time-Verhalten unangetastet', () => {
    renderDashboard('', 'starter');
    expect(mockCeoCockpit).toHaveBeenCalledWith(
      expect.objectContaining({ suppressFirstTimeBanner: false }),
    );
  });

  it('rendert auch ohne Domain-Parameter, statt zu brechen', () => {
    renderDashboard('?welcome=pilot', 'starter');
    expect(screen.getByTestId('pilot-welcome-banner')).toBeInTheDocument();
    expect(screen.getByText(/deine Domain ist jetzt aktiv/)).toBeInTheDocument();
  });
});
