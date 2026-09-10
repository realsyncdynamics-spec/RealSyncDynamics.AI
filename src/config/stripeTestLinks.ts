/**
 * Stripe-Test-Payment-Links (Sandbox) für die Paket-CTAs.
 *
 * Zweck: Testkäufe auf realsyncdynamicsai.de durchspielen, ohne den
 * regulären Checkout-Pfad (`/checkout/<planKey>` → Edge Function
 * `stripe-checkout`) anzufassen.
 *
 * Aktivierung ausschließlich per Env — ohne `VITE_STRIPE_TEST_LINKS=true`
 * verhält sich die Anwendung exakt wie vorher:
 *
 *   VITE_STRIPE_TEST_LINKS=true
 *   VITE_STRIPE_TEST_LINK_STARTER=https://buy.stripe.com/test_...
 *   VITE_STRIPE_TEST_LINK_GROWTH=https://buy.stripe.com/test_...
 *   VITE_STRIPE_TEST_LINK_AGENCY=https://buy.stripe.com/test_...
 *
 * Es werden nur Monats-Pläne überschrieben; für Jahres-Varianten
 * existieren keine Test-Links, dort bleibt der normale Checkout aktiv.
 */

import type { PlanKey } from '@/shared/pricing';

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

/** Nur `true` schaltet die Test-Links scharf. */
export const STRIPE_TEST_LINKS_ENABLED = env.VITE_STRIPE_TEST_LINKS === 'true';

/** Zuordnung Plan-Key → Env-Variable mit dem Test-Payment-Link. */
const TEST_LINK_ENV_BY_PLAN_KEY: Partial<Record<PlanKey, string>> = {
  starter: 'VITE_STRIPE_TEST_LINK_STARTER',
  growth: 'VITE_STRIPE_TEST_LINK_GROWTH',
  agency: 'VITE_STRIPE_TEST_LINK_AGENCY',
};

/** Nur echte Stripe-Test-Links zulassen — kein offener Redirect. */
function isStripeTestLink(value: string): boolean {
  return /^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+$/.test(value.trim());
}

/**
 * Test-Payment-Link für einen Plan-Key, sonst `null`.
 * `null` bedeutet: regulären Checkout-Pfad verwenden.
 */
export function stripeTestLinkFor(planKey: PlanKey): string | null {
  if (!STRIPE_TEST_LINKS_ENABLED) return null;
  const envName = TEST_LINK_ENV_BY_PLAN_KEY[planKey];
  if (!envName) return null;
  const value = env[envName];
  if (!value || !isStripeTestLink(value)) return null;
  return value.trim();
}
