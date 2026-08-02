import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import {
  hasPermission,
  minimumPlanForPermission,
  planById,
  resolvePlan,
  type TierId,
} from '../../config/pricing';

interface ApiAccessStatus {
  hasAccess: boolean;
  tier: TierId | null;
  message: string;
  keysCount: number;
  loading: boolean;
  error: string | null;
}

// Der niedrigste Plan mit API-Berechtigung — abgeleitet, nicht gepflegt.
const MIN_API_PLAN = minimumPlanForPermission('api');

export function useApiAccess(): ApiAccessStatus {
  const { user } = useAuth();
  const { activeTenantId } = useTenant();
  const [status, setStatus] = useState<ApiAccessStatus>({
    hasAccess: false,
    tier: null,
    message: 'Wird geprüft…',
    keysCount: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user || !activeTenantId) {
      setStatus((s) => ({ ...s, loading: false, message: 'Bitte melden Sie sich an.' }));
      return;
    }

    (async () => {
      try {
        const sb = getSupabase();

        // 1. Hole Tenant-Subscription (plan_id oder subscription_tier)
        const { data: tenantData, error: tenantErr } = await sb
          .from('tenants')
          .select('plan_id, subscription_tier')
          .eq('id', activeTenantId)
          .single();

        if (tenantErr) throw tenantErr;

        // Altdaten (`scale`) werden über resolvePlan() auf `partner` abgebildet.
        const plan = resolvePlan(tenantData?.subscription_tier ?? tenantData?.plan_id ?? 'free');
        const tier = (plan?.id ?? 'free') as TierId;
        const hasAccess = hasPermission(plan, 'api');

        // 2. Zähle aktive API-Keys
        const { data: keysData, error: keysErr } = await sb
          .from('api_keys')
          .select('id', { count: 'exact' })
          .eq('tenant_id', activeTenantId)
          .is('revoked_at', null);

        if (keysErr) throw keysErr;

        const keysCount = keysData?.length ?? 0;

        let message = 'Lade…';
        if (!hasAccess) {
          const current = plan ? plan.name : 'aktuellen';
          const required = MIN_API_PLAN ? planById(MIN_API_PLAN).name : 'einem höheren';
          message = `API-Zugriff ist im Plan ${current} nicht enthalten. Ab ${required} verfügbar.`;
        } else if (keysCount === 0) {
          message = 'Noch kein API-Key erstellt. Starten Sie mit dem Wizard.';
        } else {
          message = `API-Zugriff aktiv. ${keysCount} Schlüssel vorhanden.`;
        }

        setStatus({
          hasAccess,
          tier,
          message,
          keysCount,
          loading: false,
          error: null,
        });
      } catch (err) {
        const errorMsg = (err as Error)?.message ?? 'Fehler beim Laden des API-Zugriffs';
        setStatus((s) => ({ ...s, loading: false, error: errorMsg }));
      }
    })();
  }, [user, activeTenantId]);

  return status;
}
