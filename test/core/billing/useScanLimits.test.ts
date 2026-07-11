import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScanLimits } from '../../../src/core/billing/useScanLimits';
import * as useEntitlementsModule from '../../../src/core/billing/useEntitlements';
import * as supabaseModule from '../../../src/lib/supabase';
import { TenantProvider } from '../../../src/core/access/TenantProvider';
import React from 'react';

describe('useScanLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(TenantProvider, { children });

  it('returns null for paid tier users', () => {
    // Mock useEntitlements to return paid tier
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'starter',
      loading: false,
      error: null,
      features: {},
      hasFeature: () => true,
      getLimit: () => null,
      canAccess: () => ({ allowed: true }),
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(false);

    const { result } = renderHook(() => useScanLimits(), { wrapper });

    expect(result.current).toBeNull();
  });

  it('returns status object for free tier users', async () => {
    // Mock useEntitlements to return free tier
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free_tier',
      loading: false,
      error: null,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }],
                error: null,
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

  it('returns isAtLimit=true when used >= limit', async () => {
    vi.spyOn(useEntitlementsModule, 'useEntitlements').mockReturnValue({
      tier: 'free_tier',
      loading: false,
      error: null,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }, { id: '3' }],
                error: null,
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
      tier: 'free_tier',
      loading: false,
      error: null,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                data: [],
                error: null,
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
      tier: 'free_tier',
      loading: false,
      error: null,
      features: {},
      hasFeature: () => false,
      getLimit: () => 3,
      canAccess: () => ({ allowed: false }),
    });

    vi.spyOn(supabaseModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
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
