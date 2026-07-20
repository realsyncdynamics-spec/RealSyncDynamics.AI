import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import type { TierId } from '../../config/pricing';

interface ApiAccessStatus {
  hasAccess: boolean;
  tier: TierId | null;
  message: string;
  keysCount: number;
  loading: boolean;
  error: string | null;
}

// API ist in diesen Tiers enthalten
const API_ENABLED_TIERS: TierId[] = ['agency', 'scale', 'enterprise'];

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

        // 1. Hole Tenant-Subscription (plan_key aus subscriptions)
        const { data: subData, error: subErr } = await sb
          .from('subscriptions')
          .select('plan_key')
          .eq('tenant_id', activeTenantId)
          .eq('status', 'active')
          .single();

        if (subErr && subErr.code !== 'PGRST116') throw subErr; // PGRST116 = no rows

        const tier = (subData?.plan_key ?? 'free') as TierId;
        const hasAccess = API_ENABLED_TIERS.includes(tier);

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
          message = `API-Zugriff ist im ${tier === 'free' ? 'Free' : tier === 'starter' ? 'Starter' : 'Growth'} Paket nicht enthalten. Upgrade zu Agency erforderlich.`;
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
