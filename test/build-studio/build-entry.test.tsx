/**
 * Builder-02: /build is the one entry; app kinds continue in the code builder.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import BuildStudioPage from '../../src/unified-entry/pages/BuildStudioPage';

const session = vi.hoisted(() => ({
  startBuild: vi.fn(async () => null),
  resumeBuild: vi.fn(async () => null),
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock('../../src/core/billing/useEntitlements', () => ({
  useEntitlements: () => ({
    tier: 'starter',
    loading: false,
    features: { 'siteos.builder': 1, 'siteos.publish': 1, 'limit.sites': 1 },
    hasFeature: () => true,
    getLimit: () => 1,
    canAccess: () => ({ allowed: true }),
    paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
  }),
}));

vi.mock('../../src/features/siteos/buildSession', () => ({
  startBuild: session.startBuild,
  resumeBuild: session.resumeBuild,
  applyInstruction: vi.fn(),
  clear: vi.fn(),
}));

function CodeTarget() {
  const location = useLocation();
  return <div data-testid="code-builder">{location.pathname}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/build" element={<BuildStudioPage />} />
        <Route path="/builder/:slug/code" element={<CodeTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/build entry by kind', () => {
  beforeEach(() => {
    session.startBuild.mockClear();
    session.resumeBuild.mockClear();
  });

  it('defaults to the website flow', async () => {
    renderAt('/build');
    expect(await screen.findByRole('button', { name: 'Website', pressed: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Blueprint erzeugen' })).toBeTruthy();
    expect(session.resumeBuild).toHaveBeenCalledTimes(1);
  });

  it('opens the code builder for an app kind without starting a site build', async () => {
    renderAt('/build?kind=web_app&prompt=Kundenportal');
    expect(await screen.findByRole('button', { name: 'Web-App', pressed: true })).toBeTruthy();
    expect(session.startBuild).not.toHaveBeenCalled();
    expect(session.resumeBuild).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Wie heißt die App/), {
      target: { value: 'Kundenportal Nord' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Code-Builder öffnen' }));

    expect((await screen.findByTestId('code-builder')).textContent).toBe(
      '/builder/kundenportal-nord/code',
    );
    expect(session.startBuild).not.toHaveBeenCalled();
  });

  it('switching to an app kind changes the submit target', async () => {
    renderAt('/build');
    fireEvent.click(await screen.findByRole('button', { name: 'Dashboard' }));
    fireEvent.change(screen.getByLabelText(/Ihre Beschreibung/), {
      target: { value: 'Lager Übersicht' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Code-Builder öffnen' }));
    expect((await screen.findByTestId('code-builder')).textContent).toBe(
      '/builder/lager-uebersicht/code',
    );
  });
});
