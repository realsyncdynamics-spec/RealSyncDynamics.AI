/**
 * @file checkout.ts
 * @description Maps commercial package state to Stripe and subscription lifecycle handling.
 * Imports only the stable package contract.
 */

import { PlanKey, PLANS } from './pricing';

export interface CheckoutSessionParams {
  planKey: PlanKey;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface RevenueSplit {
  creatorShare: number;
  platformShare: number;
  processingShare: number;
  grossAmount: number;
}

/**
 * Resolves a Stripe Product ID back to our internal PlanKey.
 */
export function resolveProductToPlan(stripeProductId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.stripeProductId === stripeProductId) {
      return key as PlanKey;
    }
  }
  return null;
}

/**
 * Attaches the standard revenue split policy (85% creator, 12% platform, 3% processing).
 */
export function attachRevenueSplitPolicy(grossAmount: number): RevenueSplit {
  return {
    grossAmount,
    creatorShare: grossAmount * 0.85,
    platformShare: grossAmount * 0.12,
    processingShare: grossAmount * 0.03,
  };
}

/**
 * Normalizes a Stripe subscription object into our internal platform state.
 */
export function normalizeSubscriptionState(stripeSubscription: any) {
  const productId = stripeSubscription.items?.data[0]?.price?.product;
  const planKey = resolveProductToPlan(productId) || 'gratis';
  
  return {
    subscriptionId: stripeSubscription.id,
    status: stripeSubscription.status, // e.g., 'active', 'past_due', 'canceled'
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    planKey,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };
}

/**
 * Generates the payload required to create a Stripe Checkout Session.
 * (Actual Stripe SDK call should happen in the API route using this payload).
 */
export function buildCheckoutSessionPayload(params: CheckoutSessionParams) {
  const plan = PLANS[params.planKey];
  
  if (!plan) {
    throw new Error(`Invalid plan key: ${params.planKey}`);
  }

  return {
    payment_method_types: ['card', 'sepa_debit', 'paypal'],
    line_items: [
      {
        price_data: {
          product: plan.stripeProductId,
          // Price would typically be fetched from a price registry or Stripe directly
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.userId,
    metadata: {
      planKey: params.planKey,
      complianceTier: plan.complianceTier
    }
  };
}
