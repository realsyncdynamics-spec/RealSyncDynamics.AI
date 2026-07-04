/**
 * Regressionstests für die Checkout-Auth-Auflösung.
 *
 * Hintergrund (Launch-Readiness-Review, Punkt 6): /checkout/:plan blieb beim
 * ersten Aufruf mehrere Sekunden im „Lade…"-Zustand hängen. Ursache war
 * sb.auth.getUser() — ein Netzwerk-Roundtrip zum Auth-Server. Der Fix nutzt
 * das lokale getSession() und ein Timeout-Sicherheitsnetz.
 *
 * Diese Tests sperren das Verhalten ein:
 *  - getSession() wird verwendet (nicht getUser())
 *  - vorhandene Session + Membership → „ready" (Bezahl-Gate)
 *  - keine Session → „no_user" (Login)
 *  - Session ohne Membership → „no_tenant" (Workspace einrichten)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ─── Supabase-Client-Mock ──────────────────────────────────────────────────
const getSession = vi.fn();
const getUser = vi.fn();
const limit = vi.fn();

vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession, getUser },
    from: () => ({
      select: () => ({
        in: () => ({ limit }),
      }),
    }),
  }),
}));

// Analytics/Pixel-Seiteneffekte im Test unterbinden.
vi.mock('../../src/lib/marketingAnalytics', () => ({ trackMarketingEvent: vi.fn() }));
vi.mock('../../src/lib/pixels', () => ({ trackConversion: vi.fn() }));

import { CheckoutPage } from '../../src/features/billing/CheckoutPage';

function renderCheckout(plan = 'starter') {
  return render(
    <MemoryRouter initialEntries={[`/checkout/${plan}`]}>
      <Routes>
        <Route path="/checkout/:planKey" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const bodyText = () => document.body.textContent ?? '';

describe('CheckoutPage — Auth-Auflösung', () => {
  beforeEach(() => {
    getSession.mockReset();
    getUser.mockReset();
    limit.mockReset();
    // Standard: leere Membership-Liste, sofern ein Test nichts anderes setzt.
    limit.mockResolvedValue({ data: [] });
  });

  it('nutzt getSession() (kein getUser()-Netzwerk-Roundtrip)', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    renderCheckout();

    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(getUser).not.toHaveBeenCalled();
  });

  it('zeigt bei fehlender Session den Login-Zustand', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    renderCheckout();

    await waitFor(() => expect(bodyText()).toMatch(/Anmelden, um/i));
  });

  it('zeigt bei vorhandener Session + Membership das Bezahl-Gate', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: 'owner@example.com' } } },
    });
    limit.mockResolvedValue({ data: [{ tenant_id: 'tenant-1', role: 'owner' }] });

    renderCheckout();

    await waitFor(() => expect(bodyText()).toMatch(/keine Setup-Gebühren/i));
    // Bezahl-Gate zeigt die angemeldete E-Mail an.
    expect(bodyText()).toMatch(/owner@example\.com/);
  });

  it('zeigt bei Session ohne Membership den Workspace-Einrichten-Zustand', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { email: 'user@example.com' } } },
    });
    limit.mockResolvedValue({ data: [] });

    renderCheckout();

    await waitFor(() => expect(bodyText()).toMatch(/Workspace einrichten/i));
  });
});
