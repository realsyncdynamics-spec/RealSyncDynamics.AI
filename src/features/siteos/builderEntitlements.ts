/**
 * Thin read-only adapter — consumes builder entitlements from the pricing SSoT.
 *
 * Monetisierung owns `shared/pricing.ts` (appBuilder / frontendDesigner,
 * sites, builderRunsPerMonth). This module never invents a second price
 * ladder and never branches on plan-name string compares — only
 * plan.permissions / plan.limits.
 *
 * Until those keys land in the SSoT, `ssotReady` is false and the studio
 * stays Preview without pretending the customer already paid.
 */

import {
  checkoutHrefForPlan,
  minimumPlanForPermission,
  planById,
  resolvePlan,
  withinLimit,
  type Plan,
  type PlanId,
} from '@/shared/pricing';

/** Optional fields expected from Monetisierung's pricing PR. */
type BuilderPermissionFields = {
  appBuilder?: boolean;
  frontendDesigner?: boolean;
};

type BuilderLimitFields = {
  sites?: number;
  builderRunsPerMonth?: number;
};

export interface BuilderEntitlementSnapshot {
  /** True once `permissions.appBuilder` exists on the resolved plan. */
  ssotReady: boolean;
  appBuilder: boolean;
  frontendDesigner: boolean;
  /** SiteOS site cap. Separate from monitored `domains` assets. */
  sites: number;
  builderRunsPerMonth: number;
  planId: PlanId | null;
  planName: string | null;
}

function asBuilderPermissions(plan: Plan): BuilderPermissionFields {
  return plan.permissions as Plan['permissions'] & BuilderPermissionFields;
}

function asBuilderLimits(plan: Plan): BuilderLimitFields {
  return plan.limits as Plan['limits'] & BuilderLimitFields;
}

/**
 * Resolve builder entitlements from a plan id/key/object.
 * Missing SSoT keys ⇒ not entitled (ssotReady false), never a fake grant.
 */
export function resolveBuilderEntitlements(
  plan: Plan | PlanId | string | null | undefined,
): BuilderEntitlementSnapshot {
  const resolved = resolvePlan(plan);
  if (!resolved) {
    return {
      ssotReady: false,
      appBuilder: false,
      frontendDesigner: false,
      sites: 0,
      builderRunsPerMonth: 0,
      planId: null,
      planName: null,
    };
  }

  const permissions = asBuilderPermissions(resolved);
  const limits = asBuilderLimits(resolved);
  const ssotReady = Object.prototype.hasOwnProperty.call(resolved.permissions, 'appBuilder');

  return {
    ssotReady,
    appBuilder: permissions.appBuilder === true,
    frontendDesigner: permissions.frontendDesigner === true,
    sites: typeof limits.sites === 'number' ? limits.sites : 0,
    builderRunsPerMonth:
      typeof limits.builderRunsPerMonth === 'number' ? limits.builderRunsPerMonth : 0,
    planId: resolved.id,
    planName: resolved.name,
  };
}

/** Studio open when SSoT grants appBuilder. */
export function canOpenAppBuilder(snapshot: BuilderEntitlementSnapshot): boolean {
  return snapshot.ssotReady && snapshot.appBuilder;
}

/** Visual designer pane when SSoT grants frontendDesigner. */
export function canUseFrontendDesigner(snapshot: BuilderEntitlementSnapshot): boolean {
  return snapshot.ssotReady && snapshot.frontendDesigner;
}

/**
 * While Monetisierung has not merged builder keys, the studio may open as
 * Preview for signed-in users — never as a paid entitlement.
 */
export function studioPreviewUntilSsot(snapshot: BuilderEntitlementSnapshot): boolean {
  return !snapshot.ssotReady;
}

export function isWithinBuilderRuns(
  snapshot: BuilderEntitlementSnapshot,
  usedThisMonth: number,
): boolean {
  if (!snapshot.ssotReady) return true; // no hard meter until SSoT defines the cap
  if (snapshot.builderRunsPerMonth === -1) return true;
  if (snapshot.builderRunsPerMonth <= 0) return false;
  return usedThisMonth < snapshot.builderRunsPerMonth;
}

export function isWithinSiteCap(
  snapshot: BuilderEntitlementSnapshot,
  siteCount: number,
): boolean {
  if (!snapshot.ssotReady) return true;
  if (snapshot.sites === -1) return true;
  if (snapshot.sites <= 0) return false;
  return siteCount < snapshot.sites;
}

/**
 * Upgrade target: cheapest plan that grants appBuilder once the field exists;
 * otherwise Starter checkout (documented Monetisierung entry plan).
 */
export function builderUpgradeHref(currentPlan?: Plan | PlanId | string | null): string {
  const resolved = resolvePlan(currentPlan);
  try {
    // minimumPlanForPermission typing may lag until Monetisierung lands.
    const min = minimumPlanForPermission(
      'appBuilder' as Parameters<typeof minimumPlanForPermission>[0],
    );
    if (min) {
      return checkoutHrefForPlan(planById(min), { source: 'build-studio-upgrade' });
    }
  } catch {
    // Field not in PermissionKey yet — fall through.
  }

  // Next self-service step from free → starter; paid users still get Starter
  // only when they lack the key (SSoT pending). Never invent yearly checkout.
  if (!resolved || resolved.id === 'free') {
    return checkoutHrefForPlan(planById('starter'), { source: 'build-studio-upgrade' });
  }
  return checkoutHrefForPlan(planById('starter'), { source: 'build-studio-upgrade' });
}

/** Limit-hit copy helper — uses withinLimit when the SSoT field exists. */
export function builderRunsExhausted(
  plan: Plan | PlanId | string | null | undefined,
  used: number,
): boolean {
  const resolved = resolvePlan(plan);
  if (!resolved) return true;
  if (!Object.prototype.hasOwnProperty.call(resolved.limits, 'builderRunsPerMonth')) {
    return false;
  }
  return !withinLimit(
    resolved,
    'builderRunsPerMonth' as Parameters<typeof withinLimit>[1],
    used,
  );
}
