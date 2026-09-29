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
  // Kaufmodus statt Plan-Name (target-architecture §10): „kostenlos" ist
  // eine Eigenschaft des Katalogs, kein Vergleich gegen 'free_audit'.
  return planByKey(decision.planKey)?.purchaseMode === 'free' ? 'free_plan' : null;
}
