import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../access/TenantProvider';
import { createCheckoutSession, type PlanKey } from '../../features/billing/checkout';

interface UpgradeResult {
  success: boolean;
  error?: string;
}

/**
 * Hook for handling subscription upgrades.
 * Initiates Stripe checkout session and redirects user to payment flow.
 */
export function useSubscriptionUpgrade() {
  const { user } = useAuth();
  const { activeTenantId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgradeToPlan = useCallback(
    async (planKey: PlanKey): Promise<UpgradeResult> => {
      if (!user || !activeTenantId) {
        return { success: false, error: 'Not authenticated' };
      }

      setLoading(true);
      setError(null);

      try {
        const result = await createCheckoutSession(activeTenantId, planKey);

        if (!result.ok) {
          const errorMsg = result.error?.message || 'Checkout failed';
          setError(errorMsg);
          return { success: false, error: errorMsg };
        }

        if (result.url) {
          window.location.href = result.url;
          return { success: true };
        }

        return { success: false, error: 'No checkout URL returned' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [user, activeTenantId]
  );

  return {
    upgradeToPlan,
    loading,
    error,
  };
}
