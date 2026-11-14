/**
 * SaaS webhook's fail-closed Checkout product-line gate. Called only after Stripe
 * verifies the signature and the server retrieves Session + ALL line items.
 * This module must not import MOON order processing or supplier code.
 */
export const MOON_PRODUCT_ID = 'prod_VXiTuIuISpw59Z';
export const MOON_PRICE_ID = 'price_1UWd2qIEauIvbZDCbEqrrt5G';

export type ProductLineRoute = 'saas' | 'hardware_ignore' | 'quarantine';
export type CheckoutRouteSession = {
  mode?: string | null;
  metadata?: Record<string, string> | null;
};
export type CheckoutRouteLineItem = {
  price?: { id?: string; product?: string | { id: string } | null } | null;
};

/** A missing legacy product_line is accepted ONLY for catalog-allowlisted SaaS. */
export function routeCheckoutProductLine(
  session: CheckoutRouteSession,
  lineItems: readonly CheckoutRouteLineItem[],
  hasMore: boolean,
  approvedSaasPrices: ReadonlySet<string>,
): ProductLineRoute {
  if (hasMore || lineItems.length === 0) return 'quarantine';
  const prices: string[] = [];
  let hardwareCount = 0;
  for (const line of lineItems) {
    const price = line.price;
    const productId = typeof price?.product === 'string' ? price.product : price?.product?.id;
    if (!price?.id || !productId) return 'quarantine';
    prices.push(price.id);
    if (price.id === MOON_PRICE_ID || productId === MOON_PRODUCT_ID) {
      // Any mismatch or mixed basket is never eligible for SaaS or MOON.
      if (price.id !== MOON_PRICE_ID || productId !== MOON_PRODUCT_ID) return 'quarantine';
      hardwareCount++;
    }
  }
  const productLine = session.metadata?.product_line;
  if (hardwareCount > 0) {
    if (hardwareCount !== 1 || lineItems.length !== 1 || session.mode !== 'payment') return 'quarantine';
    // Older Payment Links need not carry product_line, but a conflicting marker
    // is evidence of an invalid checkout, not a SaaS license.
    if (productLine && productLine !== 'hardware_mobility') return 'quarantine';
    return 'hardware_ignore';
  }
  if (productLine === 'hardware_mobility') return 'quarantine';
  if (productLine && productLine !== 'saas_governance') return 'quarantine';
  if (session.mode !== 'payment' && session.mode !== 'subscription') return 'quarantine';
  if (!session.metadata?.tenant_id) return 'quarantine';
  // All line items, including subscription add-ons, must be explicitly allowed.
  if (approvedSaasPrices.size === 0 || prices.some((p) => !approvedSaasPrices.has(p))) {
    return 'quarantine';
  }
  return 'saas';
}
