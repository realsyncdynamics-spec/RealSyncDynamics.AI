import { useEffect, useState, useCallback } from 'react';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  PLAN_ORDER,
  checkoutHrefForPlan,
  graceDaysRemaining,
  planById,
  resolvePlan,
  subscriptionGrantsPaidAccess,
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

/**
 * Zahlungszustand des Mandanten — rein zur Anzeige.
 *
 * Freischalten tut das nichts: Was ein Mandant darf, entscheidet
 * `tenant_entitlements()` auf dem Server. Die Oberflaeche darf damit nur
 * sichtbar machen, dass eine Zahlung fehlgeschlagen ist und wie lange die
 * Frist noch laeuft.
 */
export interface PaymentState {
  status: string | null;
  pastDueSince: string | null;
  /** Verbleibende Tage der Grace Period; `null` = keine Frist im Gange. */
  graceDaysRemaining: number | null;
}

export interface UserEntitlements {
  tier: TierId;
  loading: boolean;
  error?: string;
  paymentState: PaymentState;
  features: Record<string, boolean | number>;
  hasFeature: (featureKey: string) => boolean;
  getLimit: (featureKey: string) => number | null;
  canAccess: (featureKey: string) => { allowed: boolean; upgradeUrl?: string };
}

interface CacheEntry {
  entitlements: EntitlementValue[];
  planId: PlanId;
}

// Spiegelt die free_tier-Zeilen aus 20260707010000_phase2_free_tier_setup.sql.
// Muss vollständig bleiben: fehlende Keys sperren im Dashboard Karten, die im
// Free-Plan tatsächlich freigeschaltet sind.
export const FREE_TIER_FALLBACK: EntitlementValue[] = [
  { key: 'dashboard.access',              value: 1, kind: 'boolean' },
  { key: 'website.scan',                  value: 1, kind: 'boolean' },
  // Unbegrenzt: Scans sind seit dem 2026-08-24 in jedem Plan kostenlos.
  { key: 'website.scan_monthly_limit',    value: -1, kind: 'limit'  },
  { key: 'evidence.basic_vault',          value: 1, kind: 'boolean' },
  { key: 'governance.dsgvo_directory',    value: 1, kind: 'boolean' },
  { key: 'governance.ai_register',        value: 1, kind: 'boolean' },
  { key: 'reports.export',                value: 0, kind: 'boolean' },
  { key: 'ai_classification.limited',     value: 0, kind: 'boolean' },
  { key: 'bots.count',                    value: 0, kind: 'limit'   },
];

/**
 * Leitet den Plan aus den Entitlements ab — der Rückfallweg, wenn keine
 * aktive Subscription existiert. Betrachtet nur Keys, die der Free-Plan laut
 * Migration *nicht* aktiv hat; `evidence.basic_vault` taugt dafür nicht, das
 * ist auch im Free-Plan aktiv.
 *
 * Die maßgebliche Quelle ist `subscriptions.plan_key` (siehe unten) — diese
 * Heuristik greift nur, solange dort nichts steht.
 */
export function inferTier(entitlements: EntitlementValue[]): TierId {
  if (!entitlements.length) return 'free';
  const on = (key: string) =>
    entitlements.some((e) => e.key === key && (e.value === true || (e.value as number) > 0));

  if (on('bots.count')) return 'agency';
  if (on('ai_classification.limited')) return 'growth';
  if (on('reports.export')) return 'starter';
  return 'free';
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
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: null, pastDueSince: null, graceDaysRemaining: null,
  });
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

      // `subscriptions.plan_key` ist die maßgebliche Quelle; die Entitlements
      // liefern die aufgelösten Einzelwerte. Beide werden gemeinsam geladen,
      // damit der Plan nicht mehr heuristisch erraten werden muss — die
      // Heuristik `inferTier()` bleibt nur als Rückfallweg für Tenants ohne
      // Subscription-Zeile.
      const [entitlementsResult, subscriptionResult] = await Promise.all([
        supabase.rpc('tenant_entitlements', { p_tenant_id: activeTenantId }),
        supabase
          .from('subscriptions')
          .select('plan_key, status, past_due_since')
          .eq('tenant_id', activeTenantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Altdaten mit `scale` werden über resolvePlan() auf `partner` abgebildet.
      const subscription = subscriptionResult.data;
      // Ein Abo im Zahlungsverzug traegt innerhalb der Grace Period weiterhin
      // alle Berechtigungen (AP4, Migration 20260829000000). Vorher galt hier
      // nur `active`/`trialing` — ein Kunde in der Frist waere dadurch im
      // Frontend auf die Heuristik zurueckgefallen, obwohl der Server ihm
      // vollen Zugriff gewaehrt. Die Anzeige folgt jetzt derselben Regel.
      const zahlungszustand: PaymentState = {
        status: (subscription?.status as string | null) ?? null,
        pastDueSince: (subscription?.past_due_since as string | null) ?? null,
        graceDaysRemaining: graceDaysRemaining(
          subscription?.status, subscription?.past_due_since, new Date()),
      };
      // Bewusst vor der Fehlerprüfung: Schlägt das Laden der Entitlements
      // fehl, soll der Kunde trotzdem sehen, dass eine Zahlung offen ist.
      setPaymentState(zahlungszustand);
      const active = subscriptionGrantsPaidAccess(
        subscription?.status, subscription?.past_due_since, new Date());
      const resolvedPlan = active ? resolvePlan(subscription?.plan_key) : null;

      if (entitlementsResult.error) {
        console.error('Failed to fetch entitlements:', entitlementsResult.error);
        // Nicht auf ein leeres Array zurückfallen: fehlende Keys sperren im
        // Dashboard Karten, die im Free-Plan tatsächlich freigeschaltet sind.
        setEntitlements(FREE_TIER_FALLBACK);
        setPlanId('free');
        setError('Failed to load entitlements; reverting to free plan');
        return;
      }

      const ents = (entitlementsResult.data || []) as EntitlementValue[];
      // Ohne aktive Subscription den Plan aus den Entitlements ableiten,
      // statt pauschal `free` anzunehmen — sonst verlieren Tenants, deren
      // Plan nur über Entitlements gesetzt ist, ihre Freischaltungen.
      const nextPlanId: PlanId = resolvedPlan?.id ?? inferTier(ents);
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
      // `-1` heißt unbegrenzt und gilt als gewährt — dieselbe Regel wie
      // `load-entitlements.ts` und der serverseitige Wächter. Vorher las
      // dieser Hook ein unbegrenztes Kontingent als „nicht vorhanden".
      return val === true || val === -1 || (typeof val === 'number' && val > 0);
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
    paymentState,
    features,
    hasFeature,
    getLimit,
    canAccess,
  };
}
