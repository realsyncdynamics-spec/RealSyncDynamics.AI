/**
 * @file entitlements.ts
 * @description Pure policy module for evaluating package privileges.
 * Deterministic, side-effect-free, and decoupled from runtime environment specifics.
 */

import { PlanKey, PLANS } from './pricing';

/**
 * Checks if a specific plan has access to a given feature.
 */
export function hasFeature(plan: PlanKey, feature: string): boolean {
  const planDef = PLANS[plan];
  if (!planDef) return false;
  return planDef.features.includes(feature);
}

/**
 * Checks if a specific plan has access to a given system module.
 */
export function canUseModule(plan: PlanKey, module: string): boolean {
  const planDef = PLANS[plan];
  if (!planDef) return false;
  return planDef.modules.includes(module);
}

/**
 * Returns the compliance tier for a given plan (baseline, advanced, institutional, sovereign).
 */
export function getComplianceLevel(plan: PlanKey): string {
  const planDef = PLANS[plan];
  if (!planDef) return 'baseline';
  return planDef.complianceTier;
}

/**
 * Determines if the current plan is eligible for grant-funded or subsidized deployment.
 */
export function getGrantEligibility(plan: PlanKey): boolean {
  const planDef = PLANS[plan];
  if (!planDef) return false;
  return planDef.grantEligible;
}

/**
 * Returns the active risk controls and trust verification mechanisms for a given plan.
 */
export function getRiskControls(plan: PlanKey): string[] {
  const planDef = PLANS[plan];
  if (!planDef) return [];
  return planDef.riskControls;
}

/**
 * Validates if an action is within the plan's limits.
 */
export function isWithinLimits(plan: PlanKey, metric: 'assets' | 'teamMembers' | 'apiRequestsPerMonth', currentUsage: number): boolean {
  const limit = PLANS[plan]?.limits[metric];
  if (limit === 'unlimited') return true;
  if (typeof limit === 'number') return currentUsage < limit;
  return false;
}
