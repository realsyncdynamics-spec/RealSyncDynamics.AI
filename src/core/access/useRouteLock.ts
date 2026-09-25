/**
 * React-Anbindung von `isRouteLocked` an die wirksamen Entitlements des
 * Mandanten (`TenantProvider`) — dieselbe Quelle wie `RouteEntitlementGate`.
 */
import { useCallback } from 'react';
import { useTenant } from './TenantProvider';
import { isRouteLocked } from './featureAccess';

/** Liefert eine Prüffunktion `route → gesperrt?` für Listen (Navigation). */
export function useRouteLockCheck(): (route: string) => boolean {
  const { hasFeature, loading, entitlements } = useTenant();
  const loaded = !loading && entitlements != null;
  return useCallback(
    (route: string) => isRouteLocked(route, (key) => hasFeature(key), loaded),
    [hasFeature, loaded],
  );
}

/** Gesperrt-Status einer einzelnen Route (Karten, Links). */
export function useRouteLocked(route: string): boolean {
  return useRouteLockCheck()(route);
}
