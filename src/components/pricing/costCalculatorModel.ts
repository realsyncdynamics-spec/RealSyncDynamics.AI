/**
 * Rechenmodell des Kostenkalkulators auf /pricing.
 *
 * Bewusst ohne geschätzte Effizienzwerte je Plan: Wie viel Aufwand
 * Automatisierung tatsächlich übernimmt, ist nicht gemessen. Der Anteil ist
 * deshalb eine sichtbare Annahme, die der Nutzer selbst einstellt — für alle
 * Pläne derselbe Wert. Die Ersparnis bezieht sich immer auf die eingegebenen
 * Kosten und kann sie per Konstruktion nicht übersteigen.
 */

export type ReviewFrequency = 'monthly' | 'quarterly' | 'annual';

export const REVIEWS_PER_YEAR: Record<ReviewFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  annual: 1,
};

/** Annahme: Prüfaufwand je Website und Review in Stunden. */
export const HOURS_PER_WEBSITE_PER_REVIEW = 3;

/** Grenzen und Startwert für den angenommenen Automatisierungsanteil. */
export const AUTOMATION_SHARE_MIN = 0;
export const AUTOMATION_SHARE_MAX = 0.8;
export const AUTOMATION_SHARE_DEFAULT = 0.3;

export interface ManualEffortInput {
  websites: number;
  reviewFrequency: ReviewFrequency;
  hourlyRate: number;
}

export interface ManualEffort {
  hoursPerYear: number;
  costPerYear: number;
  costPerMonth: number;
}

export function computeManualEffort(input: ManualEffortInput): ManualEffort {
  const websites = Math.max(0, input.websites);
  const hourlyRate = Math.max(0, input.hourlyRate);
  const hoursPerYear =
    websites * HOURS_PER_WEBSITE_PER_REVIEW * REVIEWS_PER_YEAR[input.reviewFrequency];
  const costPerYear = hoursPerYear * hourlyRate;
  return { hoursPerYear, costPerYear, costPerMonth: costPerYear / 12 };
}

export function clampAutomationShare(share: number): number {
  if (!Number.isFinite(share)) return AUTOMATION_SHARE_DEFAULT;
  return Math.min(AUTOMATION_SHARE_MAX, Math.max(AUTOMATION_SHARE_MIN, share));
}

export interface PlanComparison {
  /** Bisherige Kosten, die bei der angenommenen Automatisierung entfallen. */
  avoidedCostPerYear: number;
  /** Planpreis pro Jahr (Monatspreis × 12). */
  planCostPerYear: number;
  /** Entfallene Kosten minus Planpreis. Negativ = Mehrkosten. */
  netSavingsPerYear: number;
  /** Nettoersparnis in Prozent der bisherigen Kosten (gerundet, ≤ 100). */
  netSavingsPercent: number;
}

export function comparePlan(
  manualCostPerYear: number,
  automationShare: number,
  planMonthlyEur: number,
): PlanComparison {
  const manual = Math.max(0, manualCostPerYear);
  const share = clampAutomationShare(automationShare);
  const avoidedCostPerYear = manual * share;
  const planCostPerYear = Math.max(0, planMonthlyEur) * 12;
  const netSavingsPerYear = avoidedCostPerYear - planCostPerYear;
  const netSavingsPercent = manual > 0 ? Math.round((netSavingsPerYear / manual) * 100) : 0;
  return { avoidedCostPerYear, planCostPerYear, netSavingsPerYear, netSavingsPercent };
}

const DE_NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export function formatDe(value: number): string {
  return DE_NUMBER.format(Math.round(value));
}
