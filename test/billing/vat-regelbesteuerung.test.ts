/**
 * Regelbesteuerung seit 2026-10-15 (Entscheidung Dominik): § 19 UStG entfällt,
 * Preise sind NETTO, Anzeige netto + 19 % USt = brutto.
 */
import { describe, it, expect } from 'vitest';
import {
  PRICING_TAX_MODE, PRICING_TAX_NOTE, grossEurFromNet, formatNetGrossLine, planById,
} from '../../shared/pricing';
import { reviewCheckoutTax, checkoutTaxParams } from '../../supabase/functions/_shared/checkout-tax';

describe('Regelbesteuerung', () => {
  it('Steuermodus ist EU_STANDARD, Hinweis ohne § 19', () => {
    expect(PRICING_TAX_MODE).toBe('EU_STANDARD');
    expect(PRICING_TAX_NOTE).toContain('zzgl. 19 % USt');
    expect(PRICING_TAX_NOTE).not.toContain('§ 19');
  });

  it('Brutto aus SSoT-Netto: 79 → 94,01 · 249 → 296,31 · 699 → 831,81', () => {
    expect(grossEurFromNet(planById('starter').price.monthlyEur)).toBe(94.01);
    expect(grossEurFromNet(planById('growth').price.monthlyEur)).toBe(296.31);
    expect(grossEurFromNet(planById('agency').price.monthlyEur)).toBe(831.81);
  });

  it('Zusatzzeile DE/EN', () => {
    expect(formatNetGrossLine(79)).toMatch(/^zzgl\. 19 % USt · 94,01\s€ brutto$/);
    expect(formatNetGrossLine(249, 'en')).toMatch(/^plus 19% VAT · 296,31\s€ gross$/);
  });

  it('Checkout im Standardmodus: automatic_tax an', () => {
    expect(checkoutTaxParams({ sessionMode: 'subscription', existingCustomer: true }).automatic_tax).toEqual({ enabled: true });
  });

  it('Webhook-Review: DE-Kauf ohne USt wird markiert', () => {
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'DE', taxAmountCents: 0 }))
      .toContain('TAX_MISSING_IN_STANDARD_MODE');
    expect(reviewCheckoutTax({ taxMode: 'EU_STANDARD', billingCountry: 'DE', taxAmountCents: 1501 })).toEqual([]);
  });
});
