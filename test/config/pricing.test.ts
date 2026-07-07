import { describe, expect, it } from 'vitest';
import { PRICING_TIERS, tierById } from '../../src/config/pricing';

describe('pricing config (Single Source of Truth)', () => {
  it('enthaelt alle Pflicht-Tiers und Jahresvarianten in korrekter Reihenfolge', () => {
    const ids = PRICING_TIERS.map((tier) => tier.id);
    expect(ids).toEqual(['free', 'starter', 'growth', 'agency', 'scale', 'enterprise', 'starter_yearly', 'growth_yearly', 'agency_yearly', 'enterprise_yearly', 'scale_yearly']);
  });

  it('hat die vom Master-Direktiv vorgegebenen Preise', () => {
    expect(tierById('free')?.priceEur).toBe(0);
    expect(tierById('starter')?.priceEur).toBe(79);
    expect(tierById('growth')?.priceEur).toBe(249);
    expect(tierById('agency')?.priceEur).toBe(699);
    expect(tierById('scale')?.priceEur).toBe(1999);
    expect(tierById('enterprise')?.priceEur).toBe(1249);
  });

  it('hat die korrekten Jahrespreise (12 Monate zum Preis von 10)', () => {
    expect(tierById('starter_yearly')?.priceEur).toBe(790);
    expect(tierById('growth_yearly')?.priceEur).toBe(2490);
    expect(tierById('agency_yearly')?.priceEur).toBe(6900);
    expect(tierById('enterprise_yearly')?.priceEur).toBe(12490);
    expect(tierById('scale_yearly')?.priceEur).toBe(19000);
  });

  it('alle Paid-Tiers haben recurring=true', () => {
    const paid = ['starter', 'growth', 'agency', 'scale', 'enterprise', 'starter_yearly', 'growth_yearly', 'agency_yearly', 'enterprise_yearly', 'scale_yearly'] as const;
    for (const id of paid) {
      expect(tierById(id)?.recurring, `${id} must be recurring`).toBe(true);
    }
    expect(tierById('free')?.recurring).toBe(false);
  });

  it('jeder Tier hat eine eindeutige planKey', () => {
    const planKeys = PRICING_TIERS.map((tier) => tier.planKey);
    expect(new Set(planKeys).size).toBe(planKeys.length);
  });

  it('jeder Tier liefert mindestens drei Bullet-Points fuer die Pricing-Card', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.bullets.length, `${tier.id} muss Bullets haben`).toBeGreaterThanOrEqual(3);
    }
  });

  it('jeder Tier hat einen CTA-Label und href', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.cta.label, `${tier.id} CTA label`).toBeTruthy();
      expect(tier.cta.href, `${tier.id} CTA href`).toBeTruthy();
    }
  });

  it('exakt zwei Tiers sind als highlight markiert (Growth und Growth Yearly)', () => {
    const highlighted = PRICING_TIERS.filter((tier) => tier.highlight);
    expect(highlighted).toHaveLength(2);
    expect(highlighted.map(t => t.id)).toEqual(['growth', 'growth_yearly']);
  });
});
