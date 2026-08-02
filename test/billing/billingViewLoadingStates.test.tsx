// Regression: Die Billing-Seite darf niemals dauerhaft im Ladezustand hängen.
//
// Vorher griff der Lade-Guard (`loading || sub === null`) VOR den Guards für
// "kein Workspace" und "Ladefehler". Da `sub` nur auf dem Erfolgspfad den
// Wert `null` verlässt, blieb die Seite in beiden Fehlerfällen dauerhaft bei
// „Lade…" — u. a. wenn die Abo-Abfrage während des AAL1→AAL2-Wechsels nach
// MFA-Bestätigung fehlschlug.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const tenantState: Record<string, unknown> = {};

vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => tenantState,
}));

vi.mock('../../src/lib/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.de' }, isLoading: false, isAuthenticated: true }),
}));

vi.mock('../../src/lib/stripe', () => ({ createCheckoutSession: vi.fn() }));

const subscriptionsResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => subscriptionsResult }),
        not: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

import { BillingView } from '../../src/features/billing/BillingView';

function setTenant(over: Record<string, unknown>) {
  Object.keys(tenantState).forEach((k) => delete tenantState[k]);
  Object.assign(tenantState, {
    tenants: [{ tenantId: 't1', name: 'WS', isPublicSector: false, industry: null, role: 'owner' }],
    activeTenantId: 't1',
    entitlements: { byKey: {} },
    loading: false,
    error: null,
    getLimit: () => null,
    hasFeature: () => false,
    setActiveTenant: vi.fn(),
    refresh: vi.fn(),
    ...over,
  });
}

const renderView = () => render(<MemoryRouter><BillingView /></MemoryRouter>);

describe('BillingView – Ladezustände', () => {
  beforeEach(() => {
    subscriptionsResult.data = null;
    subscriptionsResult.error = null;
  });

  it('zeigt einen Fehler statt endlos zu laden, wenn die Abo-Abfrage fehlschlägt', async () => {
    subscriptionsResult.error = { message: 'JWT verification failed' };
    setTenant({});

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/konnte nicht geladen werden/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/JWT verification failed/)).toBeInTheDocument();
    expect(screen.queryByText(/Lade…/)).not.toBeInTheDocument();
  });

  it('zeigt „Kein Workspace" statt endlos zu laden, wenn kein Tenant aktiv ist', async () => {
    setTenant({ activeTenantId: null, tenants: [] });

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/Kein Workspace/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Lade…/)).not.toBeInTheDocument();
  });

  it('meldet einen Tenant-Fehler, statt im Spinner zu bleiben', async () => {
    setTenant({ error: 'Tenant-Daten konnten nicht geladen werden' });

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/Tenant-Daten konnten nicht geladen werden/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Lade…/)).not.toBeInTheDocument();
  });

  it('rendert den Inhalt, wenn kein Abo existiert', async () => {
    setTenant({});

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/Abrechnung & Plan/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Lade…/)).not.toBeInTheDocument();
  });

  it('zeigt weiterhin den Spinner, solange der Tenant-Kontext lädt', () => {
    setTenant({ loading: true, activeTenantId: null, tenants: [] });

    renderView();

    expect(screen.getByText(/Lade…/)).toBeInTheDocument();
  });
});
