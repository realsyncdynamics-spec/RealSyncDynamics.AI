// Reine Hilfsfunktion (ohne Deno-/npm-Imports), damit sie auch in vitest
// geprüft werden kann.

/** Die Felder eines Stripe-Price, die für den Abgleich zählen. */
export interface StripePriceAmount {
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string; interval_count: number } | null;
}

/** Zusätzliche Felder für die planspezifische Prüfung (`checkStripePrice`). */
export interface StripePriceFacts extends StripePriceAmount {
  active: boolean;
  livemode: boolean;
  tax_behavior: string | null;
  /** Stripe liefert die Produkt-ID oder, mit `expand`, das Produktobjekt. */
  product: string | { id: string };
}

/** Die Beträge eines Plans aus der Pricing-SSoT (Euro, netto). */
export interface PlanPriceEur {
  monthlyEur: number;
  yearlyEur: number | null;
  oneTimeEur: number | null;
}

export type StripeEnvironment = 'live' | 'test';

/**
 * Was ein Plan über die Betragsprüfung hinaus in Stripe erfüllen muss.
 * Planspezifisch, weil sich Bestandstarife darin unterscheiden können
 * (z. B. Steuermodus) und eine pauschale Regel sie blockieren würde.
 */
export interface PlanStripeExpectation {
  taxBehavior: 'exclusive' | 'inclusive';
  /**
   * Stripe-Produkt je Umgebung. Nur eine im Stripe-Dashboard verifizierte ID
   * eintragen; `null` sperrt den Checkout dieses Plans in der Umgebung.
   */
  productId: Record<StripeEnvironment, string | null>;
}

/**
 * Planspezifische Stripe-Erwartungen, nach Plan-Key. Pläne ohne Eintrag
 * werden nur gegen Betrag, Währung und Intervall geprüft.
 *
 * Enterprise (Dominik 2026-10-24): 1.498 €/Monat netto, also
 * `tax_behavior=exclusive`.
 *
 * Live-Produkt-Kandidat aus Migration 20260912055500: `prod_UxG9V9clbqV7qw`.
 * Noch **nicht** gesetzt — muss zusammen mit der neuen Price-ID (149800 Cent)
 * in Stripe verifiziert werden. Siehe docs/runbooks/stripe-production-checkout.md (Abschnitt „Enterprise 1.498 €“)
 * und PR #1995. Bis dahin: PRODUCT_NOT_CONFIGURED.
 */
export const PLAN_STRIPE_EXPECTATIONS: Readonly<Record<string, PlanStripeExpectation>> = {
  enterprise: {
    taxBehavior: 'exclusive',
    // Nach Stripe-Verifikation setzen (Runbook, PR #1995), z. B.
    // productId: { live: 'prod_UxG9V9clbqV7qw', test: null },
    productId: { live: null, test: null },
  },
};

/** Umgebung aus dem Stripe-Secret-Key; `null` bei unbekanntem Format. */
export function stripeEnvironmentFromKey(key: string | null | undefined): StripeEnvironment | null {
  if (!key) return null;
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return null;
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
 *
 * Der SSoT-Betrag gilt pro einem Monat bzw. Jahr. Ein Price mit
 * `interval_count` ≠ 1 (z. B. 1.498 € alle drei Monate) passt deshalb nicht.
 */
export function stripePriceMatchesPlan(
  price: StripePriceAmount,
  plan: PlanPriceEur,
  isOneTime: boolean,
): boolean {
  if (price.currency !== 'eur' || price.unit_amount == null) return false;
  const recurring = price.recurring ?? null;
  let expectedEur: number | null;
  if (isOneTime) {
    if (recurring) return false;
    expectedEur = plan.oneTimeEur;
  } else if (!recurring || recurring.interval_count !== 1) {
    return false;
  } else if (recurring.interval === 'year') {
    expectedEur = plan.yearlyEur;
  } else if (recurring.interval === 'month') {
    expectedEur = plan.monthlyEur;
  } else {
    return false;
  }
  return expectedEur != null && price.unit_amount === Math.round(expectedEur * 100);
}

export type StripePriceCheck =
  | { ok: true }
  | {
    ok: false;
    reason:
      | 'AMOUNT_MISMATCH'
      | 'PRICE_INACTIVE'
      | 'UNKNOWN_ENVIRONMENT'
      | 'ENVIRONMENT_MISMATCH'
      | 'TAX_BEHAVIOR_MISMATCH'
      | 'PRODUCT_NOT_CONFIGURED'
      | 'PRODUCT_MISMATCH';
  };

/**
 * Vollständige Prüfung vor dem Anlegen einer Checkout-Session: Betrag (für
 * alle Pläne), aktiver Price (für alle Pläne) und — nur für Pläne mit Eintrag
 * in `expectations` — Umgebung, Steuermodus und Produkt.
 */
export function checkStripePrice(
  price: StripePriceFacts,
  plan: PlanPriceEur,
  isOneTime: boolean,
  planKey: string,
  environment: StripeEnvironment | null,
  expectations: Readonly<Record<string, PlanStripeExpectation>> = PLAN_STRIPE_EXPECTATIONS,
): StripePriceCheck {
  if (!stripePriceMatchesPlan(price, plan, isOneTime)) return { ok: false, reason: 'AMOUNT_MISMATCH' };
  if (price.active !== true) return { ok: false, reason: 'PRICE_INACTIVE' };

  const expected = Object.prototype.hasOwnProperty.call(expectations, planKey)
    ? expectations[planKey]
    : undefined;
  if (!expected) return { ok: true };

  if (!environment) return { ok: false, reason: 'UNKNOWN_ENVIRONMENT' };
  if (price.livemode !== (environment === 'live')) return { ok: false, reason: 'ENVIRONMENT_MISMATCH' };
  if (price.tax_behavior !== expected.taxBehavior) return { ok: false, reason: 'TAX_BEHAVIOR_MISMATCH' };
  const expectedProduct = expected.productId[environment];
  if (!expectedProduct) return { ok: false, reason: 'PRODUCT_NOT_CONFIGURED' };
  const productId = typeof price.product === 'string' ? price.product : price.product?.id;
  if (productId !== expectedProduct) return { ok: false, reason: 'PRODUCT_MISMATCH' };
  return { ok: true };
}
