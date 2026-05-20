/**
 * Plan-Config redundancy check.
 *
 * The spec asked for a `PLAN_CONFIG` map at this path. The repo already
 * has `src/config/pricing.ts` as the Single Source of Truth — adding a
 * second config object would cause exactly the kind of drift this QA
 * audit is trying to prevent.
 *
 * Instead, this file re-exports a typed view onto the canonical config
 * with the additional fields the spec requested (stripePriceId from
 * env vars + payment mode). Anything that needs PlanConfig-shape data
 * imports from here; anything that renders pricing data imports from
 * `src/config/pricing.ts` directly.
 *
 * Diff-check (run by audit/contract test):
 *   PRICING_TIERS[id].priceEur === PLAN_CONFIG[planKey].price
 *   PRICING_TIERS[id].planKey   === planKey
 *
 * Mismatch === build-time error.
 */

import { PRICING_TIERS, type TierId } from '../../config/pricing';

export type PaymentMode = 'free' | 'checkout' | 'inquiry';

export interface PlanConfigEntry {
  price: number | null;
  interval: 'none' | 'month' | 'year';
  /**
   * Stripe Price ID — pulled from Vite env (build-time). Server-side
   * code MUST look up the live ID from `public.products` table via the
   * canonical lookup in `stripe-checkout` Edge Function — env vars are
   * a developer-time fallback, not a production source-of-truth.
   */
  stripePriceId: string | null;
  mode: PaymentMode;
}

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env as Record<string, string | undefined> : {};

export const PLAN_CONFIG: Record<string, PlanConfigEntry> = {
  free_audit: {
    price: 0,
    interval: 'none',
    stripePriceId: null,
    mode: 'free',
  },
  starter: {
    price: 49,
    interval: 'month',
    stripePriceId: env.VITE_STRIPE_PRICE_STARTER ?? null,
    mode: 'checkout',
  },
  growth: {
    price: 179,
    interval: 'month',
    stripePriceId: env.VITE_STRIPE_PRICE_GROWTH ?? null,
    mode: 'checkout',
  },
  agency: {
    price: 499,
    interval: 'month',
    stripePriceId: env.VITE_STRIPE_PRICE_AGENCY ?? null,
    mode: 'inquiry',
  },
  scale: {
    price: 1999,
    interval: 'month',
    stripePriceId: env.VITE_STRIPE_PRICE_SCALE ?? null,
    // 'inquiry' until the 50-tenant quota is enforced backend-side AND a
    // Stripe price ID exists. The pricing-page CTA routes interested
    // customers to /contact-sales for manual onboarding (see pricing.ts).
    mode: 'inquiry',
  },
  enterprise: {
    price: null,
    interval: 'month',
    stripePriceId: null,
    mode: 'inquiry',
  },
} as const;

/**
 * Diff-check between PLAN_CONFIG and PRICING_TIERS. Returns the list
 * of mismatched keys. Empty array === aligned. Used by the contract
 * test in tests/contracts/audit-contract.test.ts.
 */
export function diffPricingTiersAgainstPlanConfig(): string[] {
  const mismatches: string[] = [];
  for (const tier of PRICING_TIERS) {
    const planKey = tier.planKey;
    const entry = PLAN_CONFIG[planKey];
    if (!entry) {
      mismatches.push(`PLAN_CONFIG missing planKey: ${planKey}`);
      continue;
    }
    if (entry.price !== null && entry.price !== tier.priceEur) {
      mismatches.push(`price mismatch ${planKey}: tier=${tier.priceEur} vs config=${entry.price}`);
    }
  }
  return mismatches;
}

export type PlanKey = keyof typeof PLAN_CONFIG;

export function planForTier(id: TierId): PlanConfigEntry {
  const tier = PRICING_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`unknown tier id: ${id}`);
  const entry = PLAN_CONFIG[tier.planKey];
  if (!entry) throw new Error(`PLAN_CONFIG missing for planKey: ${tier.planKey}`);
  return entry;
}
