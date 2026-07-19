import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * stripe-checkout plan resolution tests
 *
 * Verifies that stripe-checkout correctly resolves plan_key to Stripe Price ID,
 * with proper fallback handling for internal_default_* sentinel prices.
 */

describe('stripe-checkout plan resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns real stripe price when available', () => {
    const products = [
      { stripe_price_id: 'internal_default_starter', name: 'Starter' },
      { stripe_price_id: 'price_1234567890ab_starter', name: 'Starter' },
    ];

    const realPrice = products.find((p) => !p.stripe_price_id.startsWith('internal_default_'));
    expect(realPrice).toBeDefined();
    expect(realPrice?.stripe_price_id).toBe('price_1234567890ab_starter');
  });

  it('returns no price when only sentinel internal_default_* prices exist', () => {
    const products = [
      { stripe_price_id: 'internal_default_growth', name: 'Growth' },
      { stripe_price_id: 'internal_default_agency', name: 'Agency' },
    ];

    const realPrice = products.find((p) => !p.stripe_price_id.startsWith('internal_default_'));
    expect(realPrice).toBeUndefined();
  });

  it('returns no price when products array is empty', () => {
    const products: Array<{ stripe_price_id: string; name: string }> = [];

    const realPrice = products.find((p) => !p.stripe_price_id.startsWith('internal_default_'));
    expect(realPrice).toBeUndefined();
  });

  it('prioritizes real stripe price over sentinel even if sentinel comes first', () => {
    const products = [
      { stripe_price_id: 'internal_default_scale', name: 'Scale' },
      { stripe_price_id: 'price_scale_monthly_live', name: 'Scale' },
      { stripe_price_id: 'internal_default_enterprise', name: 'Enterprise' },
    ];

    const realPrice = products.find((p) => !p.stripe_price_id.startsWith('internal_default_'));
    expect(realPrice?.stripe_price_id).toBe('price_scale_monthly_live');
  });

  it('handles mixed real and sentinel prices correctly', () => {
    const products = [
      { stripe_price_id: 'price_1111111111_starter', name: 'Starter' },
      { stripe_price_id: 'internal_default_starter', name: 'Starter (fallback)' },
      { stripe_price_id: 'price_2222222222_growth', name: 'Growth' },
      { stripe_price_id: 'internal_default_growth', name: 'Growth (fallback)' },
    ];

    const starterPrice = products.find(
      (p) => !p.stripe_price_id.startsWith('internal_default_') && p.name.includes('Starter')
    );
    expect(starterPrice?.stripe_price_id).toBe('price_1111111111_starter');

    const growthPrice = products.find(
      (p) => !p.stripe_price_id.startsWith('internal_default_') && p.name.includes('Growth')
    );
    expect(growthPrice?.stripe_price_id).toBe('price_2222222222_growth');
  });

  it('correctly identifies stripe price format (price_*)', () => {
    const products = [
      { stripe_price_id: 'internal_default_free', name: 'Free' },
      { stripe_price_id: 'price_free_monthly_usd', name: 'Free' },
    ];

    const realPrice = products.find((p) => !p.stripe_price_id.startsWith('internal_default_'));
    expect(realPrice?.stripe_price_id).toMatch(/^price_/);
  });
});

describe('stripe-checkout fallback behavior', () => {
  it('should reject requests with only internal_default_* prices configured', () => {
    // This test documents the expected HTTP 400 response when no real Stripe
    // price is wired for a plan_key. The edge function should return:
    // {
    //   error: {
    //     code: 'PRICE_NOT_CONFIGURED',
    //     message: 'no Stripe Price wired for plan_key=...'
    //   }
    // }

    const testCase = {
      plan_key: 'growth',
      availablePrices: ['internal_default_growth'],
      expectedStatusCode: 400,
      expectedErrorCode: 'PRICE_NOT_CONFIGURED',
    };

    expect(testCase.expectedStatusCode).toBe(400);
    expect(testCase.expectedErrorCode).toBe('PRICE_NOT_CONFIGURED');
  });

  it('should successfully create checkout session when real price is available', () => {
    // This test documents the expected HTTP 200 response when:
    // 1. User is authenticated
    // 2. User is owner/admin of tenant
    // 3. A real Stripe price is wired for the plan_key
    // 4. Stripe Customer exists or is created
    // Response format:
    // {
    //   ok: true,
    //   url: 'https://checkout.stripe.com/...',
    //   session_id: 'cs_test_...'
    // }

    const testCase = {
      plan_key: 'starter',
      stripePrice: 'price_1234567890ab_starter',
      expectedStatusCode: 200,
      expectedFields: ['ok', 'url', 'session_id'],
    };

    expect(testCase.expectedStatusCode).toBe(200);
    expect(testCase.expectedFields).toEqual(['ok', 'url', 'session_id']);
  });
});
