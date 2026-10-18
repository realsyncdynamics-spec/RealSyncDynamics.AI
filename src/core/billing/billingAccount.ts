import type { SubscriptionSnapshot } from './types';

/**
 * Welche Art Vertragsverhältnis hinter der Abo-Zeile eines Mandanten steht.
 *
 * Grundlage für Hinweise wie „keine Zahlungsdaten nötig“: Die gelten nur für
 * Mandanten, die der Server wirklich in die Beta aufgenommen hat
 * (`subscriptions.source = 'beta'`, gesetzt von `beta-enroll`) — nicht für
 * alle, solange der Build-Schalter `VITE_BETA_PHASE` an ist.
 *
 * - `stripe`: Stripe-Abo (auch in Stripes Testphase). Hat Vorrang vor
 *   `source`, weil `stripe-webhook` dieselbe Zeile schreibt und `source`
 *   stehen lässt, wenn ein Beta-Mandant kauft.
 * - `beta`: Beta-Zugang ohne Stripe-Abo.
 * - `trial`: kartenlose Testphase (`create-trial-subscription`).
 * - `other`: freie Stufe, manuell vergebenes Abo oder keine Zeile.
 */
export type BillingAccountKind = 'stripe' | 'beta' | 'trial' | 'other';

/** Kennzeichen in `subscriptions.source` (Spiegel von `BETA_SOURCE` in beta-enroll). */
export const BETA_SUBSCRIPTION_SOURCE = 'beta';

export function classifyBillingAccount(
  sub: Pick<SubscriptionSnapshot, 'subscriptionId' | 'status' | 'source'> | null | undefined,
): BillingAccountKind {
  if (!sub) return 'other';
  if (sub.subscriptionId) return 'stripe';
  if (sub.source === BETA_SUBSCRIPTION_SOURCE) return 'beta';
  if (sub.status === 'trialing') return 'trial';
  return 'other';
}
