import { describe, it, expect, vi } from 'vitest';
import { createModularSandboxSession } from '../../supabase/functions/_shared/modular-sandbox-session';
import { resolveModularSandboxOffer } from '../../supabase/functions/_shared/modular-sandbox-price';

describe('isolated modular checkout sandbox harness', () => {
  const preview = 'https://fixture-preview.pages.dev';
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
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', input, preview)).resolves.toMatchObject({ id: 'cs_test_fixture' });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription', automatic_tax: { enabled: false },
      success_url: preview + '/pricing?preview=modular-v2&test=success',
      cancel_url: preview + '/pricing?preview=modular-v2&test=cancelled',
      line_items: [{ price: offer.priceId, quantity: 1 }],
      metadata: expect.objectContaining({ test_only: 'true', products: 'ki-bots' }),
    }), { idempotencyKey: 'modular-v2-test-fixture-request-12345' });
  });
  it('rejects missing or unsafe return origins before Stripe calls', async () => {
    const stripe = fixture();
    for (const origin of ['', 'http://localhost:4173', 'https://realsyncdynamicsai.de', 'https://fixture.pages.dev.evil.example', 'https://fixture.pages.dev/path']) {
      await expect(createModularSandboxSession(stripe, 'sk_test_fixture', input, origin)).rejects.toThrow(/PREVIEW_ORIGIN/);
    }
    expect(stripe.prices.retrieve).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it('rejects live key, invalid selection and wrong price before session creation', async () => {
    const stripe = fixture();
    await expect(createModularSandboxSession(stripe, 'sk_live_fixture', input, preview)).rejects.toThrow('SANDBOX_ONLY');
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', { ...input, products: [] }, preview)).rejects.toThrow('INVALID_OFFER');
    const p = await stripe.prices.retrieve();
    stripe.prices.retrieve.mockResolvedValue({ ...p, unit_amount: 1 });
    await expect(createModularSandboxSession(stripe, 'sk_test_fixture', input, preview)).rejects.toThrow('PRICE_MISMATCH');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
