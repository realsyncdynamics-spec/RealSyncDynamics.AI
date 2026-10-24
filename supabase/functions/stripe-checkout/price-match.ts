// Reine Hilfsfunktion (ohne Deno-/npm-Imports), damit sie auch in vitest
// geprüft werden kann.

/** Die Felder eines Stripe-Price, die für den Abgleich zählen. */
export interface StripePriceAmount {
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string } | null;
}

/** Die Beträge eines Plans aus der Pricing-SSoT (Euro, netto). */
export interface PlanPriceEur {
  monthlyEur: number;
  yearlyEur: number | null;
  oneTimeEur: number | null;
}

/**
 * Prüft, ob der Stripe-Price genau den Betrag abrechnet, den die Pricing-SSoT
 * öffentlich nennt.
 *
 * Warum: Die Price-ID kommt aus `public.products`, der angezeigte Betrag aus
 * `shared/pricing.ts`. Beides wird getrennt ausgerollt (Migration vs.
 * Frontend/Edge-Deploy). Beim Enterprise-Wechsel 1.249 € → 1.498 € stand die
 * alte Price-ID noch in `products`, während die Seite schon 1.498 € zeigte —
 * ohne diese Prüfung hätte der Checkout still den alten Betrag abgerechnet.
 * Lieber kein Checkout als ein anderer Betrag als der angezeigte.
 */
export function stripePriceMatchesPlan(
  price: StripePriceAmount,
  plan: PlanPriceEur,
  isOneTime: boolean,
): boolean {
  if (price.currency !== 'eur' || price.unit_amount == null) return false;
  let expectedEur: number | null;
  if (isOneTime) {
    if (price.recurring) return false;
    expectedEur = plan.oneTimeEur;
  } else if (price.recurring?.interval === 'year') {
    expectedEur = plan.yearlyEur;
  } else if (price.recurring?.interval === 'month') {
    expectedEur = plan.monthlyEur;
  } else {
    return false;
  }
  return expectedEur != null && price.unit_amount === Math.round(expectedEur * 100);
}
