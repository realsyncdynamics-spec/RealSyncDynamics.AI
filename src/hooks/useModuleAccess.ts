import { useEffect, useState } from 'react';
import { useTenant } from '../core/access/TenantProvider';
import { getActivePlanForTenant } from '../lib/billing/planAccess';
import { GOVERNANCE_MODULES, canAccessModule } from '../components/governance-os/governanceModules';

/**
 * Gibt zurück ob der aktive Tenant Zugriff auf das angegebene Governance-Modul hat.
 * Lädt den Plan asynchron aus der DB (cached durch planAccess).
 */
export function useModuleAccess(moduleId: string): { allowed: boolean; loading: boolean; plan: string | null } {
  const { activeTenantId } = useTenant();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!activeTenantId) { setPlan('free'); setLoading(false); return; }

    getActivePlanForTenant(activeTenantId)
      .then((p) => { if (active) { setPlan(p ?? 'free'); setLoading(false); } })
      .catch(() => { if (active) { setPlan('free'); setLoading(false); } });

    return () => { active = false; };
  }, [activeTenantId]);

  const module = GOVERNANCE_MODULES.find((m) => m.id === moduleId);
  const allowed = module && plan ? canAccessModule(module, plan) : false;

  return { allowed, loading, plan };
}

/**
 * Gibt den aktiven Plan-Key des Tenants zurück.
 */
export function useActivePlan(): { plan: string; loading: boolean } {
  const { activeTenantId } = useTenant();
  const [plan, setPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!activeTenantId) { setPlan('free'); setLoading(false); return; }

    getActivePlanForTenant(activeTenantId)
      .then((p) => { if (active) { setPlan(p ?? 'free'); setLoading(false); } })
      .catch(() => { if (active) { setPlan('free'); setLoading(false); } });

    return () => { active = false; };
  }, [activeTenantId]);

  return { plan, loading };
}
