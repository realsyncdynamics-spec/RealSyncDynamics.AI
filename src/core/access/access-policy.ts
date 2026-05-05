import { EntitlementDecision, FeatureKey } from '../billing/types';

export function canUseFeature(
  entitlements: EntitlementDecision,
  feature: FeatureKey
): boolean {
  if (!entitlements.isActive && feature !== 'asset.verify') return false;
  return !!entitlements.features[feature];
}
