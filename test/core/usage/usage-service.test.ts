import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEntitlementsForTenant } from '../../../src/core/usage/usage-service';

// Mock the supabase module — controlled per-test via vi.mocked().
vi.mock('../../../src/lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(),
  getSupabase: vi.fn(),
}));

import { isSupabaseConfigured, getSupabase } from '../../../src/lib/supabase';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEntitlementsForTenant — unconfigured fallback', () => {
  it('returns a free-tier decision when Supabase is not configured', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);

    const decision = await getEntitlementsForTenant('00000000-0000-0000-0000-000000000001');

    expect(decision.planKey).toBe('free');
    expect(decision.features).toBeDefined();
    expect(typeof decision.isActive).toBe('boolean');
    // Free tier never reports overages — usage is zero across the board.
    expect(decision.overages.assetsExceeded).toBe(false);
    expect(decision.overages.apiExceeded).toBe(false);
  });

  it('does not call getSupabase() when unconfigured (no DB roundtrip)', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);

    await getEntitlementsForTenant('any-tenant-id');

    expect(getSupabase).not.toHaveBeenCalled();
  });
});

describe('getEntitlementsForTenant — configured happy path', () => {
  it('builds a SubscriptionSnapshot from the most recent subscription row', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);

    // Build a chain-mock that mirrors the supabase-js fluent API. Each
    // table query returns a thenable with the right shape.
    const tenantQuery = makeChain({ data: { id: 't1', is_public_sector: false }, error: null });
    const subQuery = makeChain({
      data: {
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        stripe_product_id: 'prod_silver',
        stripe_price_id: 'price_silver_monthly',
        plan_key: 'silver',
        billing_interval: 'month',
        status: 'active',
        quantity: 1,
        cancel_at_period_end: false,
        current_period_end: '2026-06-01T00:00:00Z',
      },
      error: null,
    });
    const memberQuery = makeChain({ count: 3, error: null });
    const usageQuery = makeChain({
      data: [
        { entitlement_key: 'limit.active_assets', total: 42 },
        { entitlement_key: 'limit.api_calls_monthly', total: 1500 },
      ],
      error: null,
    });

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn((table: string) => {
        switch (table) {
          case 'tenants':       return tenantQuery;
          case 'subscriptions': return subQuery;
          case 'memberships':   return memberQuery;
          case 'usage_totals':  return usageQuery;
          default: throw new Error(`unexpected table ${table}`);
        }
      }),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    } as unknown as ReturnType<typeof getSupabase>);

    const decision = await getEntitlementsForTenant('t1');

    expect(decision.planKey).toBe('silver');
    expect(decision.features).toBeDefined();
    expect(decision.limits).toBeDefined();
  });
});

/**
 * Helper: build a fake supabase query-chain that returns the same `result`
 * regardless of how many `.eq() / .order() / .limit() / .maybeSingle() / .select()`
 * calls are stacked. Awaiting the chain (or calling the terminal `maybeSingle`)
 * yields the result directly.
 */
function makeChain<T>(result: T): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.order = passthrough;
  chain.limit = passthrough;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    onFulfilled?: (v: T) => unknown,
    onRejected?: (r: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}
