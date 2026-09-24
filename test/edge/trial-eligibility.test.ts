import { describe, expect, it } from 'vitest';
import { decideTrial } from '../../supabase/functions/_shared/trialEligibility';

describe('decideTrial', () => {
  it('grants a starter checkout trial on first booking', () => {
    expect(decideTrial({
      trialDays: 14,
      purchaseMode: 'checkout',
      current: null,
      auditGrantExists: false,
    })).toEqual({ grant: true, days: 14 });
  });

  it('refuses agency because the plan has no self-service trial', () => {
    expect(decideTrial({
      trialDays: 0,
      purchaseMode: 'checkout',
      current: null,
      auditGrantExists: false,
    })).toEqual({ grant: false, reason: 'NO_TRIAL_ON_PLAN' });
  });

  it('refuses a tenant with a live subscription', () => {
    expect(decideTrial({
      trialDays: 14,
      purchaseMode: 'checkout',
      current: {
        status: 'active',
        plan_key: 'growth',
        trial_start: null,
        trial_end: '2026-10-01T00:00:00Z',
      },
      auditGrantExists: false,
    })).toEqual({ grant: false, reason: 'LIVE_SUBSCRIPTION' });
  });

  it('refuses when trial_start already exists on the subscription', () => {
    expect(decideTrial({
      trialDays: 14,
      purchaseMode: 'checkout',
      current: {
        status: 'canceled',
        plan_key: 'starter',
        trial_start: '2026-09-01T00:00:00Z',
        trial_end: '2026-09-15T00:00:00Z',
      },
      auditGrantExists: false,
    })).toEqual({ grant: false, reason: 'TRIAL_CONSUMED' });
  });

  it('refuses when an audit grant already exists', () => {
    expect(decideTrial({
      trialDays: 14,
      purchaseMode: 'checkout',
      current: null,
      auditGrantExists: true,
    })).toEqual({ grant: false, reason: 'TRIAL_CONSUMED' });
  });
});
