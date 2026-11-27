import { describe, it, expect } from 'vitest';
import { resolveModularSandboxOffer, validateModularSandboxPrice, type ModularSandboxPrice } from '../../supabase/functions/_shared/modular-sandbox-price';

describe('modular sandbox checkout validation', () => {
  const offer = resolveModularSandboxOffer('professional', ['ki-bots'])!;
  const price: ModularSandboxPrice = {
    id: offer.priceId, product: offer.productId, active: true, livemode: false,
    currency: 'eur', unit_amount: 4900, tax_behavior: 'inclusive',
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    metadata: { catalog: 'modular-v2', offer_key: 'professional', tax_model: 'DE_KLEINUNTERNEHMER_19' },
  };
  const valid = (p: ModularSandboxPrice = price, secret = 'sk_test_fixture') =>
    validateModularSandboxPrice(secret, 'professional', ['ki-bots'], p);
  it('matches the sandbox price', () => expect(valid()).toBe(true));
  it('rejects live keys and live price objects', () => {
    expect(valid(price, 'sk_live_fixture')).toBe(false);
    expect(valid({ ...price, livemode: true })).toBe(false);
  });
  it('rejects incorrect amounts, products, IDs, currency, tax or interval', () => {
    for (const patch of [
      { unit_amount: 1 }, { product: 'wrong' }, { id: 'wrong' }, { currency: 'usd' },
      { tax_behavior: 'exclusive' }, { active: false }, { recurring: null },
      { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
      { metadata: {} },
    ]) expect(valid({ ...price, ...patch })).toBe(false);
  });
  it('rejects invalid selection, free and unknown offers', () => {
    expect(resolveModularSandboxOffer('starter', [])).toBeNull();
    expect(resolveModularSandboxOffer('growth', ['ki-bots', 'ki-bots'])).toBeNull();
    expect(resolveModularSandboxOffer('agency', ['ki-bots'])).toBeNull();
    expect(resolveModularSandboxOffer('__proto__', [])).toBeNull();
    expect(resolveModularSandboxOffer('app-builder', ['ki-bots'])).toBeNull();
    expect(resolveModularSandboxOffer('claude-code-optimizer', ['claude-code-optimizer'])?.amountCents).toBe(2900);
  });
});
