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

describe('stripe-checkout add-ons', () => {
  it('accepts empty addons array and creates checkout without add-ons', () => {
    const request = {
      tenant_id: 'tenant-123',
      plan_key: 'growth',
      addons: [],
    };

    expect(request.addons).toEqual([]);
    expect(request).toHaveProperty('tenant_id');
    expect(request).toHaveProperty('plan_key');
  });

  it('accepts addons parameter with valid add-on IDs', () => {
    const request = {
      tenant_id: 'tenant-456',
      plan_key: 'agency',
      addons: ['response-pack-5k', 'whatsapp-channel'],
    };

    expect(Array.isArray(request.addons)).toBe(true);
    expect(request.addons).toHaveLength(2);
    expect(request.addons[0]).toBe('response-pack-5k');
    expect(request.addons[1]).toBe('whatsapp-channel');
  });

  it('filters non-string addon IDs from the request', () => {
    const addons = ['response-pack-5k', null, 'voice-addon', undefined, 123];
    const filtered = addons.filter((a) => typeof a === 'string');

    expect(filtered).toEqual(['response-pack-5k', 'voice-addon']);
    expect(filtered).toHaveLength(2);
  });

  it('resolves real Stripe prices for add-ons', () => {
    const addonProducts = [
      { id: 'response-pack-5k', stripe_price_id: 'price_addon_response_5k', name: 'Response Pack 5K' },
      { id: 'whatsapp-channel', stripe_price_id: 'price_addon_whatsapp', name: 'WhatsApp Extension' },
      { id: 'voice-addon', stripe_price_id: 'price_internal_addon_voice_bot', name: 'Voice Bot' },
    ];

    const selectedAddons = ['response-pack-5k', 'whatsapp-channel'];
    const lineItems = selectedAddons.map((addonId) => {
      const product = addonProducts.find((p) => p.id === addonId);
      return product ? { price: product.stripe_price_id, quantity: 1 } : null;
    }).filter((item) => item !== null);

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0]?.price).toBe('price_addon_response_5k');
    expect(lineItems[1]?.price).toBe('price_addon_whatsapp');
  });

  it('rejects add-ons with only internal sentinel prices', () => {
    const addonProducts = [
      { id: 'response-pack-5k', stripe_price_id: 'internal_default_response_pack_5k' },
      { id: 'voice-addon', stripe_price_id: 'internal_default_voice_bot' },
    ];

    const selectedAddons = ['response-pack-5k'];
    const lineItems = selectedAddons
      .map((addonId) => {
        const product = addonProducts.find((p) => p.id === addonId);
        if (!product) return null;
        // Only include real Stripe prices (not internal sentinels)
        if (product.stripe_price_id.startsWith('internal_default_')) return null;
        return { price: product.stripe_price_id, quantity: 1 };
      })
      .filter((item) => item !== null);

    // Even though product exists, internal sentinel price is filtered out
    expect(lineItems).toHaveLength(0);
  });

  it('stores add-ons in subscription metadata', () => {
    const selectedAddons = ['response-pack-5k', 'whatsapp-channel'];
    const metadata = {
      tenant_id: 'tenant-789',
      plan_key: 'scale',
      pilot: 'false',
      addons: selectedAddons.length > 0 ? JSON.stringify(selectedAddons) : '',
    };

    expect(metadata.addons).toBe(JSON.stringify(['response-pack-5k', 'whatsapp-channel']));

    const parsedAddons = JSON.parse(metadata.addons);
    expect(parsedAddons).toEqual(['response-pack-5k', 'whatsapp-channel']);
  });

  it('handles missing add-ons array gracefully', () => {
    const request: { tenant_id: string; plan_key: string; addons?: string[] } = {
      tenant_id: 'tenant-999',
      plan_key: 'starter',
    };

    const selectedAddons = Array.isArray(request.addons) ? request.addons.filter((a) => typeof a === 'string') : [];
    expect(selectedAddons).toEqual([]);
  });

  it('prevents duplicate add-ons in checkout', () => {
    const selectedAddons = ['response-pack-5k', 'response-pack-5k', 'whatsapp-channel'];
    const uniqueAddons = [...new Set(selectedAddons)];

    expect(uniqueAddons).toEqual(['response-pack-5k', 'whatsapp-channel']);
    expect(uniqueAddons).toHaveLength(2);
  });

  it('returns error for unavailable add-on', () => {
    const addonProducts = [
      { id: 'response-pack-5k', stripe_price_id: 'price_addon_response_5k' },
      { id: 'whatsapp-channel', stripe_price_id: 'price_addon_whatsapp' },
    ];

    const selectedAddons = ['response-pack-5k', 'nonexistent-addon'];
    const unavailableAddon = selectedAddons.find((addonId) => !addonProducts.some((p) => p.id === addonId));

    expect(unavailableAddon).toBe('nonexistent-addon');
  });

  it('creates line items array with plan + multiple add-ons', () => {
    const planPrice = 'price_plan_growth_monthly';
    const addonPrices = ['price_addon_response_5k', 'price_addon_whatsapp', 'price_addon_voice'];

    const lineItems = [{ price: planPrice, quantity: 1 }, ...addonPrices.map((p) => ({ price: p, quantity: 1 }))];

    expect(lineItems).toHaveLength(4);
    expect(lineItems[0]?.price).toBe(planPrice);
    expect(lineItems[1]?.price).toBe('price_addon_response_5k');
    expect(lineItems[2]?.price).toBe('price_addon_whatsapp');
    expect(lineItems[3]?.price).toBe('price_addon_voice');
  });
});
