/**
 * Governance-Feature-Gating — abgeleitete Sicht auf die Pricing-SSoT.
 *
 * ⚠️  Diese Datei führte früher eine eigene Tier-Matrix mit eigenen Limits,
 *     Rahmenwerken und Feature-Listen. Genau daraus entstand die Drift, die
 *     dieses Refactoring beseitigt. Es gibt hier nur noch Ableitungen aus
 *     `shared/pricing.ts`.
 *
 * Konsumenten:
 *   - src/components/governance/GovernanceTierGate.tsx
 *   - Edge Functions: /governance-* (Tier-Validierung)
 *   - View-Level-Zugriffskontrolle in src/features/governance/
 */

import {
  ALL_MODULES,
  PLANS,
  PLAN_ORDER,
  planById,
  resolvePlan,
  policyPacksFor,
  minimumPlanForModule as ssotMinimumPlanForModule,
  type ModuleDefinition,
  type ModuleId,
  type PlanId,
  type SupportLevel,
} from '@/shared/pricing';
import type { TierId } from './pricing';

export interface GovernanceFeature {
  id: ModuleId;
  name: string;
  description: string;
  /** Lucide-Icon-Name */
  icon: string;
  /** Niedrigster Plan, der das Modul enthält */
  requiredTier: PlanId;
}

export interface GovernanceTierConfig {
  tier: PlanId;
  label: string;
  auditReportsPerMonth: number;
  remediationPlans: number;
  evidenceStorageGb: number;
  apiKeysAllowed: number;
  /** Aktive Rahmenwerke (Policy Packs) */
  frameworks: ModuleId[];
  /** Freigeschaltete Modul-IDs */
  features: ModuleId[];
  support: SupportLevel;
}

function toTierConfig(planId: PlanId): GovernanceTierConfig {
  const plan = planById(planId);
  return {
    tier: plan.id,
    label: plan.name,
    auditReportsPerMonth: plan.limits.auditReportsPerMonth,
    remediationPlans: plan.limits.remediationPlans,
    evidenceStorageGb: plan.limits.evidenceStorageGb,
    apiKeysAllowed: plan.limits.apiKeys,
    frameworks: policyPacksFor(plan),
    features: plan.modules,
    support: plan.support,
  };
}

/**
 * Tier-zu-Feature-Matrix, vollständig aus der SSoT berechnet.
 * Jahresvarianten haben per Definition dieselben Features wie ihr
 * Monatsplan — deshalb existieren sie hier gar nicht erst als
 * eigene Einträge; `governanceTierFor()` löst sie auf.
 */
export const GOVERNANCE_TIERS: Record<PlanId, GovernanceTierConfig> = PLANS.reduce(
  (acc, plan) => {
    acc[plan.id] = toTierConfig(plan.id);
    return acc;
  },
  {} as Record<PlanId, GovernanceTierConfig>,
);

/** Alle Module als Feature-Definitionen mit ihrem Mindest-Plan. */
export const GOVERNANCE_FEATURES: GovernanceFeature[] = ALL_MODULES.map(
  (module: ModuleDefinition): GovernanceFeature => ({
    id: module.id,
    name: module.name,
    description: module.description,
    icon: module.icon,
    requiredTier: ssotMinimumPlanForModule(module.id) ?? 'enterprise',
  }),
);

/**
 * Tier-Konfiguration für einen beliebigen Plan-Bezeichner — inklusive
 * Jahresvarianten (`growth_yearly`) und Altdaten (`scale`).
 */
export function governanceTierFor(
  tier: TierId | string | null | undefined,
): GovernanceTierConfig | undefined {
  const plan = resolvePlan(tier);
  if (!plan) return undefined;
  return GOVERNANCE_TIERS[plan.id];
}

/** Hat der Plan Zugriff auf das Modul? */
export function tierHasFeature(
  tier: TierId | string | null | undefined,
  featureId: ModuleId,
): boolean {
  const config = governanceTierFor(tier);
  if (!config) return false;
  return config.features.includes(featureId);
}

/** Mindest-Plan für ein Modul. */
export function getFeatureMinimumTier(featureId: ModuleId): PlanId | undefined {
  return GOVERNANCE_FEATURES.find((f) => f.id === featureId)?.requiredTier;
}

/** Alle im Plan verfügbaren Module als Feature-Definitionen. */
export function getFeaturesByTier(
  tier: TierId | string | null | undefined,
): GovernanceFeature[] {
  const config = governanceTierFor(tier);
  if (!config) return [];
  return GOVERNANCE_FEATURES.filter((f) => config.features.includes(f.id));
}

/**
 * Niedrigster Plan, der ALLE geforderten Module abdeckt.
 * Nutzt die kanonische Plan-Reihenfolge — kein eigenes Ranking.
 */
export function getRecommendedTierForFeatures(requiredFeatures: ModuleId[]): PlanId {
  let minRank = 0;
  for (const feature of requiredFeatures) {
    const required = getFeatureMinimumTier(feature);
    if (!required) continue;
    minRank = Math.max(minRank, PLAN_ORDER.indexOf(required));
  }
  return PLAN_ORDER[minRank];
}
