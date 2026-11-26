import { resolveModularSandboxOffer, validateModularSandboxPrice, type ModularSandboxPrice } from './modular-sandbox-price.ts';
import { checkoutTaxParams } from './checkout-tax.ts';

interface SandboxStripe {
  prices: { retrieve(id: string): Promise<ModularSandboxPrice> };
  checkout: { sessions: { create(params: SandboxSessionParams, options: { idempotencyKey: string }): Promise<{ id: string; url: string | null; livemode: boolean }> } };
}
type SandboxSessionParams = {
  mode: 'subscription';
  line_items: { price: string; quantity: 1 }[];
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  subscription_data: { metadata: Record<string, string> };
} & ReturnType<typeof checkoutTaxParams>;

export interface SandboxCheckoutInput {
  offerKey: string;
  products: readonly string[];
  /** Server-generated stable test request identifier, never a customer or tenant ID. */
  requestId: string;
}

/** Isolated operator-only test harness. Not an HTTP endpoint or a live checkout.
 * The caller must supply the sandbox client and its test key from the same trusted configuration.
 * No tenant/customer metadata: the legacy webhook must not provision these sessions.
 */
export async function createModularSandboxSession(stripe: SandboxStripe, secret: string, input: SandboxCheckoutInput) {
  if (!/^(sk|rk)_test_/.test(secret)) throw new Error('SANDBOX_ONLY');
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(input.requestId)) throw new Error('INVALID_TEST_REQUEST');
  const offer = resolveModularSandboxOffer(input.offerKey, input.products);
  if (!offer) throw new Error('INVALID_OFFER');
  const price = await stripe.prices.retrieve(offer.priceId);
  if (!validateModularSandboxPrice(secret, input.offerKey, input.products, price)) throw new Error('PRICE_MISMATCH');
  const metadata = { catalog: 'modular-v2', test_only: 'true', offer_key: offer.key, products: [...input.products].sort().join(',') };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: offer.priceId, quantity: 1 }],
    success_url: 'http://localhost:4173/pricing?preview=modular-v2&test=success',
    cancel_url: 'http://localhost:4173/pricing?preview=modular-v2&test=cancelled',
    metadata,
    subscription_data: { metadata },
    ...checkoutTaxParams({ sessionMode: 'subscription', existingCustomer: false, taxMode: 'EXEMPT', submitPrefix: 'Sandbox-Test. Keine echte Zahlung.' }),
  }, { idempotencyKey: 'modular-v2-test-' + input.requestId });
  if (session.livemode !== false || !session.id.startsWith('cs_test_') || !session.url) throw new Error('INVALID_SANDBOX_SESSION');
  return { id: session.id, url: session.url };
}
