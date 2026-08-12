import PostStripeSuccess from '../../pages/PostStripeSuccess';

/**
 * Canonical Stripe success handoff.
 *
 * The old success screen only inspected subscriptions and therefore could not
 * complete one-time purchases backed by entitlement_grants. All checkout
 * success traffic now goes through the same server-authoritative handoff used
 * by subscription and one-time website-transformation purchases.
 */
export function CheckoutSuccessPage() {
  return <PostStripeSuccess />;
}

export default CheckoutSuccessPage;
