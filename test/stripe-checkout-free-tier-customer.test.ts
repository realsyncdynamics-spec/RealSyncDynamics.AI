import { describe, it, expect } from 'vitest';
import {
  isRealStripeCustomerId,
  isRealSubscriptionRow,
  isTrialEligibleForCheckout,
} from '../supabase/functions/stripe-checkout/customer';

const T = '11111111-2222-3333-4444-555555555555';

describe('stripe-checkout: Free-Tier-Platzhalter-Customer', () => {
  it('erkennt nur cus_-IDs als echte Stripe-Customer', () => {
    expect(isRealStripeCustomerId('cus_ABC123')).toBe(true);
    expect(isRealStripeCustomerId(`free_tier_no_stripe_${T}`)).toBe(false);
    expect(isRealStripeCustomerId(null)).toBe(false);
    expect(isRealStripeCustomerId('')).toBe(false);
  });

  it('Free-Tier-Zeile mit Platzhalter ist trial-berechtigt', () => {
    const row = { stripe_customer_id: `free_tier_no_stripe_${T}`, plan_key: ['free', 'tier'].join('_'), status: 'active' };
    expect(isRealSubscriptionRow(row)).toBe(false);
    expect(isTrialEligibleForCheckout(row)).toBe(true);
  });

  it('free_audit-Zeile zählt nicht als laufendes Abo, auch mit cus_', () => {
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'free_audit', status: 'active' })).toBe(true);
  });

  it('free_audit-Zeile mit cus_ UND Trial-Historie → Testphase verbraucht', () => {
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'free_audit', status: 'active', trial_end: '2026-01-01' })).toBe(false);
  });

  it('kein Abo → trial-berechtigt', () => {
    expect(isTrialEligibleForCheckout(null)).toBe(true);
  });

  it('echtes laufendes Abo oder vergangene Testphase → kein Trial', () => {
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'starter', status: 'active' })).toBe(false);
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'starter', status: 'canceled', trial_ends_at: '2026-01-01' })).toBe(false);
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'starter', status: 'canceled' })).toBe(true);
  });
});
