/**
 * planAccess — Single-Source Feature-Matrix fuer die kommerziellen Tiers.
 *
 * Diese Datei ist absichtlich getrennt von `src/core/auth/entitlements.ts`
 * (das eine aeltere bronze/silver/gold/platinum-Hierarchie modelliert).
 * `planAccess` bedient die in `src/config/pricing.ts` definierten
 * SaaS-Tiers (free/starter/growth/agency/scale/enterprise) und liefert
 * eine direkte, zentrale Feature-Pruefung — ohne in jeder UI-Komponente
 * Strings hartzucodieren.
 *
 * Verwendung:
 *   import { hasFeature, getActivePlanForTenant, requireFeature } from '...';
 *
 *   if (hasFeature(plan, 'daily_monitoring')) { ... }
 *   const plan = await getActivePlanForTenant(tenantId);
 *   requireFeature(plan, 'multi_tenant'); // wirft, wenn kein Zugriff
 */

import { getSupabase } from '../supabase';
import type { TierId } from '../../config/pricing';

export type PlanKey = TierId;

export type FeatureKey =
  // free
  | 'one_time_scan'
  // starter
  | 'monthly_scan'
  | 'dse_generator'
  | 'basic_alerts'
  // growth
  | 'daily_monitoring'
  | 'drift_detection'
  | 'fix_snippets'
  | 'ai_governance_basic'
  // agency
  | 'multi_tenant'
  | 'white_label_reports'
  | 'api_webhooks'
  | 'ten_domains'
  // scale
  | 'fifty_clients'
  | 'custom_subdomain'
  | 'white_label_dashboard'
  // enterprise
  | 'dedicated_runtime'
  | 'sla'
  | 'evidence_vault'
  | 'custom_policies';

/**
 * Feature-Matrix: pro Plan die direkt verfuegbaren Features.
 * Tier-Inheritance (Growth bekommt automatisch Starter-Features) wird
 * durch `PLAN_INHERITANCE` aufgeloest, NICHT hier dupliziert. So bleibt
 * die Matrix lesbar und stale-Duplikate werden vermieden.
 */
const PLAN_DIRECT_FEATURES: Record<PlanKey, FeatureKey[]> = {
  free: [
    'one_time_scan',
  ],
  starter: [
    'monthly_scan',
    'dse_generator',
    'basic_alerts',
  ],
  growth: [
    'daily_monitoring',
    'drift_detection',
    'fix_snippets',
    'ai_governance_basic',
  ],
  agency: [
    'multi_tenant',
    'white_label_reports',
    'api_webhooks',
    'ten_domains',
  ],
  scale: [
    'fifty_clients',
    'custom_subdomain',
    'white_label_dashboard',
  ],
  enterprise: [
    'dedicated_runtime',
    'sla',
    'evidence_vault',
    'custom_policies',
  ],
};

/**
 * Tier-Inheritance — jedes hoehere Tier inkludiert die Features des
 * direkt darunter liegenden. So bleibt die Matrix DRY und additiv.
 *
 * Hinweis: `free` ist absichtlich kein Sub-Tier von `starter` — Free
 * erlaubt NUR den one_time_scan, niemals monthly_scan & Co.
 */
const PLAN_INHERITANCE: Record<PlanKey, PlanKey | null> = {
  free:       null,
  starter:    null,
  growth:     'starter',
  agency:     'growth',
  scale:      'agency',
  enterprise: 'agency',
};

/**
 * Berechnet die volle effektive Feature-Menge fuer einen Plan,
 * inklusive geerbter Features.
 */
export function featuresForPlan(plan: PlanKey): Set<FeatureKey> {
  const features = new Set<FeatureKey>();
  let cursor: PlanKey | null = plan;
  const visited = new Set<PlanKey>();
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    for (const feature of PLAN_DIRECT_FEATURES[cursor]) {
      features.add(feature);
    }
    cursor = PLAN_INHERITANCE[cursor];
  }
  return features;
}

/**
 * Hat der Plan Zugriff auf das Feature?
 * `null`/`undefined` Plan → kein Zugriff (defensiv).
 */
export function hasFeature(plan: PlanKey | null | undefined, feature: FeatureKey): boolean {
  if (!plan) return false;
  return featuresForPlan(plan).has(feature);
}

/**
 * Erzwingt das Feature — wirft, wenn der Plan keinen Zugriff hat.
 * Aufrufer ist verantwortlich fuer User-freundliche Fehlerbehandlung.
 */
export function requireFeature(plan: PlanKey | null | undefined, feature: FeatureKey): void {
  if (!hasFeature(plan, feature)) {
    throw new PlanAccessError(plan ?? 'unknown', feature);
  }
}

export class PlanAccessError extends Error {
  constructor(public plan: string, public feature: FeatureKey) {
    super(`plan "${plan}" has no access to feature "${feature}"`);
    this.name = 'PlanAccessError';
  }
}

/**
 * Aktiver Plan fuer einen Tenant via Supabase `subscriptions`-Tabelle.
 * Liefert `null`, wenn keine aktive Subscription vorhanden ist —
 * Aufrufer behandelt das als „free" (oder zeigt Upgrade-CTA).
 *
 * „aktiv" = status in ('trialing', 'active') ohne `cancel_at_period_end`
 * nach `current_period_end`. Wir vertrauen darauf, dass der Stripe-Webhook
 * die Tabelle aktuell haelt.
 */
export async function getActivePlanForTenant(tenantId: string): Promise<PlanKey | null> {
  if (!tenantId) return null;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('subscriptions')
    .select('plan_key, status, cancel_at_period_end, current_period_end')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  if (data.status !== 'active' && data.status !== 'trialing') return null;
  const planKey = data.plan_key as PlanKey | undefined;
  if (!planKey) return null;
  // Validate planKey is one of the known tiers.
  if (!(planKey in PLAN_INHERITANCE)) return null;
  return planKey;
}
