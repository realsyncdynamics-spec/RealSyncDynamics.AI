import { describe, expect, it, vi } from 'vitest';
import { verifyModularSandboxReceipt, type SandboxReceiptSession } from '../../supabase/functions/_shared/modular-sandbox-receipt';
import { resolveModularSandboxOffer, type ModularSandboxPrice } from '../../supabase/functions/_shared/modular-sandbox-price';

describe('modular sandbox payment readback', () => {
  const id = 'cs_test_fixture123';
  const offer = resolveModularSandboxOffer('professional', ['ki-bots'])!;
  const price: ModularSandboxPrice = {
    id: offer.priceId, product: offer.productId, active: true, livemode: false,
    currency: 'eur', unit_amount: 4900, tax_behavior: 'inclusive',
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
    metadata: { catalog: 'modular-v2', offer_key: 'professional', tax_model: 'DE_KLEINUNTERNEHMER_19' },
  };
  const session: SandboxReceiptSession = {
    id, livemode: false, status: 'complete', payment_status: 'paid', mode: 'subscription',
    currency: 'eur', amount_total: 4900, total_details: { amount_tax: 0, amount_discount: 0 },
    metadata: { catalog: 'modular-v2', test_only: 'true', offer_key: 'professional', products: 'ki-bots' },
    subscription: 'sub_fixture', invoice: 'in_fixture', customer_details: { address: { country: 'DE' } },
  };
  function fixture(patch: Partial<SandboxReceiptSession> = {}, linePrice = price) {
    return { checkout: { sessions: {
      retrieve: vi.fn(async () => ({ ...session, ...patch })),
      listLineItems: vi.fn(async () => ({ data: [{ price: linePrice, quantity: 1 }], has_more: false })),
    } } };
  }
  it('verifies readback without granting access', async () => {
    await expect(verifyModularSandboxReceipt(fixture(), 'sk_test_fixture', id)).resolves.toMatchObject({ verified: true, grantsAccess: false, amountCents: 4900 });
  });
  it('blocks live credentials before readback', async () => {
    const stripe = fixture();
    await expect(verifyModularSandboxReceipt(stripe, 'sk_live_fixture', id)).rejects.toThrow('SANDBOX_ONLY');
    expect(stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
  it('rejects unpaid, wrong tax, wrong country, wrong amount and missing invoice', async () => {
    for (const patch of [
      { payment_status: 'unpaid' }, { livemode: true }, { amount_total: 1 },
      { total_details: { amount_tax: 1, amount_discount: 0 } },
      { customer_details: { address: { country: 'US' } } }, { invoice: null },
    ]) await expect(verifyModularSandboxReceipt(fixture(patch), 'sk_test_fixture', id)).rejects.toThrow();
  });
  it('rejects different price IDs even when the amount matches', async () => {
    await expect(verifyModularSandboxReceipt(fixture({}, { ...price, id: 'price_wrong' }), 'sk_test_fixture', id)).rejects.toThrow('LINE_ITEM_MISMATCH');
  });
});
