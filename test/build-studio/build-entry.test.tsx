/**
 * Builder-02: /build is the one entry; app kinds continue in the code builder.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import BuildStudioPage from '../../src/unified-entry/pages/BuildStudioPage';
import { buildSiteFromPrompt } from '../../packages/siteos-core/src/index';

const session = vi.hoisted(() => ({
  startBuild: vi.fn(async () => null),
  resumeBuild: vi.fn(async (): Promise<unknown> => null),
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

function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go {to}
    </button>
  );
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/build"
          element={
            <>
              <GoTo to="/build?kind=website" />
              <BuildStudioPage />
            </>
          }
        />
        <Route path="/builder/:slug/code" element={<CodeTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('/build entry by kind', () => {
  beforeEach(() => {
    session.startBuild.mockClear();
    session.resumeBuild.mockReset();
    session.resumeBuild.mockImplementation(async () => null);
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

  it('follows ?kind= when the page is reused and resumes once a site kind is chosen', async () => {
    renderAt('/build?kind=web_app');
    expect(await screen.findByRole('button', { name: 'Web-App', pressed: true })).toBeTruthy();
    expect(session.resumeBuild).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'go /build?kind=website' }));
    expect(await screen.findByRole('button', { name: 'Website', pressed: true })).toBeTruthy();
    await waitFor(() => expect(session.resumeBuild).toHaveBeenCalledTimes(1));
  });

  it('keeps the app choice reachable while a site draft is resumed, without dropping the draft', async () => {
    const built = await buildSiteFromPrompt(
      'Website für ein Architekturbüro in Leipzig mit Projekten und Kontakt.',
    );
    session.resumeBuild.mockImplementation(async () => ({
      session: { id: 's1', mode: 'local', prompt: '', brand: null, createdAt: '2026-10-03T00:00:00Z' },
      blueprint: built.blueprint,
      findings: built.findings,
      scores: built.scores,
      version: 1,
      contentSha256: built.blueprintSha256,
      expiresAt: null,
      claimed: false,
      preview: { status: 'none' },
    }));
    renderAt('/build');

    fireEvent.click(await screen.findByRole('button', { name: 'Stattdessen eine App bauen' }));
    expect(await screen.findByRole('button', { name: 'Web-App', pressed: true })).toBeTruthy();
    expect(screen.getByText(/Website-Entwurf bleibt erhalten/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Website' }));
    expect(await screen.findByRole('button', { name: 'Stattdessen eine App bauen' })).toBeTruthy();
  });
});
