/**
 * Component-level gates for /build studio access — siteos.builder keys.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BuildStudioPage from '../../src/unified-entry/pages/BuildStudioPage';
import { ENTITLEMENT_KEYS } from '../../shared/pricing';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

const entState = vi.hoisted(() => ({
  tier: 'free' as string,
  loading: false,
  features: {} as Record<string, boolean | number>,
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
    features: entState.features,
    hasFeature: (key: string) => {
      const val = entState.features[key];
      return val === true || val === -1 || (typeof val === 'number' && val > 0);
    },
    getLimit: (key: string) => {
      const val = entState.features[key];
      return typeof val === 'number' ? val : null;
    },
    canAccess: (key: string) => {
      const val = entState.features[key];
      const allowed = val === true || val === -1 || (typeof val === 'number' && val > 0);
      return {
        allowed,
        upgradeUrl: allowed
          ? undefined
          : '/checkout/starter?source=feature-upgrade&return=/app/dashboard',
      };
    },
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

const ssotReady = (ENTITLEMENT_KEYS as readonly string[]).includes('siteos.builder');

describe('BuildStudioPage gates', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
    entState.tier = 'free';
    entState.loading = false;
    entState.features = {};
  });

  it('redirects signed-out users to /welcome?next=/build', async () => {
    authState.isAuthenticated = false;
    renderBuild();
    expect(await screen.findByTestId('welcome')).toBeTruthy();
  });

  it('shows upgrade panel when siteos.builder is missing', async () => {
    authState.isAuthenticated = true;
    entState.tier = 'free';
    entState.features = { 'siteos.builder': 0, 'limit.sites': 0 };
    renderBuild();

    if (ssotReady) {
      expect(await screen.findByTestId('builder-upgrade-panel')).toBeTruthy();
      expect(screen.getByTestId('builder-upgrade-cta')).toBeTruthy();
      expect(
        screen.queryByText(/Pilot anfragen|Demo buchen|Beratung anfragen|Termin vereinbaren/i),
      ).toBeNull();
    } else {
      await waitFor(() => {
        expect(screen.getByTestId('builder-ssot-pending-banner')).toBeTruthy();
      });
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
    }
  });

  it('starter with siteos.builder can open the studio', async () => {
    authState.isAuthenticated = true;
    entState.tier = 'starter';
    entState.features = {
      'siteos.builder': 1,
      'siteos.publish': 1,
      'limit.sites': 1,
    };
    renderBuild();

    if (ssotReady) {
      expect(screen.queryByTestId('builder-upgrade-panel')).toBeNull();
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
    } else {
      // Features alone open builder even before ENTITLEMENT_KEYS lands —
      // resolveBuilderEntitlements reads the feature map first.
      expect(await screen.findByText(/Was möchten Sie erstellen/i)).toBeTruthy();
    }
  });
});
