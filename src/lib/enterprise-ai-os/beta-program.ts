// Beta-Programm — der knappe Pitch parallel zum 100er-Founding-Access.
//
// 5 Founding Beta Partner, 12 Monate Enterprise-Zugang, im Gegenzug
// strukturiertes Feedback. Pure Funktionen, im Browser und in der
// Edge-Function gleich verwendbar.

export const BETA_PROGRAM_LIMIT = 5;
export const BETA_PROGRAM_DURATION_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calculateBetaAccessExpiry(startDate: Date = new Date()): Date {
  return new Date(startDate.getTime() + BETA_PROGRAM_DURATION_DAYS * MS_PER_DAY);
}

export function isBetaProgramAvailable(currentCount: number): boolean {
  return currentCount < BETA_PROGRAM_LIMIT;
}

export function getRemainingBetaSlots(currentCount: number): number {
  return Math.max(BETA_PROGRAM_LIMIT - currentCount, 0);
}
