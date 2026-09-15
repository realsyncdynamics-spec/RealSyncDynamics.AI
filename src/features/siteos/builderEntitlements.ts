/**
 * Thin read-only adapter — SiteOS builder entitlements.
 *
 * Canonical keys (Monetisierung SSoT / PR #1357):
 *   - `siteos.builder`  — open /build, create/claim sites
 *   - `siteos.publish`  — publish-gate / approve (public deploy stays Preview)
 *   - `limit.sites`     — distinct SiteOS slugs (0/1/3/10/…)
 *
 * Never invent `builderRunsPerMonth` or a `frontendDesigner` permission.
 * Frontend Designer follows `siteos.builder`.
 * Never edit shared/pricing.ts from this PR — consume only.
 */

import {
  ENTITLEMENT_KEYS,
  checkoutHrefForPlan,
  hasPermission,
  limitOf,
  planById,
  planEntitlementValue,
  planGrants,
  resolvePlan,
  type EntitlementKey,
  type Plan,
  type PlanId,
  type PlanKey,
} from '@/shared/pricing';

/** Entitlement vocabulary — string constants, not plan-name branches. */
export const SITEOS_BUILDER_KEY = 'siteos.builder' as EntitlementKey;
export const SITEOS_PUBLISH_KEY = 'siteos.publish' as EntitlementKey;
export const SITEOS_SITES_LIMIT_KEY = 'limit.sites' as EntitlementKey;

/** Optional plan.permissions fields once Monetisierung lands. */
type SiteOsPermissionFields = {
  siteosBuilder?: boolean;
  siteosPublish?: boolean;
};

export interface BuilderEntitlementSnapshot {
  /** True once `siteos.builder` exists in ENTITLEMENT_KEYS / PLAN_ENTITLEMENTS. */
  ssotReady: boolean;
  builder: boolean;
  publish: boolean;
  /** Distinct SiteOS site cap (`limit.sites`). `-1` = unlimited. */
  sites: number;
  planId: PlanId | null;
  planName: string | null;
  planKey: string | null;
}

/** Runtime feature map from `useEntitlements()` / `tenant_entitlements()`. */
export type EntitlementFeatureMap = Record<string, boolean | number>;

export function siteosSsotReady(): boolean {
  return (ENTITLEMENT_KEYS as readonly string[]).includes(SITEOS_BUILDER_KEY);
}

function featureOn(features: EntitlementFeatureMap | null | undefined, key: string): boolean {
  if (!features) return false;
  const val = features[key];
  return val === true || val === -1 || (typeof val === 'number' && val > 0);
}

function featureLimit(
  features: EntitlementFeatureMap | null | undefined,
  key: string,
): number | null {
  if (!features) return null;
  const val = features[key];
  return typeof val === 'number' ? val : null;
}

/**
 * Resolve from live tenant features (preferred) plus plan SSoT fallback.
 *
 * Order: `useEntitlements` feature map → `planGrants` / `hasPermission` /
 * `limitOf` once SSoT keys exist. Missing SSoT ⇒ ssotReady false, never a
 * fake paid grant.
 */
export function resolveBuilderEntitlements(
  plan: Plan | PlanId | string | null | undefined,
  features?: EntitlementFeatureMap | null,
): BuilderEntitlementSnapshot {
  const resolved = resolvePlan(plan);
  const ssotReady = siteosSsotReady();
  const planKey = resolved?.planKey ?? null;

  if (!resolved) {
    return {
      ssotReady,
      builder: featureOn(features, SITEOS_BUILDER_KEY),
      publish: featureOn(features, SITEOS_PUBLISH_KEY),
      sites: featureLimit(features, SITEOS_SITES_LIMIT_KEY) ?? 0,
      planId: null,
      planName: null,
      planKey: null,
    };
  }

  const perms = resolved.permissions as Plan['permissions'] & SiteOsPermissionFields;

  let builder = featureOn(features, SITEOS_BUILDER_KEY);
  let publish = featureOn(features, SITEOS_PUBLISH_KEY);
  let sites = featureLimit(features, SITEOS_SITES_LIMIT_KEY);

  if (ssotReady) {
    if (!builder) {
      builder =
        planGrants(planKey as PlanKey, SITEOS_BUILDER_KEY) ||
        perms.siteosBuilder === true ||
        hasPermission(resolved, 'siteosBuilder' as Parameters<typeof hasPermission>[1]);
    }
    if (!publish) {
      publish =
        planGrants(planKey as PlanKey, SITEOS_PUBLISH_KEY) ||
        perms.siteosPublish === true ||
        hasPermission(resolved, 'siteosPublish' as Parameters<typeof hasPermission>[1]);
    }
    if (sites === null) {
      const fromEnt = planEntitlementValue(planKey as PlanKey, SITEOS_SITES_LIMIT_KEY);
      if (typeof fromEnt === 'number') {
        sites = fromEnt;
      } else if (Object.prototype.hasOwnProperty.call(resolved.limits, 'sites')) {
        sites = limitOf(resolved, 'sites' as Parameters<typeof limitOf>[1]);
      } else {
        sites = 0;
      }
    }
  } else if (sites === null) {
    sites = 0;
  }

  return {
    ssotReady,
    builder,
    publish,
    sites: sites ?? 0,
    planId: resolved.id,
    planName: resolved.name,
    planKey,
  };
}

/** Studio open when `siteos.builder` is granted (live features or SSoT). */
export function canOpenAppBuilder(snapshot: BuilderEntitlementSnapshot): boolean {
  return snapshot.builder;
}

/** Frontend Designer shares `siteos.builder` — no separate permission. */
export function canUseFrontendDesigner(snapshot: BuilderEntitlementSnapshot): boolean {
  return snapshot.builder;
}

/** Publish-gate / approve — public deploy remains Preview regardless. */
export function canPublishSite(snapshot: BuilderEntitlementSnapshot): boolean {
  return snapshot.publish;
}

/**
 * Soft Preview only when the SSoT vocabulary is not on this branch yet and
 * the tenant also has no live `siteos.builder` grant. Never a fake paid plan.
 */
export function studioPreviewUntilSsot(snapshot: BuilderEntitlementSnapshot): boolean {
  return !snapshot.ssotReady && !snapshot.builder;
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
 * Upgrade target: Starter monthly checkout (first plan with siteos.builder).
 * Never invent yearly checkout.
 */
export function builderUpgradeHref(_currentPlan?: Plan | PlanId | string | null): string {
  return checkoutHrefForPlan(planById('starter'), { source: 'build-studio-upgrade' });
}

/** Helper for `useEntitlements().canAccess('siteos.builder')` upgrade URLs. */
export function upgradeHrefFromAccess(upgradeUrl?: string): string {
  if (upgradeUrl && upgradeUrl.includes('/checkout/')) {
    // Prefer monthly path; strip accidental yearly if present.
    return upgradeUrl.replace(/_yearly/g, '').replace(/interval=year/g, 'interval=month');
  }
  return builderUpgradeHref();
}
