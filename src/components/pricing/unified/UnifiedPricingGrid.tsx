/**
 * UnifiedPricingGrid — standardisierte Darstellung aller Preispläne.
 *
 * Diese Komponente wird überall eingesetzt, wo Pläne in einem Grid angezeigt werden
 * (Landing Pages, Pricing-Seite, Upgrade-Modals). Sie kümmert sich um Layout,
 * Responsive-Verhalten und konsistente Abstände — nichts davon wird repliziert.
 *
 * Verwendung:
 *   <UnifiedPricingGrid variant="landing" />
 *   <UnifiedPricingGrid variant="pricing-page" highlight="growth" />
 */

import { type PlanId, ORDERED_PLANS, planById, checkoutHrefForPlan, type Plan } from '../../config/pricing';
import { UnifiedPlanCard, type UnifiedPlanCardVariant } from './UnifiedPlanCard';

export type UnifiedPricingGridVariant = 'landing' | 'pricing-page' | 'compact' | 'full';

export interface UnifiedPricingGridProps {
  /** 'landing': 5 Pläne, compact cards | 'pricing-page': 5 Pläne, full cards */
  variant?: UnifiedPricingGridVariant;
  /** Plan-ID zum Hervorheben (z.B. 'growth') */
  highlight?: PlanId;
  /** Welche Pläne anzeigen? Default: alle außer Free */
  include?: PlanId[];
  /** Free Plan einschließen? Default: false */
  includeFree?: boolean;
  /** Welche Pläne sollten als CTA-Links funktionieren? Default: alle */
  ctalink?: PlanId[];
  /** Callback wenn CTA geklickt wird */
  onPlanSelect?: (planId: PlanId) => void;
  /** Source-Tag für Tracking (?source=) */
  source?: string;
}

export function UnifiedPricingGrid({
  variant = 'landing',
  highlight,
  include,
  includeFree = false,
  ctalink,
  onPlanSelect,
  source = 'pricing-grid',
}: UnifiedPricingGridProps) {
  // Welche Pläne anzeigen?
  let plansToShow: Plan[] = ORDERED_PLANS.filter(
    (p) => includeFree || p.price.monthlyEur > 0,
  );

  if (include) {
    plansToShow = plansToShow.filter((p) => include.includes(p.id as PlanId));
  }

  // Kompakte vs. volle Darstellung
  const cardVariant: UnifiedPlanCardVariant = variant === 'pricing-page' || variant === 'full' ? 'full' : 'compact';

  // Grid-Klassen nach Variant
  const gridClasses = {
    landing: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4',
    'pricing-page': 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6',
    compact: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4',
    full: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6',
  };

  return (
    <div className={gridClasses[variant]}>
      {plansToShow.map((plan) => {
        const shouldHighlight = highlight === plan.id;
        const ctaHref = ctalink?.includes(plan.id as PlanId)
          ? checkoutHrefForPlan(plan, { source })
          : undefined;

        return (
          <UnifiedPlanCard
            key={plan.id}
            plan={plan}
            variant={cardVariant}
            highlight={shouldHighlight}
            ctaHref={ctaHref}
            onCta={onPlanSelect ? () => onPlanSelect(plan.id as PlanId) : undefined}
          />
        );
      })}
    </div>
  );
}
