import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export type TierId = 'free_tier' | 'starter' | 'growth' | 'agency' | 'scale' | 'enterprise';

export interface EntitlementValue {
  key: string;
  value: boolean | number;
  kind: 'boolean' | 'limit';
}

export interface UserEntitlements {
  tier: TierId;
  loading: boolean;
  error?: string;
  features: Record<string, boolean | number>;
  hasFeature: (featureKey: string) => boolean;
  getLimit: (featureKey: string) => number | null;
  canAccess: (featureKey: string) => { allowed: boolean; upgradeUrl?: string };
}

// Spiegelt die free_tier-Zeilen aus 20260707010000_phase2_free_tier_setup.sql.
// Muss vollständig bleiben: fehlende Keys sperren im Dashboard Karten, die im
// Free-Tier tatsächlich freigeschaltet sind.
export const FREE_TIER_FALLBACK: EntitlementValue[] = [
  { key: 'dashboard.access',              value: 1, kind: 'boolean' },
  { key: 'website.scan',                  value: 1, kind: 'boolean' },
  { key: 'website.scan_monthly_limit',    value: 3, kind: 'limit'   },
  { key: 'evidence.basic_vault',          value: 1, kind: 'boolean' },
  { key: 'governance.dsgvo_directory',    value: 1, kind: 'boolean' },
  { key: 'governance.ai_register',        value: 1, kind: 'boolean' },
  { key: 'reports.export',                value: 0, kind: 'boolean' },
  { key: 'ai_classification.limited',     value: 0, kind: 'boolean' },
  { key: 'bots.count',                    value: 0, kind: 'limit'   },
];

/**
 * Leitet den Plan aus den Entitlements ab. Betrachtet nur Keys, die
 * Free-Tier laut Migration *nicht* aktiv hat. `evidence.basic_vault` taugt
 * dafür nicht — das ist auch im Free-Tier aktiv.
 * This will be improved once subscription.plan_key is available.
 */
export function inferTier(entitlements: EntitlementValue[]): TierId {
  if (!entitlements.length) return 'free_tier';
  const on = (key: string) =>
    entitlements.some((e) => e.key === key && (e.value === true || (e.value as number) > 0));

  if (on('bots.count')) return 'agency'; // Bots only in agency+
  if (on('ai_classification.limited')) return 'growth';
  if (on('reports.export')) return 'starter';
  return 'free_tier';
}

const CACHE_TTL_MS = 60000; // 60 seconds
let cacheKey = '';
let cacheData: EntitlementValue[] | null = null;
let cacheTimestamp = 0;

export function useEntitlements(): UserEntitlements {
  const { activeTenantId } = useTenant();
  const [entitlements, setEntitlements] = useState<EntitlementValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const fetchEntitlements = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    // Check cache
    if (cacheKey === activeTenantId && cacheData && now - cacheTimestamp < CACHE_TTL_MS) {
      setEntitlements(cacheData);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();
      const { data, error: rpcError } = await supabase.rpc('tenant_entitlements', {
        p_tenant_id: activeTenantId,
      });

      if (rpcError) {
        console.error('Failed to fetch entitlements:', rpcError);
        setEntitlements(FREE_TIER_FALLBACK);
        setError('Failed to load entitlements; reverting to free tier');
      } else {
        const ents = data || [];
        setEntitlements(ents);
        cacheKey = activeTenantId;
        cacheData = ents;
        cacheTimestamp = now;
        setError(undefined);
      }
    } catch (e) {
      console.error('Error fetching entitlements:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
      setEntitlements([]);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  // Determine tier from entitlements or subscription
  const tier: TierId = inferTier(entitlements);

  // Convert flat entitlements array to feature flags object
  const features = entitlements.reduce(
    (acc, ent) => {
      acc[ent.key] = ent.value;
      return acc;
    },
    {} as Record<string, boolean | number>
  );

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      const val = features[featureKey];
      return val === true || (typeof val === 'number' && val > 0);
    },
    [features]
  );

  const getLimit = useCallback(
    (featureKey: string): number | null => {
      const val = features[featureKey];
      if (typeof val === 'number') return val;
      return null;
    },
    [features]
  );

  const canAccess = useCallback(
    (featureKey: string): { allowed: boolean; upgradeUrl?: string } => {
      const allowed = hasFeature(featureKey);
      if (!allowed) {
        // Suggest upgrade to next tier
        const upgradeMap: Record<TierId, string> = {
          free_tier: '/checkout/starter?return=/app/dashboard',
          starter: '/checkout/growth?return=/app/dashboard',
          growth: '/checkout/agency?return=/app/dashboard',
          agency: '/checkout/scale?return=/app/dashboard',
          scale: '/contact-sales?tier=enterprise&source=feature-upgrade',
          enterprise: '',
        };
        return {
          allowed: false,
          upgradeUrl: upgradeMap[tier],
        };
      }
      return { allowed: true };
    },
    [tier, hasFeature]
  );

  return {
    tier,
    loading,
    error,
    features,
    hasFeature,
    getLimit,
    canAccess,
  };
}
