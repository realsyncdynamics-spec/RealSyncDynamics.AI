import {
  ONE_TIME_PRICING_TIERS,
  PUBLIC_PRICING_TIERS,
  type PricingTier,
} from '../../config/pricing';

export type WebsiteTransformationRequirements = {
  selectedFeatures: string[];
  scanRisk: number;
  scanCompliance: number;
  scanPerformance: number;
};

export type WebsiteTransformationOffer = {
  oneTime: PricingTier | null;
  recommendedPlan: PricingTier | null;
  alternatives: PricingTier[];
  reasons: string[];
};

/**
 * Selects the commercial recommendation without introducing a second price
 * source. All prices, plan keys and Stripe checkout hrefs come from the
 * central Pricing SSoT.
 *
 * The recommendation is deliberately deterministic for the first funnel
 * release. It is a product recommendation, not an entitlement decision:
 * the server-side Stripe/webhook/entitlement path remains authoritative.
 */
export function getWebsiteTransformationOffer(
  requirements: WebsiteTransformationRequirements,
): WebsiteTransformationOffer {
  const features = new Set(requirements.selectedFeatures.map((feature) => feature.toLowerCase()));
  const reasons: string[] = [];

  let target = 'starter';

  if (features.has('phonebot') || features.has('booking') || features.has('ai-act')) {
    target = 'growth';
    reasons.push('Mehrere produktive Website-Funktionen und laufende Governance-Anforderungen.');
  }

  if (
    features.size >= 6 ||
    features.has('phonebot') && features.has('chatbot') ||
    requirements.scanRisk >= 60
  ) {
    target = 'agency';
    reasons.push('Erweiterter Funktionsumfang bzw. erhöhte Transformations- und Monitoring-Anforderungen.');
  }

  if (requirements.scanCompliance < 60) {
    reasons.push('Der Ausgangsscan zeigt erhöhten Compliance-Bedarf.');
  }

  if (requirements.scanPerformance < 60) {
    reasons.push('Der Ausgangsscan zeigt zusätzlichen technischen Optimierungsbedarf.');
  }

  if (reasons.length === 0) {
    reasons.push('Der aktuelle Funktionsumfang passt zum empfohlenen Einstiegspaket.');
  }

  const recommendedPlan = PUBLIC_PRICING_TIERS.find((tier) => tier.planKey === target) ?? PUBLIC_PRICING_TIERS[0] ?? null;
  const oneTime = ONE_TIME_PRICING_TIERS[0] ?? null;

  const alternatives = PUBLIC_PRICING_TIERS.filter((tier) => tier.planKey !== recommendedPlan?.planKey);

  return { oneTime, recommendedPlan, alternatives, reasons };
}
