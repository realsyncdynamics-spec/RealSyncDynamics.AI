import { describe, it, expect } from 'vitest';
import {
  BETA_PROGRAM_DURATION_DAYS,
  BETA_PROGRAM_LIMIT,
  calculateBetaAccessExpiry,
  getRemainingBetaSlots,
  isBetaProgramAvailable,
} from '../../src/lib/enterprise-ai-os/beta-program';

describe('beta-program', () => {
  it('limit ist 5 Founding Beta Partner', () => {
    expect(BETA_PROGRAM_LIMIT).toBe(5);
  });

  it('Laufzeit beträgt 365 Tage', () => {
    expect(BETA_PROGRAM_DURATION_DAYS).toBe(365);
  });

  it('Ablauf wird 365 Tage in die Zukunft gesetzt', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const expiry = calculateBetaAccessExpiry(start);
    expect(expiry.toISOString()).toBe('2027-06-01T00:00:00.000Z');
  });

  it('isBetaProgramAvailable: unter Cap', () => {
    expect(isBetaProgramAvailable(0)).toBe(true);
    expect(isBetaProgramAvailable(4)).toBe(true);
  });

  it('isBetaProgramAvailable: bei Cap geblockt', () => {
    expect(isBetaProgramAvailable(BETA_PROGRAM_LIMIT)).toBe(false);
    expect(isBetaProgramAvailable(99)).toBe(false);
  });

  it('getRemainingBetaSlots klemmt bei 0', () => {
    expect(getRemainingBetaSlots(0)).toBe(BETA_PROGRAM_LIMIT);
    expect(getRemainingBetaSlots(BETA_PROGRAM_LIMIT)).toBe(0);
    expect(getRemainingBetaSlots(99)).toBe(0);
  });
});
