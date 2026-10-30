import { describe, expect, it } from 'vitest';
import { ADDONS, PLANS, type AddOnId } from '@/shared/pricing';
import {
  CONFIGURABLE_PLANS,
  estimateMonthlyQuote,
  fitsTenantCapacity,
  offeredAddonsForPlan,
  yearlySelectable,
} from '@/features/billing/planConfiguratorModel';

describe('Plan-Konfigurator: nur Pricing-SSoT', () => {
  it('zeigt nur noch neu wählbare Checkout-Abos, keine Legacy- oder Einmalpläne', () => {
    expect(CONFIGURABLE_PLANS.length).toBeGreaterThan(0);
    expect(CONFIGURABLE_PLANS.every(
      (p) => p.purchaseMode === 'checkout' && p.availability === 'self_service',
    )).toBe(true);
  });

  it('bietet nur Add-ons an, die sowohl beworben als auch dem Plan zugeordnet sind', () => {
    for (const plan of CONFIGURABLE_PLANS) {
      expect(offeredAddonsForPlan(plan).every(
        (addon) => addon.availableFor.includes(plan.id) && plan.addons.includes(addon.id),
      )).toBe(true);
    }
  });

  it('berechnet einen eindeutigen Preis ohne Fremdplan-Add-ons und Duplikate', () => {
    const plan = PLANS.find((p) => p.id === 'growth');
    const responsePack = ADDONS.find((a) => a.id === 'response_pack');
    const whatsapp = ADDONS.find((a) => a.id === 'whatsapp');
    expect(plan).toBeDefined();
    expect(responsePack).toBeDefined();
    expect(whatsapp).toBeDefined();
    if (!plan || !responsePack || !whatsapp) return;

    const quote = estimateMonthlyQuote(plan, [
      responsePack.id,
      responsePack.id,
      whatsapp.id,
    ] as AddOnId[]);
    expect(quote.addons.map((a) => a.id)).toEqual([responsePack.id]);
    expect(quote.addonsMonthlyEur).toBe(responsePack.priceEur);
    expect(quote.totalMonthlyEur).toBe(plan.price.monthlyEur + responsePack.priceEur);
  });

  it('prüft Mandantenkapazität statt ungeprüfte Kundenslots zu verkaufen', () => {
    const plan = PLANS.find((p) => p.id === 'starter');
    expect(plan).toBeDefined();
    if (!plan) return;
    expect(fitsTenantCapacity(plan, 1)).toBe(true);
    expect(fitsTenantCapacity(plan, plan.limits.tenants + 1)).toBe(false);
    expect(fitsTenantCapacity(plan, 0)).toBe(false);
    expect(fitsTenantCapacity(plan, 1.5)).toBe(false);
  });

  it('bietet keinen Jahreszeitraum an, wenn ein echter Checkout fehlt', () => {
    for (const plan of CONFIGURABLE_PLANS) {
      if (plan.yearlyCheckoutUnavailable || !plan.yearlyPlanKey || plan.price.yearlyEur === null) {
        expect(yearlySelectable(plan)).toBe(false);
      }
    }
  });
});
