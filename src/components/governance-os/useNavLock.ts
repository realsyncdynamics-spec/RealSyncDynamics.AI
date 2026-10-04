import { useCallback } from 'react';
import { useTenant } from '../../core/access/TenantProvider';
import { useActivePlan } from '../../hooks/useModuleAccess';
import { planById } from '@/shared/pricing';
import { decideNavLock, type NavLock, type NavTarget } from './navAccess';

/**
 * Liefert die Nav-Schloss-Entscheidung aus `tenant_entitlements`
 * (`useTenant`) — dieselbe Quelle wie `RouteEntitlementGate`. Der Plan
 * dient nur noch dem Legacy-Fallback (navAccess.ts, Regel 3).
 */
export function useNavLock(): (target: NavTarget) => NavLock {
  const { loading, entitlements, hasFeature } = useTenant();
  const { plan } = useActivePlan();
  return useCallback(
    (target: NavTarget) =>
      decideNavLock(target, { loading, available: entitlements != null, hasFeature }, plan),
    [loading, entitlements, hasFeature, plan],
  );
}

/** Tooltip für ein Schloss: Mindestplan oder ehrlich „noch nicht verfügbar“. */
export function navLockTitle(label: string, lock: NavLock): string {
  if (!lock.locked) return label;
  if (lock.minPlan) return `${label} — ab ${planById(lock.minPlan).name}`;
  // minPlan null = kein wählbarer Plan gewährt die Keys (z. B. Klassifizierung).
  return `${label} ist noch nicht verfügbar — kein Upgrade schaltet dieses Modul frei.`;
}
