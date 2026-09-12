/**
 * Component-level gates for /build studio access.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BuildStudioPage from '../../src/unified-entry/pages/BuildStudioPage';
import { planById } from '../../shared/pricing';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

const entState = vi.hoisted(() => ({
  tier: 'free' as string,
  loading: false,
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
  }),
}));

vi.mock('../../src/core/billing/useEntitlements', () => ({
  useEntitlements: () => ({
    tier: entState.tier,
    loading: entState.loading,
    hasFeature: () => false,
    getLimit: () => null,
    canAccess: () => ({ allowed: false }),
    features: {},
    paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
  }),
}));

vi.mock('../../src/features/siteos/buildSession', () => ({
  startBuild: vi.fn(async () => null),
  resumeBuild: vi.fn(async () => null),
  applyInstruction: vi.fn(),
  clear: vi.fn(),
}));

function renderBuild() {
  return render(
    <MemoryRouter initialEntries={['/build']}>
      <Routes>
        <Route path="/build" element={<BuildStudioPage />} />
        <Route path="/welcome" element={<div data-testid="welcome">welcome</div>} />
        <Route path="/checkout/:plan" element={<div data-testid="checkout">checkout</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BuildStudioPage gates', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    entState.tier = 'free';
    entState.loading = false;
  });

  it('redirects signed-out users to /welcome?next=/build', async () => {
    authState.isAuthenticated = false;
    renderBuild();
    expect(await screen.findByTestId('welcome')).toBeTruthy();
  });

  it('shows upgrade panel when SSoT has appBuilder and plan lacks it', async () => {
    const hasKey = Object.prototype.hasOwnProperty.call(
      planById('free').permissions,
      'appBuilder',
    );
    authState.isAuthenticated = true;
    entState.tier = 'free';
    renderBuild();

    if (hasKey) {
      expect(await screen.findByTestId('builder-upgrade-panel')).toBeTruthy();
      expect(screen.getByTestId('builder-upgrade-cta')).toBeTruthy();
      expect(screen.queryByText(/Pilot anfragen|Demo buchen|Beratung anfragen|Termin vereinbaren/i)).toBeNull();
    } else {
      await waitFor(() => {
        expect(screen.getByTestId('builder-ssot-pending-banner')).toBeTruthy();
      });
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
      expect(screen.queryByTestId('builder-upgrade-panel')).toBeNull();
    }
  });

  it('starter can open builder once SSoT grants appBuilder', async () => {
    const hasKey = Object.prototype.hasOwnProperty.call(
      planById('starter').permissions,
      'appBuilder',
    );
    authState.isAuthenticated = true;
    entState.tier = 'starter';
    renderBuild();

    if (hasKey) {
      expect(screen.queryByTestId('builder-upgrade-panel')).toBeNull();
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
    } else {
      expect(await screen.findByTestId('builder-ssot-pending-banner')).toBeTruthy();
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
    }
  });
});
