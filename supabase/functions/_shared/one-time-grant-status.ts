/**
 * Status eines Einmalkauf-Grants (`entitlement_grants`, source
 * `one_time_purchase`) aus dem auslösenden Stripe-Event ableiten.
 *
 * Hintergrund: Bei asynchronen Zahlarten (SEPA-Lastschrift u. a.) meldet
 * `checkout.session.completed` noch `payment_status = 'unpaid'`. Der Grant
 * wird dann als `revoked` angelegt. Erst `checkout.session.async_payment_succeeded`
 * bestätigt den Zahlungseingang, `checkout.session.async_payment_failed` den
 * Ausfall. Ohne Handler für diese beiden Events blieb ein per Lastschrift
 * bezahlter Kauf dauerhaft `revoked`.
 *
 * Reihenfolge: Stripe garantiert keine Zustellreihenfolge. Ein Retry von
 * `checkout.session.completed` (Payload-Stand `unpaid`) kann nach
 * `async_payment_succeeded` eintreffen. Er darf einen bereits aktiven Grant
 * nicht wieder entziehen — daher `keepExisting`.
 *
 * Reine Funktion ohne Deno-/Supabase-Abhängigkeit, damit Vitest sie direkt
 * prüfen kann.
 */

export type OneTimeGrantTrigger =
  | 'checkout.session.completed'
  | 'checkout.session.async_payment_succeeded'
  | 'checkout.session.async_payment_failed';

export type GrantStatus = 'active' | 'revoked';

export type OneTimeGrantDecision =
  | { keepExisting: true }
  | { keepExisting: false; status: GrantStatus; revokedReason: string | null };

export function isOneTimeGrantTrigger(type: string): type is OneTimeGrantTrigger {
  return (
    type === 'checkout.session.completed' ||
    type === 'checkout.session.async_payment_succeeded' ||
    type === 'checkout.session.async_payment_failed'
  );
}

/**
 * @param trigger        auslösender Event-Typ
 * @param paymentStatus  `session.payment_status` aus dem Event-Payload
 * @param existingStatus Status eines bereits gespeicherten Grants zu derselben
 *                       Checkout-Session, sonst `null`
 */
export function decideOneTimeGrantStatus(
  trigger: OneTimeGrantTrigger,
  paymentStatus: string | null | undefined,
  existingStatus: string | null | undefined,
): OneTimeGrantDecision {
  // Ausfall der Zahlung ist endgültig: Grant entziehen, auch wenn er aktiv war.
  if (trigger === 'checkout.session.async_payment_failed') {
    return { keepExisting: false, status: 'revoked', revokedReason: 'async_payment_failed' };
  }

  if (paymentStatus === 'paid') {
    return { keepExisting: false, status: 'active', revokedReason: null };
  }

  // Unbezahlter Stand aus einem (ggf. verspäteten) `completed`-Event darf
  // einen schon bestätigten Kauf nicht zurücksetzen.
  if (existingStatus === 'active') {
    return { keepExisting: true };
  }

  return {
    keepExisting: false,
    status: 'revoked',
    revokedReason: `payment_status=${paymentStatus ?? 'unknown'}`,
  };
}
