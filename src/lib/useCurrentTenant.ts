import { useTenant } from '../core/access/TenantProvider';

export function useCurrentTenant() {
  const tenantState = useTenant();
  const activeTenant = tenantState.tenants.find((t) => t.tenantId === tenantState.activeTenantId);

  return activeTenant ? { id: activeTenant.tenantId, name: activeTenant.name } : null;
}
