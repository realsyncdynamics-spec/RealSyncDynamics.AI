import { describe, expect, it } from 'vitest';
import { stripeTestAddonPrice } from '@/shared/pricing';

describe('stripeTestAddonPrice', () => {
  it('nimmt eine Test-Price nur mit sk_test_', () => {
    const env = { STRIPE_PRICE_ADDON_ADDITIONAL_DOMAIN: 'price_test_domain' };
    expect(stripeTestAddonPrice('additional_domain', 'sk_test_123', env)).toBe('price_test_domain');
    expect(stripeTestAddonPrice('additional_domain', 'sk_live_123', env)).toBeNull();
    expect(stripeTestAddonPrice('additional_domain', 'sk_test_123', { STRIPE_PRICE_ADDON_ADDITIONAL_DOMAIN: 'not-a-price' })).toBeNull();
  });
});
