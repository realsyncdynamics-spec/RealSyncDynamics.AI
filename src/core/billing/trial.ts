import { planByKey } from '@/shared/pricing';
import { EntitlementDecision } from './types';

export interface TrialStatus {
  /** Vollständige Tage bis Trial-Ende (kann negativ sein, wenn bereits abgelaufen). */
  daysRemaining: number;
  /** true, wenn das Trial-Ende innerhalb von 3 Tagen liegt (oder bereits vorbei ist). */
  endingSoon: boolean;
  trialEnd: string;
}

/**
 * Liefert den Trial-Status, wenn die Subscription gerade in Stripes
 * `trialing`-Status ist und ein `trial_end` gesetzt ist — sonst `null`.
 */
export function getTrialStatus(decision: EntitlementDecision, now: Date = new Date()): TrialStatus | null {
  if (decision.status !== 'trialing' || !decision.trialEnd) return null;

  const end = new Date(decision.trialEnd);
  if (Number.isNaN(end.getTime())) return null;

  const msRemaining = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

  return {
    daysRemaining,
    endingSoon: daysRemaining <= 3,
    trialEnd: decision.trialEnd,
  };
}

/** Abo-Zustände, die ein laufendes Vertragsverhältnis ausweisen. */
const LIVE_SUBSCRIPTION_STATES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/**
 * Warum ein Mandant gerade den dauerhaft kostenlosen Zugang nutzt — oder
 * `null`, wenn ein Abo bzw. eine laufende Testphase greift.
 *
 * Der kostenlose Zugang ist seit E-F6 (`.claude/os-funnel/PLAN.md`) ein
 * echter Kontozustand, kein Fehlerfall: Registrierung ohne Testphase landet
 * hier, und eine abgelaufene Testphase fällt hierher zurück. Das Dashboard
 * zeigt dafür einen eigenen Einstieg (Scan, Audit Center) statt nur
 * gesperrter Module.
 */
export type FreeAccessReason = 'free_plan' | 'trial_expired';

export function getFreeAccessReason(
  decision: EntitlementDecision,
  now: Date = new Date(),
): FreeAccessReason | null {
  if (decision.status === 'trialing') {
    const trial = getTrialStatus(decision, now);
    // Testphase ohne gespeichertes Ende: Stripe beendet sie per Status —
    // bis dahin gilt sie als laufend.
    return trial && trial.daysRemaining <= 0 ? 'trial_expired' : null;
  }
  // Stripe-Testphase, die ohne Zahlungsmethode auslief: Der Sync setzt den
  // Status auf canceled/unpaid, `trial_end` bleibt als Spur stehen. Ein
  // bezahltes Abo, das nie eine Testphase hatte, trägt kein `trial_end`.
  // Ein laufendes Vertragsverhältnis (z. B. `past_due` nach Umwandlung der
  // Testphase) behält `trial_end` ebenfalls — das ist kein Free-Rückfall.
  if (!decision.isActive && decision.trialEnd && !LIVE_SUBSCRIPTION_STATES.has(decision.status)) {
    const end = new Date(decision.trialEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return 'trial_expired';
  }
  // Kaufmodus statt Plan-Name (target-architecture §10): „kostenlos" ist
  // eine Eigenschaft des Katalogs, kein Vergleich gegen 'free_audit'.
  return planByKey(decision.planKey)?.purchaseMode === 'free' ? 'free_plan' : null;
}

/**
 * Darf dieser Mandant im Stripe-Checkout eine Testphase bekommen?
 *
 * Eine Testphase pro Mandant: Wer schon eine hatte (kartenlos oder über
 * Stripe, `trialEnd` gesetzt) oder ein laufendes Abo führt (Upgrade), zahlt
 * ab der ersten Abbuchung. Dieselbe Regel gilt serverseitig in
 * `stripe-checkout` gegen die Abo-Zeile — hier nur für die ehrliche Anzeige.
 */
export function isTrialEligible(decision: Pick<EntitlementDecision, 'planKey' | 'status' | 'trialEnd'>): boolean {
  // Wie `isRealSubscriptionRow()` in stripe-checkout: Die freie Stufe ist kein
  // laufendes Abo und keine verbrauchte Testphase. Ohne diese Weiche zeigte
  // der Checkout neuen Kunden (Free-Zeile mit `active`) „Abbuchung sofort“,
  // während Stripe die beworbenen 14 Tage gewährte.
  if (planByKey(decision.planKey)?.purchaseMode === 'free') return true;
  if (LIVE_SUBSCRIPTION_STATES.has(decision.status)) return false;
  return !decision.trialEnd;
}

/**
 * Vorlauf, den Stripe Checkout für ein festes Testphasen-Ende
 * (`subscription_data.trial_end`) mindestens verlangt: 48 Stunden.
 */
export const MIN_CHECKOUT_TRIAL_END_LEAD_MS = 48 * 60 * 60 * 1000;

export type CheckoutTrialPreview =
  | { kind: 'days'; days: number }
  | { kind: 'until'; trialEnd: string }
  | { kind: 'none' };

/**
 * Welche Testphase bekäme dieser Mandant im Stripe-Checkout?
 *
 * Beta-Mandanten behalten beim Kauf ihre gewährte Laufzeit: Stripe rechnet
 * erst ab dem Beta-Ende ab (`trial_end`), statt 14 Tage ab heute zu geben
 * oder sofort abzubuchen. Läuft die Beta in weniger als 48 Stunden aus oder
 * ist sie vorbei, gilt die Sofort-Abbuchung — die Testphase ist verbraucht.
 * Spiegel von `checkoutTrialFor()` in supabase/functions/stripe-checkout/customer.ts.
 */
export function previewCheckoutTrial(
  decision: Pick<EntitlementDecision, 'accountKind' | 'planKey' | 'status' | 'trialEnd'>,
  trialDays: number,
  now: Date = new Date(),
): CheckoutTrialPreview {
  if (decision.accountKind === 'beta') {
    const end = decision.trialEnd ? Date.parse(decision.trialEnd) : Number.NaN;
    const runsLongEnough =
      decision.status === 'trialing' && Number.isFinite(end) && end - now.getTime() >= MIN_CHECKOUT_TRIAL_END_LEAD_MS;
    return runsLongEnough ? { kind: 'until', trialEnd: decision.trialEnd! } : { kind: 'none' };
  }
  return trialDays > 0 && isTrialEligible(decision) ? { kind: 'days', days: trialDays } : { kind: 'none' };
}
