export const FOUNDING_ACCESS_LIMIT = 100;
export const FOUNDING_ACCESS_FREE_UNTIL = '2026-08-02';

const HARD_LIMIT_ISO = `${FOUNDING_ACCESS_FREE_UNTIL}T23:59:59.999Z`;

export function calculateFounderAccessExpiry(startDate: Date = new Date()): Date {
  const expires = new Date(startDate);
  expires.setDate(expires.getDate() + 14);
  const hardLimit = new Date(HARD_LIMIT_ISO);
  return expires > hardLimit ? hardLimit : expires;
}

export function isFounderAccessAvailable(currentCount: number, now: Date = new Date()): boolean {
  const hardLimit = new Date(HARD_LIMIT_ISO);
  return currentCount < FOUNDING_ACCESS_LIMIT && now <= hardLimit;
}

export function getRemainingFounderSlots(currentCount: number): number {
  return Math.max(FOUNDING_ACCESS_LIMIT - currentCount, 0);
}
