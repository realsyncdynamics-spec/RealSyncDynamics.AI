import { describe, expect, it } from 'vitest';
import { PRICING_TIERS, PUBLIC_PRICING_TIERS, SELLABLE_PRICING_TIERS, tierById, tierByPlanKey } from '../../src/config/pricing';
import { ORDERED_PLANS, PLAN_ORDER, planById } from '../../shared/pricing';

describe('pricing config (Single Source of Truth)', () => {
  it('kennt genau die sechs zulaessigen Plaene in kanonischer Reihenfolge', () => {
    expect(PLAN_ORDER).toEqual(['free', 'starter', 'growth', 'agency', 'enterprise', 'partner']);
    expect(ORDERED_PLANS.map((p) => p.name)).toEqual([
      'Free Audit', 'Starter', 'Growth', 'Agency', 'Enterprise', 'Partner',
    ]);
  });

  // `starter_yearly`, `growth_yearly`, `agency_yearly`, `enterprise_yearly`,
  // `partner_yearly` fehlen hier bewusst: in Live-Stripe existieren KEINE
  // Yearly-Prices (`yearlyCheckoutUnavailable` auf allen Plänen).
  it('fuehrt erst die Monatsplaene, danach Einmalprodukte — ohne Yearly-Tiers', () => {
    const ids = PRICING_TIERS.map((tier) => tier.id);
    expect(ids).toEqual([
      'free', 'starter', 'growth', 'agency', 'enterprise', 'partner',
      'governance_launch',
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

  it('hat die korrekten Jahrespreise in der SSoT, ohne Yearly-Tiers', () => {
    expect(planById('agency').price.yearlyEur).toBe(6900);
    expect(planById('enterprise').price.yearlyEur).toBe(12490);
    expect(planById('partner').price.yearlyEur).toBe(19000);
    expect(tierById('agency_yearly')).toBeUndefined();
    expect(tierById('enterprise_yearly')).toBeUndefined();
    expect(tierById('partner_yearly')).toBeUndefined();
  });

  // Der Betrag bleibt in der SSoT — er ist ja richtig, nur nicht einloesbar.
  // Oeffentlich wird er nicht mehr: kein Tier, damit auch keine Karte, kein
  // JSON-LD-Offer und keine Rechengrundlage.
  it('haelt die nicht verdrahteten Jahresbetraege aus den Tiers heraus', () => {
    expect(planById('starter').price.yearlyEur).toBe(790);
    expect(planById('growth').price.yearlyEur).toBe(2490);
    expect(planById('starter').yearlyCheckoutUnavailable).toBe(true);
    expect(planById('growth').yearlyCheckoutUnavailable).toBe(true);
    expect(planById('agency').yearlyCheckoutUnavailable).toBe(true);
    expect(tierById('starter_yearly')).toBeUndefined();
    expect(tierById('growth_yearly')).toBeUndefined();
    expect(tierById('agency_yearly')).toBeUndefined();
  });

  // Bestandsschutz: der Jahres-Key loest weiterhin auf, nur eben auf das
  // Monats-Tier desselben Plans — gleicher Plan, gleiche Berechtigungen.
  it('loest bestehende Jahres-Keys weiterhin auf ihren Basisplan auf', () => {
    expect(tierByPlanKey('starter_yearly')?.plan.id).toBe('starter');
    expect(tierByPlanKey('growth_yearly')?.plan.id).toBe('growth');
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
    // Ohne Yearly-Tier fällt scale_yearly auf das Monats-Partner-Tier zurück.
    expect(tierByPlanKey('scale_yearly')?.plan.id).toBe('partner');
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

  // Nur noch der Monats-Tier: die Jahresvariante von Growth ist mangels
  // verdrahtetem Stripe-Preis kein Tier mehr (siehe oben).
  it('genau Growth ist hervorgehoben', () => {
    const highlighted = PRICING_TIERS.filter((tier) => tier.highlight);
    expect(highlighted.map((t) => t.id)).toEqual(['growth']);
  });

  it('PUBLIC_PRICING_TIERS enthaelt weiterhin alle fuenf Monatsraenge', () => {
    // Bewusst unveraendert nach AP2: Diese Liste beantwortet „welche Raenge
    // gibt es?" und wird fuer Rangvergleiche und das Nachschlagen des
    // eigenen Plans benutzt. Fielen Agency und Partner hier heraus, bekaeme
    // ein Bestandskunde dort falsche Antworten.
    expect(PUBLIC_PRICING_TIERS.map((t) => t.id)).toEqual([
      'starter', 'growth', 'agency', 'enterprise', 'partner',
    ]);
  });

  it('SELLABLE_PRICING_TIERS enthaelt die angebotenen Stufen inkl. Agency', () => {
    // Agency ist seit Dominik-Landing 2026-09 wieder self_service (Stripe
    // Live-Price). Partner bleibt stillgelegt.
    expect(SELLABLE_PRICING_TIERS.map((t) => t.id)).toEqual([
      'starter', 'growth', 'agency', 'enterprise',
    ]);
  });

  it('SELLABLE_PRICING_TIERS ist eine Teilmenge von PUBLIC_PRICING_TIERS', () => {
    // Beide leiten aus derselben Quelle ab. Ein Tier, das im Verkauf steht,
    // aber keinen Rang hat, waere ein Plan ohne Upgrade-Pfad.
    const raenge = new Set(PUBLIC_PRICING_TIERS.map((t) => t.id));
    for (const tier of SELLABLE_PRICING_TIERS) {
      expect(raenge.has(tier.id), tier.id).toBe(true);
    }
  });

  it('kein angebotenes Tier gehoert zu einem stillgelegten Plan', () => {
    for (const tier of SELLABLE_PRICING_TIERS) {
      expect(tier.plan.availability, tier.id).not.toBe('legacy');
    }
  });

  it('Preise steigen entlang der kanonischen Reihenfolge streng an', () => {
    const prices = ORDERED_PLANS.map((plan) => plan.price.monthlyEur);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i], `Plan ${ORDERED_PLANS[i].id}`).toBeGreaterThan(prices[i - 1]);
    }
  });
});
