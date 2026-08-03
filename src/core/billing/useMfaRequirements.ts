import { useCallback, useMemo } from 'react';
import { useTenant } from '../access/TenantProvider';
import { requiresAal2, PRIVILEGED_ROLES } from '../access/aal2-policy';

// Features that require MFA (AAL2) for sensitive operations
const MFA_REQUIRED_FEATURES = [
  'billing.manage',         // Billing management
  'billing.usage',          // Usage limits & consumption
  'team.admin',             // Team member management
  'settings.branding',      // White-label branding
  'governance.sensitive',   // Sensitive governance operations
] as const;

export interface MfaRequirement {
  featureKey: string;
  requiresMfa: boolean;
  reason?: string; // Why MFA is required (e.g., "Sensitive billing data")
}

export function useMfaRequirements() {
  const { tenants, activeTenantId } = useTenant();

  const activeTenant = useMemo(() => {
    return tenants.find((t) => t.tenantId === activeTenantId) ?? null;
  }, [tenants, activeTenantId]);

  const role = activeTenant?.role ?? null;
  const isPublicSector = activeTenant?.isPublicSector ?? false;
  const requiresMfa = requiresAal2(role, isPublicSector);

  const checkMfaRequired = useCallback(
    (featureKey: string): MfaRequirement => {
      const isSensitiveFeature = MFA_REQUIRED_FEATURES.includes(
        featureKey as any
      );

      if (!isSensitiveFeature) {
        return {
          featureKey,
          requiresMfa: false,
        };
      }

      return {
        featureKey,
        requiresMfa: requiresMfa && isSensitiveFeature,
        reason: requiresMfa
          ? 'Diese Funktion erfordert Zwei-Faktor-Authentifizierung (MFA) für Ihre Sicherheit'
          : undefined,
      };
    },
    [requiresMfa]
  );

  return {
    requiresMfa,
    checkMfaRequired,
    isSensitiveRole: requiresMfa,
  };
}
