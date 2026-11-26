/**
 * Einmalkauf per asynchroner Zahlart (SEPA-Lastschrift u. a.).
 *
 * `checkout.session.completed` meldet dabei `payment_status = 'unpaid'`, der
 * Grant wird `revoked` angelegt. Vor diesem Fix gab es keinen Handler für
 * `checkout.session.async_payment_succeeded` — der Kauf blieb trotz
 * Zahlungseingang ohne Rechte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decideOneTimeGrantStatus,
  isOneTimeGrantTrigger,
} from '../../supabase/functions/_shared/one-time-grant-status';

describe('decideOneTimeGrantStatus', () => {
  it('completed + paid → active', () => {
    expect(decideOneTimeGrantStatus('checkout.session.completed', 'paid', null)).toEqual({
      keepExisting: false,
      status: 'active',
      revokedReason: null,
    });
  });

  it('completed + unpaid (SEPA) → revoked mit Grund', () => {
    expect(decideOneTimeGrantStatus('checkout.session.completed', 'unpaid', null)).toEqual({
      keepExisting: false,
      status: 'revoked',
      revokedReason: 'payment_status=unpaid',
    });
  });

  it('async_payment_succeeded + paid → active (aus revoked)', () => {
    expect(
      decideOneTimeGrantStatus('checkout.session.async_payment_succeeded', 'paid', 'revoked'),
    ).toEqual({ keepExisting: false, status: 'active', revokedReason: null });
  });

  it('async_payment_failed → revoked, auch wenn der Grant aktiv war', () => {
    expect(
      decideOneTimeGrantStatus('checkout.session.async_payment_failed', 'unpaid', 'active'),
    ).toEqual({ keepExisting: false, status: 'revoked', revokedReason: 'async_payment_failed' });
  });

  it('verspäteter completed-Retry (unpaid) entzieht einen aktiven Grant nicht', () => {
    expect(decideOneTimeGrantStatus('checkout.session.completed', 'unpaid', 'active')).toEqual({
      keepExisting: true,
    });
  });

  it('fehlender payment_status → revoked mit "unknown"', () => {
    expect(decideOneTimeGrantStatus('checkout.session.completed', undefined, null)).toEqual({
      keepExisting: false,
      status: 'revoked',
      revokedReason: 'payment_status=unknown',
    });
  });

  it('erkennt genau die drei Checkout-Trigger', () => {
    expect(isOneTimeGrantTrigger('checkout.session.completed')).toBe(true);
    expect(isOneTimeGrantTrigger('checkout.session.async_payment_succeeded')).toBe(true);
    expect(isOneTimeGrantTrigger('checkout.session.async_payment_failed')).toBe(true);
    expect(isOneTimeGrantTrigger('checkout.session.expired')).toBe(false);
    expect(isOneTimeGrantTrigger('invoice.paid')).toBe(false);
  });
});

describe('stripe-webhook — Verdrahtung der Async-Events', () => {
  const src = readFileSync(
    resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'),
    'utf8',
  );

  it('behandelt async_payment_succeeded und async_payment_failed', () => {
    expect(src).toContain("case 'checkout.session.async_payment_succeeded':");
    expect(src).toContain("case 'checkout.session.async_payment_failed':");
  });

  it('übergibt den Event-Typ an recordOneTimePurchase', () => {
    expect(src).toMatch(/recordOneTimePurchase\(admin, stripe, session, event\.type\)/);
    expect(src).not.toMatch(/recordOneTimePurchase\(admin, stripe, session\);/);
  });

  it('leitet den Grant-Status aus decideOneTimeGrantStatus ab', () => {
    expect(src).toContain('decideOneTimeGrantStatus(trigger, session.payment_status, existingStatus)');
    expect(src).toContain('status: decision.status,');
    expect(src).toContain('revoked_reason: decision.revokedReason,');
  });
});
