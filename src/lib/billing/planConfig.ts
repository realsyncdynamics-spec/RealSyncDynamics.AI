/**
 * PlanConfig — Billing-Sicht auf die Pricing-SSoT.
 *
 * ⚠️  Diese Datei enthält KEINE eigenen Preise. Sie berechnet ihre Einträge
 *     aus `shared/pricing.ts` und ergänzt nur die beiden Dinge, die im
 *     Preismodell selbst nichts zu suchen haben:
 *       - das Abrechnungsintervall je Plan-Key
 *       - die Zahlungsart (checkout / inquiry / free)
 *
 * Stripe-Price-IDs stehen bewusst NICHT hier. Der Checkout löst sie
 * serverseitig aus `public.products.default_for_plan_key` auf
 * (siehe supabase/functions/stripe-checkout). Ein Frontend-Mapping wäre
 * eine zweite Preisautorität und ist deshalb entfallen.
 */

import {
  PLANS,
  allPlanKeys,
  intervalForPlanKey,
  planByKey,
  priceForPlanKey,
  type BillingInterval,
  type PlanId,
  type PlanKey,
  type PurchaseMode,
} from '@/shared/pricing';

export type PaymentMode = PurchaseMode;

export interface PlanConfigEntry {
  /** Preis in Euro für genau diesen Plan-Key (monatlich oder jährlich). */
  price: number;
  interval: BillingInterval;
  mode: PaymentMode;
}

/**
 * Plan-Key → Abrechnungsdaten. Vollständig aus der SSoT berechnet,
 * inklusive aller Jahresvarianten.
 */
export const PLAN_CONFIG: Record<PlanKey, PlanConfigEntry> = allPlanKeys().reduce(
  (acc, key) => {
    const plan = planByKey(key)!;
    acc[key] = {
      price: priceForPlanKey(key) ?? 0,
      interval: intervalForPlanKey(key),
      mode: plan.purchaseMode,
    };
    return acc;
  },
  {} as Record<PlanKey, PlanConfigEntry>,
);

export type { PlanKey };

/** Abrechnungsdaten für eine Plan-ID (Monatsvariante). */
export function planForTier(id: PlanId): PlanConfigEntry {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`unknown plan id: ${id}`);
  return PLAN_CONFIG[plan.planKey];
}

/**
 * Konsistenzprüfung: jeder Plan-Key der SSoT muss in PLAN_CONFIG mit
 * identischem Preis auftauchen. Da beide aus derselben Quelle berechnet
 * werden, kann das nur fehlschlagen, wenn jemand PLAN_CONFIG von Hand
 * überschreibt. Genau davor schützt der Contract-Test.
 */
export function diffPricingTiersAgainstPlanConfig(): string[] {
  const mismatches: string[] = [];
  for (const key of allPlanKeys()) {
    const entry = PLAN_CONFIG[key];
    if (!entry) {
      mismatches.push(`PLAN_CONFIG missing planKey: ${key}`);
      continue;
    }
    const expected = priceForPlanKey(key);
    if (expected !== null && entry.price !== expected) {
      mismatches.push(`price mismatch ${key}: ssot=${expected} vs config=${entry.price}`);
    }
  }
  return mismatches;
}
