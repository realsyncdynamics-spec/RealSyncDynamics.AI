// Reine Hilfsfunktionen (ohne Deno-/npm-Imports), damit sie auch in vitest
// geprüft werden können.
import { normalizePlanKey } from '../_shared/pricing.generated.ts';

/**
 * Free-Plan: `free_audit` sowie der Legacy-Key free_tier (über die
 * Alias-Tabelle der Pricing-SSoT auf `free_audit` normalisiert).
 */
export function isFreePlanKey(planKey: string | null | undefined): boolean {
  return normalizePlanKey(planKey) === 'free_audit';
}

/**
 * Echte Stripe-Customer-IDs beginnen mit `cus_`. Die Migration
 * 20260802000000_fix_free_tier_entitlements.sql schreibt für Free-Tenants den
 * Platzhalter `free_tier_no_stripe_<tenant_id>` — den lehnt Stripe ab.
 */
export function isRealStripeCustomerId(id: string | null | undefined): id is string {
  return typeof id === 'string' && id.startsWith('cus_');
}

export interface ExistingSubRow {
  stripe_customer_id?: string | null;
  plan_key?: string | null;
  status?: string | null;
  trial_end?: string | null;
  trial_ends_at?: string | null;
}

/** Zählt die Zeile als echtes (ehemaliges) Stripe-Abo? Free-/Platzhalter-Zeilen nicht. */
export function isRealSubscriptionRow(row: ExistingSubRow | null | undefined): row is ExistingSubRow {
  if (!row) return false;
  if (isFreePlanKey(row.plan_key)) return false;
  return isRealStripeCustomerId(row.stripe_customer_id);
}

const LIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due']);

/** Eine Testphase pro Mandant; Free-/Platzhalter-Zeilen verbrauchen sie nicht. */
export function isTrialEligibleForCheckout(row: ExistingSubRow | null | undefined): boolean {
  if (!isRealSubscriptionRow(row)) return true;
  const hadTrial = Boolean(row.trial_end || row.trial_ends_at);
  const hasLive = LIVE_SUBSCRIPTION_STATES.has(row.status ?? '');
  return !hadTrial && !hasLive;
}
