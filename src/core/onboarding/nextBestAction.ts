/**
 * Next Best Action — ein Auftrag auf der Übersicht, nicht im Marketplace.
 *
 * Baut auf `canonicalRecommendation` und `moduleCatalog`. Keine vierte
 * Engine, keine Preise ausserhalb der SSoT, kein 149-€-Deep-Dive
 * (`MODULE_PRICING_STATUS` ist provisional, stripe-checkout nimmt nur
 * plan_key).
 *
 * Confidence hoch  → direkt der empfohlene Plan.
 * Confidence niedrig → Onboarding prüfen, nicht eine Zwischenstufe verkaufen.
 * Plan bereits getragen → Expansion aus dem Restkatalog.
 */

import {
  bookableModuleById,
  checkoutHrefForPlan,
  isPlanId,
  planRank,
  type BookableModuleId,
  type PlanId,
} from '@/shared/pricing';
import { withAuditContext } from './funnelContext';
import {
  type CanonicalRecommendation,
  type RecommendedModule,
} from './canonicalRecommendation';
import { isModuleActive } from '../../features/market/moduleCatalog';

export type NbaConfidence = 'high' | 'low';
export type NbaMode = 'activate_plan' | 'expand' | 'review';

export interface NextBestOffer {
  mode: NbaMode;
  confidence: NbaConfidence;
  plan: PlanId;
  findings: Array<{ label: string; reason: string }>;
  modules: RecommendedModule[];
  expansionIds: BookableModuleId[];
  ctaHref: string;
  ctaLabel: string;
}

/**
 * Scan-belegte Module (nicht das Pflicht-Fundament ohne Beleg).
 * Genau das unterscheidet „der Scan weiss, was zu tun ist" von einer
 * Planbehauptung.
 */
export function scanBackedModules(rec: CanonicalRecommendation): RecommendedModule[] {
  return rec.recommendedModules.filter((m) => m.source === 'scan' && m.evidence.length > 0);
}

export function recommendationConfidence(rec: CanonicalRecommendation): NbaConfidence {
  const backed = scanBackedModules(rec);
  if (backed.length >= 2) return 'high';
  if (backed.length >= 1 && (rec.urgency === 'critical' || rec.urgency === 'high')) return 'high';
  return 'low';
}

function currentPlanId(plan: PlanId | string | null | undefined): PlanId {
  if (plan && isPlanId(plan)) return plan;
  return 'free';
}

const EXPANSION_ORDER: BookableModuleId[] = [
  'whatsapp_bot',
  'voice_bot',
  'booking',
  'website_chat',
  'advanced_ai_governance',
  'additional_domain',
];

export function expansionModules(
  rec: CanonicalRecommendation,
  plan: PlanId | string | null | undefined,
): BookableModuleId[] {
  const remaining: BookableModuleId[] = [];
  const seen = new Set<BookableModuleId>();
  const consider = (id: BookableModuleId) => {
    if (seen.has(id)) return;
    const module = bookableModuleById(id);
    if (!module) return;
    if (isModuleActive(plan, module)) return;
    seen.add(id);
    remaining.push(id);
  };
  for (const m of rec.recommendedModules) consider(m.id);
  for (const id of EXPANSION_ORDER) consider(id);
  return remaining;
}

export function nextBestOffer(args: {
  rec: CanonicalRecommendation;
  currentPlan: PlanId | string | null | undefined;
  auditId: string;
  domain: string;
}): NextBestOffer {
  const confidence = recommendationConfidence(args.rec);
  const current = currentPlanId(args.currentPlan);
  const planCovered = planRank(current) >= planRank(args.rec.recommendedPlan);
  const findings = args.rec.recommendedActions.slice(0, 3).map((a) => ({
    label: a.label,
    reason: a.reason,
  }));
  const backed = scanBackedModules(args.rec);
  const expansionIds = expansionModules(args.rec, current);

  if (planCovered) {
    return {
      mode: 'expand',
      confidence,
      plan: current,
      findings,
      modules: args.rec.recommendedModules.filter((m) => expansionIds.includes(m.id)),
      expansionIds,
      ctaHref: '/app/marketplace',
      ctaLabel: 'Nächsten Dienst wählen',
    };
  }

  const checkout = withAuditContext(
    checkoutHrefForPlan(args.rec.recommendedPlan, { source: 'dashboard_nba' }),
    { auditId: args.auditId, domain: args.domain },
  );

  if (confidence === 'high') {
    return {
      mode: 'activate_plan',
      confidence,
      plan: args.rec.recommendedPlan,
      findings,
      modules: backed.length > 0 ? backed : args.rec.recommendedModules,
      expansionIds,
      ctaHref: checkout,
      ctaLabel: 'Empfohlenen Plan aktivieren',
    };
  }

  return {
    mode: 'review',
    confidence,
    plan: args.rec.recommendedPlan,
    findings,
    modules: args.rec.recommendedModules,
    expansionIds,
    ctaHref: `/onboarding/${encodeURIComponent(args.auditId)}`,
    ctaLabel: 'Empfehlung prüfen',
  };
}
