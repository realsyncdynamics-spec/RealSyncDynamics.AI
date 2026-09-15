import { getPlansByFeature, type PricingPlan } from '../../content/pricingContent';

/**
 * Einstiegsplan eines Moduls — abgeleitet aus `pricingContent`, nicht getippt.
 *
 * Monatliche Kaufpläne in aufsteigender Reihenfolge; der erste Plan, der das
 * Modul enthält, ist der Einstieg. Jahres- und Partner-Varianten bleiben
 * aussen vor, damit das Badge auf der Startseite den günstigsten regulären
 * Einstieg nennt.
 */
export const PLAN_ENTRY_ORDER = ['starter', 'growth', 'agency', 'enterprise'] as const;

export function entryPlanForFeature(featureSlug: string): PricingPlan | undefined {
  const plans = getPlansByFeature(featureSlug);
  for (const slug of PLAN_ENTRY_ORDER) {
    const hit = plans.find((plan) => plan.slug === slug);
    if (hit) return hit;
  }
  return undefined;
}
