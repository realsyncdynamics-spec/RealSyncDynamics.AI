import { describe, it, expect } from 'vitest';
import {
  FOUNDING_ACCESS_FREE_UNTIL,
  FOUNDING_ACCESS_LIMIT,
  calculateFounderAccessExpiry,
  getRemainingFounderSlots,
  isFounderAccessAvailable,
} from '../../src/lib/enterprise-ai-os/founding-access';

describe('founding-access', () => {
  it('calculates a 14-day expiry by default', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const expiry = calculateFounderAccessExpiry(start);
    expect(expiry.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('caps expiry at the hard limit (2026-08-02)', () => {
    const start = new Date('2026-07-25T12:00:00Z');
    const expiry = calculateFounderAccessExpiry(start);
    expect(expiry.toISOString()).toBe(`${FOUNDING_ACCESS_FREE_UNTIL}T23:59:59.999Z`);
  });

  it('isFounderAccessAvailable: under cap and before deadline', () => {
    expect(isFounderAccessAvailable(0, new Date('2026-06-01T00:00:00Z'))).toBe(true);
    expect(isFounderAccessAvailable(99, new Date('2026-06-01T00:00:00Z'))).toBe(true);
  });

  it('isFounderAccessAvailable: blocks at limit', () => {
    expect(isFounderAccessAvailable(FOUNDING_ACCESS_LIMIT, new Date('2026-06-01'))).toBe(false);
    expect(isFounderAccessAvailable(101, new Date('2026-06-01'))).toBe(false);
  });

  it('isFounderAccessAvailable: blocks after deadline', () => {
    expect(isFounderAccessAvailable(0, new Date('2026-08-03T00:00:01Z'))).toBe(false);
  });

  it('getRemainingFounderSlots clamps at zero', () => {
    expect(getRemainingFounderSlots(0)).toBe(FOUNDING_ACCESS_LIMIT);
    expect(getRemainingFounderSlots(FOUNDING_ACCESS_LIMIT)).toBe(0);
    expect(getRemainingFounderSlots(FOUNDING_ACCESS_LIMIT + 5)).toBe(0);
  });
});
