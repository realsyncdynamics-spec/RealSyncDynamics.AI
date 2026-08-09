import { describe, expect, it } from 'vitest';
import { PRICING_TIERS, PUBLIC_PRICING_TIERS, tierById, tierByPlanKey } from '../../src/config/pricing';
import { ORDERED_PLANS, PLAN_ORDER, planById } from '../../shared/pricing';

describe('pricing config (Single Source of Truth)', () => {
  it('kennt genau die sechs zulaessigen Plaene in kanonischer Reihenfolge', () => {
    expect(PLAN_ORDER).toEqual(['free', 'starter', 'growth', 'agency', 'enterprise', 'partner']);
    expect(ORDERED_PLANS.map((p) => p.name)).toEqual([
      'Free Audit', 'Starter', 'Growth', 'Agency', 'Enterprise', 'Partner',
    ]);
  });

  it('fuehrt erst die Monatsplaene, danach die Jahresvarianten', () => {
    const ids = PRICING_TIERS.map((tier) => tier.id);
    expect(ids).toEqual([
      'free', 'starter', 'growth', 'agency', 'enterprise', 'partner',
      // Einmalprodukte stehen nach der Abo-Leiter und vor den Jahresvarianten.
      'governance_launch',
      'starter_yearly', 'growth_yearly', 'agency_yearly', 'enterprise_yearly', 'partner_yearly',
    ]);
  });

  it('hat die vom Master-Direktiv vorgegebenen Preise', () => {
    expect(planById('free').price.monthlyEur).toBe(0);
    expect(planById('starter').price.monthlyEur).toBe(79);
    expect(planById('growth').price.monthlyEur).toBe(249);
    expect(planById('agency').price.monthlyEur).toBe(699);
    expect(planById('enterprise').price.monthlyEur).toBe(1249);
    expect(planById('partner').price.monthlyEur).toBe(1999);
  });

  it('hat die korrekten Jahrespreise', () => {
    expect(tierById('starter_yearly')?.priceEur).toBe(790);
    expect(tierById('growth_yearly')?.priceEur).toBe(2490);
    expect(tierById('agency_yearly')?.priceEur).toBe(6900);
    expect(tierById('enterprise_yearly')?.priceEur).toBe(12490);
    expect(tierById('partner_yearly')?.priceEur).toBe(19000);
  });

  it('kennt den Begriff „Scale" nicht mehr', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.id).not.toMatch(/scale/i);
      expect(tier.planKey).not.toMatch(/scale/i);
      expect(tier.name).not.toMatch(/scale/i);
    }
  });

  it('bildet Altdaten `scale` transparent auf Partner ab', () => {
    expect(tierByPlanKey('scale')?.id).toBe('partner');
    expect(tierByPlanKey('scale_yearly')?.id).toBe('partner_yearly');
    expect(tierByPlanKey('free')?.id).toBe('free');
    expect(tierByPlanKey('voellig-unbekannt')).toBeUndefined();
  });

  it('recurring folgt dem Monatspreis des Plans', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.recurring, `${tier.id}`).toBe(tier.plan.price.monthlyEur > 0);
    }
  });

  it('jeder Tier hat einen eindeutigen planKey', () => {
    const planKeys = PRICING_TIERS.map((tier) => tier.planKey);
    expect(new Set(planKeys).size).toBe(planKeys.length);
  });

  it('jeder Plan hat Outcome-Headline und technische Subheadline', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.tagline, `${tier.id} Outcome-Headline`).toBeTruthy();
      expect(tier.subline, `${tier.id} Subheadline`).toBeTruthy();
    }
  });

  it('jeder Tier liefert mindestens drei Feature-Bullets', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.bullets.length, `${tier.id} muss Bullets haben`).toBeGreaterThanOrEqual(3);
    }
  });

  it('jeder Tier hat CTA-Label und Ziel', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.cta.label, `${tier.id} CTA label`).toBeTruthy();
      expect(tier.cta.href, `${tier.id} CTA href`).toBeTruthy();
    }
  });

  it('genau Growth ist hervorgehoben (monatlich + jaehrlich)', () => {
    const highlighted = PRICING_TIERS.filter((tier) => tier.highlight);
    expect(highlighted.map((t) => t.id)).toEqual(['growth', 'growth_yearly']);
  });

  it('PUBLIC_PRICING_TIERS enthaelt die fuenf buchbaren Monatsplaene', () => {
    expect(PUBLIC_PRICING_TIERS.map((t) => t.id)).toEqual([
      'starter', 'growth', 'agency', 'enterprise', 'partner',
    ]);
  });

  it('Preise steigen entlang der kanonischen Reihenfolge streng an', () => {
    const prices = ORDERED_PLANS.map((plan) => plan.price.monthlyEur);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i], `Plan ${ORDERED_PLANS[i].id}`).toBeGreaterThan(prices[i - 1]);
    }
  });
});
