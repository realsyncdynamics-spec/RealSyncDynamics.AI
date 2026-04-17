import { 
  SubscriptionSnapshot, 
  OrganizationContext, 
  CurrentUsage, 
  EntitlementDecision,
  FeatureKey
} from './types';
import { PLAN_CONFIG } from './plan-config';

export function resolveEntitlements(
  subscription: SubscriptionSnapshot,
  org: OrganizationContext,
  usage: CurrentUsage
): EntitlementDecision {
  const base = PLAN_CONFIG[subscription.planKey];
  
  const isActive =
    subscription.planKey === 'free' ||
    subscription.status === 'active' ||
    subscription.status === 'trialing';

  const seatsAllowed =
    base.limits.teamSeatsIncluded === null
      ? null
      : base.limits.teamSeatsIncluded + (subscription.quantity ?? 0);

  return {
    planKey: subscription.planKey,
    isActive,
    features: Object.fromEntries(
      Object.entries(base.features).map(([key, enabled]) => {
        if (!isActive && key !== 'asset.verify') return [key, false];
        if (key === 'public-sector.mode' && !org.isPublicSector && subscription.planKey !== 'enterprise_public') {
          return [key, false];
        }
        return [key, enabled];
      })
    ) as Record<FeatureKey, boolean>,
    limits: base.limits,
    seatsAllowed,
    overages: {
      seatsExceeded: seatsAllowed === null ? false : org.memberCount > seatsAllowed,
      assetsExceeded:
        base.limits.activeAssets === null ? false : usage.activeAssets > base.limits.activeAssets,
      apiExceeded:
        base.limits.apiCallsMonthly === null ? false : usage.apiCallsMonthly > base.limits.apiCallsMonthly,
      bulkJobsExceeded:
        base.limits.bulkJobsMonthly === null ? false : usage.bulkJobsMonthly > base.limits.bulkJobsMonthly,
    },
  };
}
