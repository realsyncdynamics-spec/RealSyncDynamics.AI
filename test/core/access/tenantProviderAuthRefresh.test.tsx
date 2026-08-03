// Regression: Nach einem MFA-Step-up (AAL1 → AAL2) muss der TenantProvider
// Tenants + Entitlements neu laden. Ohne das behält er die Daten der alten
// Sicherheitsstufe und nachgelagerte Views (Billing) hängen im Ladezustand.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { TenantProvider, useTenant } from '../../../src/core/access/TenantProvider';
import * as supabaseModule from '../../../src/lib/supabase';
import * as loadModule from '../../../src/core/access/load-entitlements';

type AuthHandler = (event: string, session: unknown) => void;

/** Sammelt die registrierten onAuthStateChange-Handler, um Events zu feuern. */
function makeSupabaseMock() {
  const handlers: AuthHandler[] = [];
  const unsubscribe = vi.fn();
  return {
    handlers,
    unsubscribe,
    client: {
      auth: {
        onAuthStateChange: (cb: AuthHandler) => {
          handlers.push(cb);
          return { data: { subscription: { unsubscribe } } };
        },
      },
    },
  };
}

function Probe() {
  const { tenants, loading } = useTenant();
  return <div data-testid="probe">{loading ? 'loading' : tenants.map((t) => t.name).join(',')}</div>;
}

describe('TenantProvider – Reload bei Auth-Statuswechsel', () => {
  let mock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mock = makeSupabaseMock();
    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mock.client as never);
    vi.spyOn(loadModule, 'loadEntitlements').mockResolvedValue({ byKey: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderProvider() {
    render(<TenantProvider><Probe /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('probe')).not.toHaveTextContent('loading'));
  }

  it('lädt Tenants nach MFA_CHALLENGE_VERIFIED neu', async () => {
    // Vor dem Step-up liefert die Abfrage nichts (AAL1-Sicht), danach den Tenant.
    const listSpy = vi.spyOn(loadModule, 'listMyTenants')
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { tenantId: 't1', name: 'RealSync Workspace', isPublicSector: false, industry: null, role: 'owner' },
      ]);

    await renderProvider();
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('probe')).toHaveTextContent('');

    await act(async () => {
      mock.handlers.forEach((h) => h('MFA_CHALLENGE_VERIFIED', {}));
    });

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('RealSync Workspace'));
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('lädt NICHT bei TOKEN_REFRESHED neu (sonst periodischer Lade-Flash)', async () => {
    const listSpy = vi.spyOn(loadModule, 'listMyTenants').mockResolvedValue([
      { tenantId: 't1', name: 'RealSync Workspace', isPublicSector: false, industry: null, role: 'owner' },
    ]);

    await renderProvider();
    expect(listSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      mock.handlers.forEach((h) => h('TOKEN_REFRESHED', {}));
      mock.handlers.forEach((h) => h('INITIAL_SESSION', {}));
    });

    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('meldet den Listener beim Unmount ab', async () => {
    vi.spyOn(loadModule, 'listMyTenants').mockResolvedValue([]);
    const { unmount } = render(<TenantProvider><Probe /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('probe')).not.toHaveTextContent('loading'));
    unmount();
    expect(mock.unsubscribe).toHaveBeenCalled();
  });

  it('wirft nicht, wenn der Auth-Client fehlt (Provider umschließt die ganze App)', async () => {
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({} as never);
    vi.spyOn(loadModule, 'listMyTenants').mockResolvedValue([]);

    expect(() => render(<TenantProvider><Probe /></TenantProvider>)).not.toThrow();
    await waitFor(() => expect(screen.getByTestId('probe')).not.toHaveTextContent('loading'));
  });
});
