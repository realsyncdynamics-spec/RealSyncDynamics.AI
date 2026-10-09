/**
 * Stripe-Modus im Frontend (Beta: Testmodus / Sandbox).
 *
 * `VITE_STRIPE_MODE` = 'live' schaltet Live frei — jeder andere Wert und ein
 * fehlender Wert bedeuten 'test'. Server-seitig gilt dasselbe über das
 * Supabase-Secret `STRIPE_MODE` (supabase/functions/_shared/stripe-mode.ts);
 * maßgeblich für echte Abbuchungen ist ausschließlich der Server.
 *
 * Im Frontend liegen KEINE Secrets und KEINE Price-IDs (die löst die Edge
 * Function auf). Hier wird nur verhindert, dass im Testmodus ein Live-
 * Publishable-Key oder ein Live-Payment-Link ausgeliefert wird.
 * Setup: docs/STRIPE_SANDBOX_SETUP.md
 */

export type StripeMode = 'test' | 'live';

export const STRIPE_MODE: StripeMode =
  (import.meta.env.VITE_STRIPE_MODE as string | undefined) === 'live' ? 'live' : 'test';

export const IS_STRIPE_TEST_MODE = STRIPE_MODE === 'test';

/** Publishable Key nur, wenn sein Präfix zum Modus passt (pk_test_ ↔ test). */
export function publishableKeyForMode(key: string | undefined, mode: StripeMode = STRIPE_MODE): string {
  const k = (key ?? '').trim();
  if (!k) return '';
  return k.startsWith(mode === 'test' ? 'pk_test_' : 'pk_live_') ? k : '';
}

/**
 * Stripe Payment Link nur im passenden Modus. Test-Links haben die Form
 * `https://buy.stripe.com/test_…`; im Testmodus fällt ein Live-Link auf
 * `fallback` (interner Checkout, der über die Edge Function läuft) zurück.
 */
export function paymentLinkForMode(
  link: string | undefined,
  fallback: string,
  mode: StripeMode = STRIPE_MODE,
): string {
  const l = (link ?? '').trim();
  if (!l) return fallback;
  const isTestLink = l.startsWith('https://buy.stripe.com/test_');
  return (mode === 'test') === isTestLink ? l : fallback;
}
