import { describe, it, expect, vi } from 'vitest';
import { createModularSandboxSession } from '../../supabase/functions/_shared/modular-sandbox-session';
import { resolveModularSandboxOffer } from '../../supabase/functions/_shared/modular-sandbox-price';

describe('isolated modular checkout sandbox harness', () => {
  const input = { offerKey: 'professional', products: ['ki-bots'], requestId: 'fixture-request-12345' };
  const offer = resolveModularSandboxOffer(input.offerKey, input.products)!;
  function fixture() {
    const retrieve = vi.fn(async () => ({
      id: offer.priceId, product: offer.productId, active: true, livemode: false,
      currency: 'eur', unit_amount: 4900, tax_behavior: 'inclusive',
      recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
      metadata: { catalog: 'modular-v2', offer_key: 'professional', tax_model: 'DE_KLEINUNTERNEHMER_19' },
    }));
    const create = vi.fn(async (_params: unknown, _opts: unknown) => ({ id: 'cs_test_fixture', url: 'https://checkout.stripe.com/test', livemode: false }));
    return { prices: { retrieve }, checkout: { sessions: { create } } };
  }
  it('creates only a test subscription session with a stable idempotency key', async () => {
    const stripe = fixture();
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', input)).resolves.toMatchObject({ id: 'cs_test_fixture' });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription', automatic_tax: { enabled: false },
      line_items: [{ price: offer.priceId, quantity: 1 }],
      metadata: expect.objectContaining({ test_only: 'true', products: 'ki-bots' }),
    }), { idempotencyKey: 'modular-v2-test-fixture-request-12345' });
  });
  it('rejects live key, invalid selection and wrong price before session creation', async () => {
    const stripe = fixture();
    await expect(createModularSandboxSession(stripe, 'sk_live_fixture', input)).rejects.toThrow('SANDBOX_ONLY');
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', { ...input, products: [] })).rejects.toThrow('INVALID_OFFER');
    const p = await stripe.prices.retrieve();
    stripe.prices.retrieve.mockResolvedValue({ ...p, unit_amount: 1 });
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', input)).rejects.toThrow('PRICE_MISMATCH');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
