import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { TenantProvider, useTenant } from '../../src/core/access/TenantProvider';
import * as supabaseModule from '../../src/lib/supabase';
import * as loadModule from '../../src/core/access/load-entitlements';

function Probe() {
  const tenant = useTenant();
  if (tenant.loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="names">{tenant.tenants.map((item) => item.name).join('|')}</div>
      <div data-testid="active">{tenant.activeTenant?.name}</div>
      <div data-testid="role">{tenant.role}</div>
      <div data-testid="plan">{tenant.plan}</div>
      <div data-testid="theme">{tenant.themeId}</div>
      <button type="button" onClick={() => tenant.setActiveTenant('fixture-warmgraphit')}>wechsel</button>
    </div>
  );
}

describe('TenantProvider Fixture-Vorschau', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) } } as never);
  });

  it('setzt drei Fixture-Mandanten und schreibt nicht in die Datenbank', async () => {
    const listSpy = vi.spyOn(loadModule, 'listMyTenants').mockResolvedValue([]);
    const entSpy = vi.spyOn(loadModule, 'loadEntitlements').mockResolvedValue({ byKey: {} });
    render(<TenantProvider initialFixturePreview><Probe /></TenantProvider>);
    await waitFor(() => expect(screen.getByTestId('names')).toHaveTextContent('Fixture · Lichtkante'));
    expect(screen.getByTestId('names').textContent?.split('|')).toHaveLength(3);
    expect(screen.getByTestId('theme')).toHaveTextContent('light-cream');
    expect(screen.getByTestId('role')).toHaveTextContent('owner');
    expect(screen.getByTestId('plan')).toHaveTextContent('starter');
    expect(listSpy).not.toHaveBeenCalled();
    expect(entSpy).not.toHaveBeenCalled();
  });

  it('wechselt Mandant, Rolle, Plan und Theme-Verweis', async () => {
    vi.spyOn(loadModule, 'listMyTenants').mockResolvedValue([]);
    render(<TenantProvider initialFixturePreview><Probe /></TenantProvider>);
    await screen.findByTestId('theme');
    fireEvent.click(screen.getByRole('button', { name: 'wechsel' }));
    expect(screen.getByTestId('active')).toHaveTextContent('Fixture · Warmgraphit');
    expect(screen.getByTestId('role')).toHaveTextContent('viewer_auditor');
    expect(screen.getByTestId('plan')).toHaveTextContent('enterprise');
    expect(screen.getByTestId('theme')).toHaveTextContent('warm-graphite');
  });
});
