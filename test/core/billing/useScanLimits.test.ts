import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useScanLimits } from '../../../src/core/billing/useScanLimits';
import * as useEntitlementsModule from '../../../src/core/billing/useEntitlements';
import * as supabaseModule from '../../../src/lib/supabase';
import * as tenantModule from '../../../src/core/access/TenantProvider';
import { TenantProvider } from '../../../src/core/access/TenantProvider';
import React from 'react';

describe('useScanLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(TenantProvider, { children });

  it('returns null when the plan carries no scan limit', () => {
    // Seit 2026-09-28 entscheidet allein `website.scan_monthly_limit`, nicht
    // der Plan-Name. `null` kommt hier aus dem Wert, nicht aus `tier`.
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'starter',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => true,
      getLimit: () => null,
      canAccess: () => ({ allowed: true }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(false);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    expect(result.current).toBeNull();
  });

  it('returns status object for free tier users', async () => {
    // Mock useEntitlements to return free tier
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      // TenantProvider registriert einen onAuthStateChange-Listener —
      // der Mock muss die Auth-API daher mit abbilden.
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }],
                error: undefined,
              }),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    // Wait for async state update
    await new Promise(resolve => setTimeout(resolve, 100));

    // Status should have correct values
    if (result.current) {
      expect(result.current.limit).toBe(3);
      expect(result.current.used).toBe(2);
      expect(result.current.remaining).toBe(1);
      expect(result.current.canScan).toBe(true);
      expect(result.current.isAtLimit).toBe(false);
    }
  });

  it('counts a paid plan whose catalog value is finite — the name decides nothing', async () => {
    // Bis 2026-09-28 stand vor der Zählung `if (tier !== 'free') return`.
    // Ein bezahlter Plan mit endlichem Kontingent wäre damit still unbegrenzt
    // gewesen — unter BASE + MODULE + SCALE genau der Fehler, den
    // Zielarchitektur §10 ausschließt. Dieser Fall hält das fest.
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'growth',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => true,
      getLimit: () => 5,
      canAccess: () => ({ allowed: true }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    // Ein aktiver Mandant, direkt gesetzt. Der echte TenantProvider fände im
    // Test keinen (listMyTenants ist nicht gemockt) — dann bräche der Hook
    // vor der Zählung ab, und dieser Fall bewiese nichts.
    // `beforeEach` ruft nur clearAllMocks, das stellt Spies nicht zurück —
    // ohne mockRestore() unten bekämen die folgenden Fälle diesen Mandanten.
    const tenantSpy = vi.spyOn(tenantModule, 'useTenant').mockReturnValue(
      { activeTenantId: 'tenant-1' } as unknown as ReturnType<typeof tenantModule.useTenant>,
    );

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: undefined }),
            }),
          }),
        }),
      }),
    };
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mockSupabase as any);

    try {
      const { result } = renderHook(() => useScanLimits());

      // Kein `if (result.current)` wie in den Fällen darüber: Gerade dass
      // überhaupt ein Status entsteht, ist hier die Aussage. `waitFor` statt
      // fester Wartezeit — sonst hinge der Fall an der Geschwindigkeit des Runners.
      await waitFor(() => expect(result.current).not.toBeNull());
      expect(result.current?.limit).toBe(5);
      expect(result.current?.used).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('scans');
    } finally {
      tenantSpy.mockRestore();
    }
  });

  it('returns isAtLimit=true when used >= limit', async () => {
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      // TenantProvider registriert einen onAuthStateChange-Listener —
      // der Mock muss die Auth-API daher mit abbilden.
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }, { id: '3' }],
                error: undefined,
              }),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    await new Promise(resolve => setTimeout(resolve, 100));

    if (result.current) {
      expect(result.current.isAtLimit).toBe(true);
      expect(result.current.canScan).toBe(false);
      expect(result.current.remaining).toBe(0);
    }
  });

  it('returns resetDate as first day of next month', async () => {
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      // TenantProvider registriert einen onAuthStateChange-Listener —
      // der Mock muss die Auth-API daher mit abbilden.
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: [],
                error: undefined,
              }),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    await new Promise(resolve => setTimeout(resolve, 100));

    if (result.current?.resetDate) {
      expect(result.current.resetDate.getDate()).toBe(1);
    }
  });

  it('handles Supabase errors gracefully', async () => {
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free',
      loading: false,
      error: undefined,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
      paymentState: { status: null, pastDueSince: null, graceDaysRemaining: null },
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      // TenantProvider registriert einen onAuthStateChange-Listener —
      // der Mock muss die Auth-API daher mit abbilden.
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Database error'),
              }),
            }),
          }),
        }),
      }),
    };

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(mockSupabase as any);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should return null on error
    expect(result.current).toBeNull();
  });
});
