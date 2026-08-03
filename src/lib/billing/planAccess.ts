/**
 * planAccess — Feature-Prüfung für die kommerziellen Pläne.
 *
 * ⚠️  Diese Datei führte früher eine eigene Feature-Matrix samt eigener
 *     Tier-Vererbung. Beides ist entfallen: Berechtigungen kommen jetzt
 *     ausschließlich aus `shared/pricing.ts` (`plan.permissions`,
 *     `plan.modules`, `plan.limits`).
 *
 * Verwendung:
 *   import { hasFeature, getActivePlanForTenant, requireFeature } from '...';
 *
 *   if (hasFeature(plan, 'daily_monitoring')) { ... }
 *   const plan = await getActivePlanForTenant(tenantId);
 *   requireFeature(plan, 'multi_tenant');
 */

import { getSupabase } from '../supabase';
import {
  resolvePlan,
  hasModule,
  hasPermission,
  limitOf,
  minimumPlanForModule,
  minimumPlanForPermission,
  planById,
  type ModuleId,
  type PermissionKey,
  type PlanId,
} from '@/shared/pricing';

/** Plan-Bezeichner — akzeptiert PlanId, Plan-Key und Altdaten. */
export type PlanKey = PlanId | string;

/**
 * Fachliche Feature-Schlüssel der Anwendung.
 * Jeder Schlüssel ist auf genau eine Modul- oder Berechtigungs-Abfrage der
 * SSoT abgebildet — es gibt keine zweite Wahrheit über Plan-Zugehörigkeit.
 */
export type FeatureKey =
  | 'one_time_scan'
  | 'monthly_scan'
  | 'dse_generator'
  | 'basic_alerts'
  | 'evidence_export'
  | 'daily_monitoring'
  | 'drift_detection'
  | 'fix_snippets'
  | 'ai_governance_basic'
  | 'multi_tenant'
  | 'white_label_reports'
  | 'api_webhooks'
  | 'scheduler'
  | 'bulk_jobs'
  | 'evidence_vault'
  | 'custom_policies'
  | 'provenance'
  | 'sso'
  | 'sla';

type FeatureRule =
  | { kind: 'module'; module: ModuleId }
  | { kind: 'permission'; permission: PermissionKey };

/**
 * Abbildung der fachlichen Feature-Schlüssel auf die SSoT.
 * Dies ist eine Übersetzungstabelle, KEINE Feature-Matrix — sie enthält
 * keine Plan-Namen und kann daher nicht von den Preisen abweichen.
 */
const FEATURE_RULES: Record<FeatureKey, FeatureRule> = {
  one_time_scan:       { kind: 'module', module: 'audit_center' },
  monthly_scan:        { kind: 'module', module: 'monitoring' },
  dse_generator:       { kind: 'module', module: 'dsgvo' },
  basic_alerts:        { kind: 'module', module: 'alerts' },
  evidence_export:     { kind: 'permission', permission: 'auditExport' },
  daily_monitoring:    { kind: 'module', module: 'drift_detection' },
  drift_detection:     { kind: 'module', module: 'drift_detection' },
  fix_snippets:        { kind: 'module', module: 'remediation' },
  ai_governance_basic: { kind: 'module', module: 'eu_ai_act' },
  multi_tenant:        { kind: 'permission', permission: 'multiTenant' },
  white_label_reports: { kind: 'permission', permission: 'whiteLabelReports' },
  api_webhooks:        { kind: 'permission', permission: 'api' },
  scheduler:           { kind: 'permission', permission: 'scheduler' },
  bulk_jobs:           { kind: 'permission', permission: 'bulkOperations' },
  evidence_vault:      { kind: 'permission', permission: 'evidenceVault' },
  custom_policies:     { kind: 'module', module: 'policy_engine' },
  provenance:          { kind: 'permission', permission: 'provenanceSigning' },
  sso:                 { kind: 'permission', permission: 'sso' },
  sla:                 { kind: 'permission', permission: 'prioritySupport' },
};

/**
 * Hat der Plan Zugriff auf das Feature?
 * `null`/`undefined` Plan → kein Zugriff (defensiv).
 */
export function hasFeature(plan: PlanKey | null | undefined, feature: FeatureKey): boolean {
  const resolved = resolvePlan(plan);
  if (!resolved) return false;
  const rule = FEATURE_RULES[feature];
  if (!rule) return false;
  return rule.kind === 'module'
    ? hasModule(resolved, rule.module)
    : hasPermission(resolved, rule.permission);
}

/** Die volle effektive Feature-Menge eines Plans. */
export function featuresForPlan(plan: PlanKey | null | undefined): Set<FeatureKey> {
  const features = new Set<FeatureKey>();
  for (const key of Object.keys(FEATURE_RULES) as FeatureKey[]) {
    if (hasFeature(plan, key)) features.add(key);
  }
  return features;
}

/** Niedrigster Plan, der das Feature enthält. */
export function minimumPlanForFeature(feature: FeatureKey): PlanId | null {
  const rule = FEATURE_RULES[feature];
  if (!rule) return null;
  return rule.kind === 'module'
    ? minimumPlanForModule(rule.module)
    : minimumPlanForPermission(rule.permission);
}

/**
 * Erzwingt das Feature — wirft, wenn der Plan keinen Zugriff hat.
 * Aufrufer ist verantwortlich für nutzerfreundliche Fehlerbehandlung.
 */
export function requireFeature(plan: PlanKey | null | undefined, feature: FeatureKey): void {
  if (!hasFeature(plan, feature)) {
    throw new PlanAccessError(plan ?? 'unknown', feature);
  }
}

export class PlanAccessError extends Error {
  /** Der niedrigste Plan, der das Feature freischaltet — für Upgrade-CTAs. */
  readonly requiredPlan: PlanId | null;

  constructor(public plan: string, public feature: FeatureKey) {
    const required = minimumPlanForFeature(feature);
    super(
      `plan "${plan}" has no access to feature "${feature}"` +
      (required ? ` (requires ${planById(required).name})` : ''),
    );
    this.name = 'PlanAccessError';
    this.requiredPlan = required;
  }
}

/** Limit-Abfrage über die SSoT — `-1` bedeutet unbegrenzt. */
export function planLimit(
  plan: PlanKey | null | undefined,
  limit: Parameters<typeof limitOf>[1],
): number {
  return limitOf(plan, limit);
}

/**
 * Aktiver Plan für einen Tenant via Supabase `subscriptions`-Tabelle.
 * Liefert `null`, wenn keine aktive Subscription vorhanden ist —
 * Aufrufer behandelt das als „free" (oder zeigt Upgrade-CTA).
 *
 * „aktiv" = status in ('trialing', 'active'). Wir vertrauen darauf, dass der
 * Stripe-Webhook die Tabelle aktuell hält.
 *
 * Bestandszeilen mit dem alten Plan-Key `scale` werden über
 * `resolvePlan()` transparent auf `partner` abgebildet.
 */
export async function getActivePlanForTenant(tenantId: string): Promise<PlanId | null> {
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
  return resolvePlan(data.plan_key as string | undefined)?.id ?? null;
}
