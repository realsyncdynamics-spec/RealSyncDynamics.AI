import { describe, expect, it } from 'vitest';
import { getFreeAccessReason, getTrialStatus, isTrialEligible } from '../../../src/core/billing/trial';
import type { EntitlementDecision } from '../../../src/core/billing/types';

const baseDecision: EntitlementDecision = {
  planKey: 'growth',
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

describe('getFreeAccessReason', () => {
  it('free_audit ohne Testphase ist der kostenlose Zugang', () => {
    const decision = { ...baseDecision, planKey: 'free_audit' as const, status: 'inactive' as const, isActive: false };
    expect(getFreeAccessReason(decision, NOW)).toBe('free_plan');
  });

  it('laufende Testphase ist kein kostenloser Zugang', () => {
    const decision = { ...baseDecision, trialEnd: '2026-06-21T12:00:00Z' };
    expect(getFreeAccessReason(decision, NOW)).toBeNull();
  });

  it('Testphase ohne Ende gilt als laufend', () => {
    expect(getFreeAccessReason({ ...baseDecision, trialEnd: null }, NOW)).toBeNull();
  });

  it('abgelaufene Testphase fällt auf den kostenlosen Zugang zurück', () => {
    const decision = { ...baseDecision, trialEnd: '2026-06-10T12:00:00Z' };
    expect(getFreeAccessReason(decision, NOW)).toBe('trial_expired');
  });

  it('bezahltes Abo ist kein kostenloser Zugang', () => {
    const decision = { ...baseDecision, status: 'active' as const };
    expect(getFreeAccessReason(decision, NOW)).toBeNull();
  });

  it('von Stripe beendete Testphase (canceled, trialEnd in der Vergangenheit) ist trial_expired', () => {
    const decision = { ...baseDecision, status: 'canceled' as const, isActive: false, trialEnd: '2026-06-10T12:00:00Z' };
    expect(getFreeAccessReason(decision, NOW)).toBe('trial_expired');
  });

  it('gekündigtes bezahltes Abo ohne Testphase ist kein kostenloser Zugang', () => {
    const decision = { ...baseDecision, status: 'canceled' as const, isActive: false, trialEnd: null };
    expect(getFreeAccessReason(decision, NOW)).toBeNull();
  });
});

describe('isTrialEligible', () => {
  it('frischer Mandant ohne Abo und ohne frühere Testphase ist berechtigt', () => {
    const decision = { ...baseDecision, planKey: 'free_audit' as const, status: 'inactive' as const, isActive: false, trialEnd: null };
    expect(isTrialEligible(decision)).toBe(true);
  });

  it('frühere Testphase schließt eine zweite aus', () => {
    const decision = { ...baseDecision, status: 'canceled' as const, isActive: false, trialEnd: '2026-06-10T12:00:00Z' };
    expect(isTrialEligible(decision)).toBe(false);
  });

  it('laufendes Abo (Upgrade) bekommt keine Testphase', () => {
    expect(isTrialEligible({ ...baseDecision, status: 'active' as const, trialEnd: null })).toBe(false);
    expect(isTrialEligible({ ...baseDecision, status: 'trialing' as const, trialEnd: '2026-06-21T12:00:00Z' })).toBe(false);
  });
});
