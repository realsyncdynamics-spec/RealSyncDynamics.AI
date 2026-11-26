import { resolveModularSandboxOffer, validateModularSandboxPrice, type ModularSandboxPrice } from './modular-sandbox-price.ts';

export interface SandboxReceiptSession {
  id: string;
  livemode: boolean;
  status: string | null;
  payment_status: string;
  mode: string;
  currency: string | null;
  amount_total: number | null;
  total_details: { amount_tax: number; amount_discount: number } | null;
  metadata: Record<string, string> | null;
  subscription: string | null;
  invoice: string | null;
  customer_details?: { address?: { country?: string | null } | null } | null;
}
interface SandboxReceiptStripe {
  checkout: { sessions: {
    retrieve(id: string): Promise<SandboxReceiptSession>;
    listLineItems(id: string, params: { limit: number }): Promise<{ data: { price: ModularSandboxPrice | null; quantity: number | null }[]; has_more: boolean }>;
  } };
}

/** Operator-only readback. Never accepts browser payment claims and never grants access.
 * Stripe client and secret must originate from the same trusted sandbox configuration.
 * A verified receipt is evidence for testing, NOT an authorization for a real tenant.
 */
export async function verifyModularSandboxReceipt(stripe: SandboxReceiptStripe, secret: string, sessionId: string) {
  if (!/^(sk|rk)_test_/.test(secret) || !/^cs_test_[a-zA-Z0-9]+$/.test(sessionId)) throw new Error('SANDBOX_ONLY');
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const meta = session.metadata;
  if (session.id !== sessionId || session.livemode !== false || meta?.catalog !== 'modular-v2' || meta.test_only !== 'true') throw new Error('SESSION_MISMATCH');
  if (session.status !== 'complete' || session.payment_status !== 'paid' || session.mode !== 'subscription') throw new Error('PAYMENT_NOT_CONFIRMED');
  const products = (meta.products ?? '').split(',').filter(Boolean);
  const offer = resolveModularSandboxOffer(meta.offer_key ?? '', products);
  if (!offer || session.currency !== 'eur' || session.amount_total !== offer.amountCents ||
      session.total_details?.amount_tax !== 0 || session.total_details?.amount_discount !== 0 ||
      session.customer_details?.address?.country !== 'DE' ||
      !session.subscription?.startsWith('sub_') || !session.invoice?.startsWith('in_')) throw new Error('RECEIPT_MISMATCH');
  const lines = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 2 });
  const line = lines.data[0];
  if (lines.has_more || lines.data.length !== 1 || line.quantity !== 1 || !line.price ||
      !validateModularSandboxPrice(secret, offer.key, products, line.price)) throw new Error('LINE_ITEM_MISMATCH');
  return { verified: true as const, sandbox: true as const, sessionId, subscriptionId: session.subscription, invoiceId: session.invoice, amountCents: offer.amountCents, offerKey: offer.key, products, grantsAccess: false as const };
}
