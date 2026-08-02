import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  PLAN_ORDER,
  checkoutHrefForPlan,
  planById,
  resolvePlan,
  type PlanId,
} from '@/shared/pricing';

/**
 * Plan-Bezeichner — identisch mit der Pricing-SSoT.
 *
 * Früher führte diese Datei eine eigene Tier-Union mit `free_tier` und
 * `scale` sowie eine eigene Upgrade-Reihenfolge, die Enterprise übersprang.
 * Beides ist entfallen: Reihenfolge und Ziele kommen jetzt aus
 * `shared/pricing.ts`.
 */
export type TierId = PlanId;

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

interface CacheEntry {
  entitlements: EntitlementValue[];
  planId: PlanId;
}

const CACHE_TTL_MS = 60000; // 60 Sekunden
let cacheKey = '';
let cacheData: CacheEntry | null = null;
let cacheTimestamp = 0;

/**
 * Nächsthöherer Plan in kanonischer Reihenfolge — Basis für Upgrade-CTAs.
 * `null`, wenn der Kunde bereits im höchsten Plan ist.
 */
function nextPlanAfter(current: PlanId): PlanId | null {
  const index = PLAN_ORDER.indexOf(current);
  if (index < 0 || index >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[index + 1];
}

export function useEntitlements(): UserEntitlements {
  const { activeTenantId } = useTenant();
  const [entitlements, setEntitlements] = useState<EntitlementValue[]>([]);
  const [planId, setPlanId] = useState<PlanId>('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const fetchEntitlements = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const now = Date.now();
    if (cacheKey === activeTenantId && cacheData && now - cacheTimestamp < CACHE_TTL_MS) {
      setEntitlements(cacheData.entitlements);
      setPlanId(cacheData.planId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabase();

      // Der Plan ist die maßgebliche Quelle; die Entitlements liefern die
      // aufgelösten Einzelwerte. Beide werden gemeinsam geladen, damit der
      // Plan nicht mehr heuristisch aus Feature-Flags erraten werden muss.
      const [entitlementsResult, subscriptionResult] = await Promise.all([
        supabase.rpc('tenant_entitlements', { p_tenant_id: activeTenantId }),
        supabase
          .from('subscriptions')
          .select('plan_key, status')
          .eq('tenant_id', activeTenantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Altdaten mit `scale` werden über resolvePlan() auf `partner` abgebildet.
      const subscription = subscriptionResult.data;
      const active = subscription?.status === 'active' || subscription?.status === 'trialing';
      const resolvedPlan = active ? resolvePlan(subscription?.plan_key) : null;
      const nextPlanId: PlanId = resolvedPlan?.id ?? 'free';

      if (entitlementsResult.error) {
        console.error('Failed to fetch entitlements:', entitlementsResult.error);
        setEntitlements([]);
        setPlanId('free');
        setError('Failed to load entitlements; reverting to free plan');
        return;
      }

      const ents = (entitlementsResult.data || []) as EntitlementValue[];
      setEntitlements(ents);
      setPlanId(nextPlanId);
      cacheKey = activeTenantId;
      cacheData = { entitlements: ents, planId: nextPlanId };
      cacheTimestamp = now;
      setError(undefined);
    } catch (e) {
      console.error('Error fetching entitlements:', e);
      setError(e instanceof Error ? e.message : 'Unknown error');
      setEntitlements([]);
      setPlanId('free');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  const features = entitlements.reduce(
    (acc, ent) => {
      acc[ent.key] = ent.value;
      return acc;
    },
    {} as Record<string, boolean | number>,
  );

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      const val = features[featureKey];
      return val === true || (typeof val === 'number' && val > 0);
    },
    [features],
  );

  const getLimit = useCallback(
    (featureKey: string): number | null => {
      const val = features[featureKey];
      if (typeof val === 'number') return val;
      return null;
    },
    [features],
  );

  const canAccess = useCallback(
    (featureKey: string): { allowed: boolean; upgradeUrl?: string } => {
      if (hasFeature(featureKey)) return { allowed: true };

      // Upgrade-Ziel folgt der kanonischen Plan-Reihenfolge — kein
      // handgepflegtes Mapping, das Enterprise überspringen könnte.
      const next = nextPlanAfter(planId);
      return {
        allowed: false,
        upgradeUrl: next
          ? `${checkoutHrefForPlan(planById(next), { source: 'feature-upgrade' })}&return=/app/dashboard`
          : undefined,
      };
    },
    [planId, hasFeature],
  );

  return {
    tier: planId,
    loading,
    error,
    features,
    hasFeature,
    getLimit,
    canAccess,
  };
}
