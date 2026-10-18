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
  /** `'beta'` = offene Beta (beta-enroll). Bleibt nach einem Kauf stehen. */
  source?: string | null;
  stripe_subscription_id?: string | null;
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

/** Stripe Checkout verlangt für `subscription_data.trial_end` mindestens 48 h Vorlauf. */
export const MIN_TRIAL_END_LEAD_MS = 48 * 60 * 60 * 1000;

export type CheckoutTrial =
  | { kind: 'days'; days: number }
  | { kind: 'until'; trialEndUnix: number }
  | { kind: 'none' };

/**
 * Testphase für eine neue Checkout-Session.
 *
 * Beta-Mandanten (Zeile von `beta-enroll`, noch ohne Stripe-Abo) behalten
 * beim Kauf ihre gewährte Laufzeit: Stripe rechnet erst ab dem Beta-Ende ab.
 * Ohne diese Weiche zählte die Beta-Zeile (kein `cus_`-Customer) als „nie
 * gekauft“ und bekam 14 Tage ab heute — der Webhook hätte das Beta-Ende in
 * derselben Zeile dann vorgezogen. Eine abgelaufene Beta ist eine verbrauchte
 * Testphase. Alle anderen: `trialDays` aus der SSoT, eine Testphase pro
 * Mandant. Spiegel für die Anzeige: `previewCheckoutTrial()` in
 * src/core/billing/trial.ts.
 */
export function checkoutTrialFor(
  row: ExistingSubRow | null | undefined,
  trialDays: number,
  now: Date,
): CheckoutTrial {
  if (row?.source === 'beta' && !row.stripe_subscription_id) {
    const end = Date.parse(row.trial_end ?? row.trial_ends_at ?? '');
    if (row.status === 'trialing' && Number.isFinite(end) && end - now.getTime() >= MIN_TRIAL_END_LEAD_MS) {
      return { kind: 'until', trialEndUnix: Math.floor(end / 1000) };
    }
    return { kind: 'none' };
  }
  return trialDays > 0 && isTrialEligibleForCheckout(row) ? { kind: 'days', days: trialDays } : { kind: 'none' };
}
