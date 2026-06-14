import { describe, expect, it } from 'vitest';
import { getTrialStatus } from '../../../src/core/billing/trial';
import type { EntitlementDecision } from '../../../src/core/billing/types';

const baseDecision: EntitlementDecision = {
  planKey: 'silver',
  status: 'trialing',
  isActive: true,
  features: {} as EntitlementDecision['features'],
  limits: {} as EntitlementDecision['limits'],
  seatsAllowed: null,
  trialEnd: null,
  overages: {
    seatsExceeded: false,
    assetsExceeded: false,
    apiExceeded: false,
    bulkJobsExceeded: false,
  },
};

const NOW = new Date('2026-06-11T12:00:00Z');

describe('getTrialStatus', () => {
  it('returns null when status is not trialing', () => {
    const decision = { ...baseDecision, status: 'active' as const, trialEnd: '2026-06-20T00:00:00Z' };
    expect(getTrialStatus(decision, NOW)).toBeNull();
  });

  it('returns null when trialEnd is missing', () => {
    const decision = { ...baseDecision, trialEnd: null };
    expect(getTrialStatus(decision, NOW)).toBeNull();
  });

  it('computes days remaining and endingSoon=false when trial ends in 10 days', () => {
    const decision = { ...baseDecision, trialEnd: '2026-06-21T12:00:00Z' };
    const status = getTrialStatus(decision, NOW);
    expect(status).not.toBeNull();
    expect(status!.daysRemaining).toBe(10);
    expect(status!.endingSoon).toBe(false);
  });

  it('marks endingSoon=true when trial ends within 3 days', () => {
    const decision = { ...baseDecision, trialEnd: '2026-06-13T12:00:00Z' };
    const status = getTrialStatus(decision, NOW);
    expect(status!.daysRemaining).toBe(2);
    expect(status!.endingSoon).toBe(true);
  });

  it('marks endingSoon=true and daysRemaining<=0 when trial already ended', () => {
    const decision = { ...baseDecision, trialEnd: '2026-06-10T12:00:00Z' };
    const status = getTrialStatus(decision, NOW);
    expect(status!.daysRemaining).toBe(-1);
    expect(status!.endingSoon).toBe(true);
  });
});
