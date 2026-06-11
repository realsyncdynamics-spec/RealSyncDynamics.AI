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
