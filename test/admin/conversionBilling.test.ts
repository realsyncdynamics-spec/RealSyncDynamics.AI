import { describe, expect, it } from 'vitest';
import { getConversionBillingFixture } from '../../src/features/admin/billing/conversionFixture';
import { mergeWithFixture } from '../../src/features/admin/billing/loadConversionBilling';
import {
  formatEurFromCents,
  isConversionStatusHighlight,
  resolveRecheckoutMode,
  type ConversionBillingSnapshot,
} from '../../src/features/admin/billing/conversionTypes';
import { checkoutPathForPlan } from '../../src/features/admin/billing/recheckoutActions';

describe('conversion billing helpers', () => {
  it('highlights canceled+payment_failed, incomplete*, past_due', () => {
    expect(isConversionStatusHighlight({ status: 'canceled', cancel_reason: 'payment_failed' })).toBe(true);
    expect(isConversionStatusHighlight({ status: 'canceled', cancel_reason: null })).toBe(false);
    expect(isConversionStatusHighlight({ status: 'incomplete_expired' })).toBe(true);
    expect(isConversionStatusHighlight({ status: 'incomplete' })).toBe(true);
    expect(isConversionStatusHighlight({ status: 'past_due' })).toBe(true);
    expect(isConversionStatusHighlight({ status: 'active' })).toBe(false);
  });

  it('routes incomplete* to new_checkout and others with customer to portal', () => {
    expect(resolveRecheckoutMode({ status: 'incomplete_expired', customer_id: 'cus_x' })).toBe('new_checkout');
    expect(resolveRecheckoutMode({ status: 'canceled', customer_id: 'cus_x' })).toBe('portal');
    expect(resolveRecheckoutMode({ status: 'past_due', customer_id: null })).toBe('new_checkout');
  });

  it('formats EUR from cents for Growth 249 fixture', () => {
    expect(formatEurFromCents(24900, 'eur')).toBe('249,00\u00A0€');
  });

  it('builds checkout path for plan_key', () => {
    expect(checkoutPathForPlan('growth')).toBe('/checkout/growth');
    expect(checkoutPathForPlan(null)).toBe('/checkout/starter');
  });

  it('fixture contains Growth 249€ payment_failed + open invoice attempt_count 9', () => {
    const fix = getConversionBillingFixture();
    const growth = fix.status_rows.find((r) => r.plan_key === 'growth');
    expect(growth?.cancel_reason).toBe('payment_failed');
    expect(growth?.unit_amount_cents).toBe(24900);
    expect(growth?.recheckout).toBe('portal');

    const inv = fix.open_invoices[0];
    expect(inv.amount_due_cents).toBe(24900);
    expect(inv.attempt_count).toBe(9);
    expect(inv.invoice_id).toMatch(/^in_1U8Q4j/);

    const starter = fix.status_rows.find((r) => r.status === 'incomplete_expired');
    expect(starter?.recheckout).toBe('new_checkout');
  });

  it('mergeWithFixture keeps live rows and fills missing fixture IDs', () => {
    const live: ConversionBillingSnapshot = {
      source: 'live',
      generated_at: '2026-09-18T00:00:00Z',
      mrr_eur: 0,
      active_subscriptions: 0,
      open_invoices_count: 0,
      open_invoices_amount_eur: 0,
      subscriptions_by_status: {},
      status_rows: [
        {
          subscription_id: 'sub_live',
          status: 'past_due',
          plan_key: 'scale',
          cancel_reason: 'payment_failed',
          current_period_end: null,
          customer_id: 'cus_live',
          customer_email: null,
          tenant_id: 'tenant-live',
          unit_amount_cents: 9900,
          currency: 'eur',
          latest_invoice_id: null,
          latest_invoice_status: 'open',
          recheckout: 'portal',
        },
      ],
      open_invoices: [],
    };
    const merged = mergeWithFixture(live);
    expect(merged.source).toBe('hybrid');
    expect(merged.status_rows.some((r) => r.subscription_id === 'sub_live')).toBe(true);
    expect(merged.status_rows.some((r) => r.plan_key === 'growth')).toBe(true);
    expect(merged.open_invoices.some((i) => i.amount_due_cents === 24900)).toBe(true);
  });
});
