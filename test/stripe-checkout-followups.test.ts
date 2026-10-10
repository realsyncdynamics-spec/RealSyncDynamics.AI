import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  isTrialEligibleForCheckout,
  customerIdempotencyKey,
  customerSearchQuery,
  STRIPE_ERROR_PUBLIC_MESSAGE,
} from '../supabase/functions/stripe-checkout/customer';

const T = '11111111-2222-3333-4444-555555555555';
const src = readFileSync('supabase/functions/stripe-checkout/index.ts', 'utf8');

describe('stripe-checkout Folge-Fixes', () => {
  it('echte cus_-ID + Trial-Historie → keine Testphase, auch bei Free-plan_key', () => {
    expect(isTrialEligibleForCheckout({
      stripe_customer_id: 'cus_X', plan_key: 'free_audit', status: 'active', trial_end: '2026-01-01T00:00:00Z',
    })).toBe(false);
    expect(isTrialEligibleForCheckout({
      stripe_customer_id: 'cus_X', plan_key: 'free_audit', status: 'canceled', trial_ends_at: '2026-01-01T00:00:00Z',
    })).toBe(false);
  });

  it('Platzhalter-Customer mit Trial-Feld bleibt trial-berechtigt (Free-Zeile)', () => {
    expect(isTrialEligibleForCheckout({
      stripe_customer_id: `free_tier_no_stripe_${T}`, plan_key: 'free_audit', status: 'active', trial_end: null,
    })).toBe(true);
  });

  it('echte cus_-ID auf Free-Plan ohne Trial-Historie → berechtigt', () => {
    expect(isTrialEligibleForCheckout({ stripe_customer_id: 'cus_X', plan_key: 'free_audit', status: 'active' })).toBe(true);
  });

  it('Idempotency-Key ist deterministisch und tenant-/nutzerbasiert', () => {
    expect(customerIdempotencyKey(T, 'u1')).toBe(customerIdempotencyKey(T, 'u1'));
    expect(customerIdempotencyKey(T, 'u1')).not.toBe(customerIdempotencyKey(T, 'u2'));
    expect(customerIdempotencyKey(T, 'u1')).toContain(T);
  });

  it('Search-Query ist auf den Mandanten begrenzt und escaped', () => {
    expect(customerSearchQuery(T)).toBe(`metadata['tenant_id']:'${T}'`);
    expect(customerSearchQuery("x' OR '1")).toBe("metadata['tenant_id']:'xOR1'");
  });

  it('index.ts: feste Sortierung, Idempotency, generische Fehlermeldung', () => {
    expect(src).toMatch(/\.order\('updated_at', \{ ascending: false/);
    expect(src).toContain('idempotencyKey: customerIdempotencyKey(');
    expect(src).toContain("jsonError(502, 'STRIPE_ERROR', STRIPE_ERROR_PUBLIC_MESSAGE)");
    expect(src).not.toMatch(/stripe checkout failed: \$\{/);
    expect(STRIPE_ERROR_PUBLIC_MESSAGE).not.toMatch(/stripe/i);
  });
});
