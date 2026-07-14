import React, { useState } from 'react';
import { useEntitlements } from './useEntitlements';
import { SubscriptionLimitModal } from './SubscriptionLimitModal';

interface SubscriptionLimitGuardProps {
  feature: string;
  featureName: string;
  tier?: string;
  onLimitReached?: () => void;
  children: (allowed: boolean, onAttempt: () => void) => React.ReactNode;
}

/**
 * General-purpose guard for subscription tier features.
 * Checks entitlements and shows paywall for premium features.
 *
 * Usage:
 * <SubscriptionLimitGuard feature="reports.export" featureName="Reports Export">
 *   {(allowed, onAttempt) => (
 *     <button onClick={onAttempt} disabled={!allowed}>
 *       Export Report
 *     </button>
 *   )}
 * </SubscriptionLimitGuard>
 */
export function SubscriptionLimitGuard({
  feature,
  featureName,
  tier,
  onLimitReached,
  children,
}: SubscriptionLimitGuardProps) {
  const { hasFeature, canAccess } = useEntitlements();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const allowed = hasFeature(feature);
  const access = canAccess(feature);

  const handleAttempt = () => {
    if (!allowed) {
      setShowLimitModal(true);
      onLimitReached?.();
    }
  };

  return (
    <>
      {children(allowed, handleAttempt)}
      {!allowed && (
        <SubscriptionLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          feature={feature}
          featureName={featureName}
          currentTier={tier}
          upgradeUrl={access.upgradeUrl}
        />
      )}
    </>
  );
}
