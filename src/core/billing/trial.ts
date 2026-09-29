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
  if (!decision.isActive && decision.trialEnd) {
    const end = new Date(decision.trialEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return 'trial_expired';
  }
  // Kaufmodus statt Plan-Name (target-architecture §10): „kostenlos" ist
  // eine Eigenschaft des Katalogs, kein Vergleich gegen 'free_audit'.
  return planByKey(decision.planKey)?.purchaseMode === 'free' ? 'free_plan' : null;
}

/** Abo-Zustände, die ein laufendes Vertragsverhältnis ausweisen. */
const LIVE_SUBSCRIPTION_STATES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/**
 * Darf dieser Mandant im Stripe-Checkout eine Testphase bekommen?
 *
 * Eine Testphase pro Mandant: Wer schon eine hatte (kartenlos oder über
 * Stripe, `trialEnd` gesetzt) oder ein laufendes Abo führt (Upgrade), zahlt
 * ab der ersten Abbuchung. Dieselbe Regel gilt serverseitig in
 * `stripe-checkout` gegen die Abo-Zeile — hier nur für die ehrliche Anzeige.
 */
export function isTrialEligible(decision: EntitlementDecision): boolean {
  if (LIVE_SUBSCRIPTION_STATES.has(decision.status)) return false;
  return !decision.trialEnd;
}
