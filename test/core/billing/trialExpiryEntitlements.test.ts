/**
 * Frontend-Entitlements spiegeln den Ablauf kartenloser Testphasen.
 *
 * Der Server (`tenant_entitlements_resolve`, 20260928160000) zählt `trialing`
 * nur bis `trial_end`. Das Frontend zählte jedes `trialing`-Abo als aktiv —
 * nach dem Beta-Ende (WP-3, `beta-enroll`) hätte die UI weiter Growth
 * angezeigt, während der Server längst Free lieferte.
 */
import { describe, expect, it } from 'vitest';
import { isTrialExpired, resolveEntitlements } from '../../../src/core/billing/entitlements';
import type { CurrentUsage, SubscriptionSnapshot, TenantContext } from '../../../src/core/billing/types';

const NOW = new Date('2027-02-01T12:00:00Z');
const USAGE: CurrentUsage = {
  activeAssets: 0,
  monthlyRegistrations: 0,
  apiCallsMonthly: 0,
  bulkJobsMonthly: 0,
  complianceExportsMonthly: 0,
};
const TENANT: TenantContext = {
  tenantId: 't-1',
  planKey: 'growth',
  roles: ['owner'],
  memberCount: 1,
  isPublicSector: false,
};

function sub(over: Partial<SubscriptionSnapshot>): SubscriptionSnapshot {
  return {
    customerId: '',
    subscriptionId: null,
    productId: null,
    priceId: null,
    planKey: 'growth',
    interval: 'month',
    status: 'active',
    quantity: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    trialEnd: null,
    addOns: [],
    ...over,
  };
}

const growthAktiv = resolveEntitlements(sub({}), TENANT, USAGE, NOW);
const frei = resolveEntitlements(sub({ planKey: 'free_audit', status: 'inactive' }), TENANT, USAGE, NOW);

describe('isTrialExpired', () => {
  it('erkennt nur trialing mit erreichtem Ende als abgelaufen', () => {
    expect(isTrialExpired({ status: 'trialing', trialEnd: '2027-01-31T23:00:00Z' }, NOW)).toBe(true);
    expect(isTrialExpired({ status: 'trialing', trialEnd: '2027-03-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isTrialExpired({ status: 'trialing', trialEnd: null }, NOW)).toBe(false);
    expect(isTrialExpired({ status: 'active', trialEnd: '2020-01-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isTrialExpired({ status: 'trialing', trialEnd: 'kein-datum' }, NOW)).toBe(false);
  });
});

describe('resolveEntitlements — Testphase', () => {
  it('Vorbedingung: Growth unterscheidet sich von der freien Stufe', () => {
    expect(growthAktiv.features).not.toEqual(frei.features);
  });

  it('gewährt während der Testphase den Growth-Umfang', () => {
    const d = resolveEntitlements(sub({ status: 'trialing', trialEnd: '2027-03-01T00:00:00Z' }), TENANT, USAGE, NOW);
    expect(d.features).toEqual(growthAktiv.features);
    expect(d.limits).toEqual(growthAktiv.limits);
    expect(d.planKey).toBe('growth');
  });

  it('fällt nach dem Ende auf die freie Stufe zurück (wie der Server)', () => {
    const d = resolveEntitlements(sub({ status: 'trialing', trialEnd: '2027-01-31T23:00:00Z' }), TENANT, USAGE, NOW);
    expect(d.features).toEqual(frei.features);
    expect(d.limits).toEqual(frei.limits);
    expect(d.planKey).toBe('free_audit');
    expect(d.trialEnd).toBe('2027-01-31T23:00:00Z');
  });

  it('lässt eine Testphase ohne gespeichertes Ende laufen (Stripe beendet per Status)', () => {
    const d = resolveEntitlements(sub({ status: 'trialing' }), TENANT, USAGE, NOW);
    expect(d.features).toEqual(growthAktiv.features);
  });
});
