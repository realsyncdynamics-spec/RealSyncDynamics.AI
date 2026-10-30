/**
 * Öffentliche, unverbindliche Tarifkonfiguration.
 * Preise, Add-ons und Mengenlimits werden ausschließlich aus der Pricing-SSoT gelesen.
 * Diese Funktionen buchen nichts und ersetzen NICHT die serverseitige
 * Stripe-Preisauflösung / Add-on-Berechtigungsprüfung.
 */
import { ADDONS, PLANS, type AddOn, type AddOnId, type Plan } from '@/shared/pricing';

export const CONFIGURABLE_PLANS: Plan[] = PLANS.filter(
  (plan) => plan.availability === 'self_service' && plan.purchaseMode === 'checkout',
);

/**
 * availableFor beschreibt das Neukundenangebot, plan.addons die
 * tatsächliche Planbeziehung. Beide Bedingungen sind notwendig.
 * Die wirksame Buchbarkeit wird erst serverseitig geprüft.
 */
export function offeredAddonsForPlan(plan: Plan): AddOn[] {
  return ADDONS.filter(
    (addon) => addon.availableFor.includes(plan.id) && plan.addons.includes(addon.id),
  );
}

export interface PlanQuote {
  baseMonthlyEur: number;
  addonsMonthlyEur: number;
  totalMonthlyEur: number;
  addons: AddOn[];
}

/** Listenpreis-Szenario — KEIN Stripe-Angebot und keine Checkout-Positionen. */
export function estimateMonthlyQuote(plan: Plan, requested: readonly AddOnId[]): PlanQuote {
  const selected = new Set(requested);
  const addons = offeredAddonsForPlan(plan).filter((addon) => selected.has(addon.id));
  const addonsMonthlyEur = addons.reduce((sum, addon) => sum + addon.priceEur, 0);
  return {
    baseMonthlyEur: plan.price.monthlyEur,
    addonsMonthlyEur,
    totalMonthlyEur: plan.price.monthlyEur + addonsMonthlyEur,
    addons,
  };
}

/** -1 = unbeschränkt; 0 = keine Kapazität. Nicht als Kunden-Slot-Preis auslegen. */
export function fitsTenantCapacity(plan: Plan, requiredTenants: number): boolean {
  return Number.isInteger(requiredTenants) &&
    requiredTenants >= 1 &&
    (plan.limits.tenants === -1 || requiredTenants <= plan.limits.tenants);
}

/** Jahresabrechnung nur anzeigen, wenn die reale Checkout-Verdrahtung steht. */
export function yearlySelectable(plan: Plan): boolean {
  return plan.yearlyPlanKey !== null &&
    plan.price.yearlyEur !== null &&
    plan.yearlyCheckoutUnavailable !== true;
}
