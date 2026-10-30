import { describe, it, expect } from 'vitest';
import {
  checkStripePrice,
  stripeEnvironmentFromKey,
  stripePriceMatchesPlan,
  PLAN_STRIPE_EXPECTATIONS,
  type PlanStripeExpectation,
  type StripePriceFacts,
} from '../supabase/functions/stripe-checkout/price-match';
import { planById } from '../shared/pricing';

const enterprise = planById('enterprise')!.price;
const growth = planById('growth')!.price;
const launch = planById('governance_launch')!.price;

const monthly = (eur: number) => ({
  unit_amount: eur * 100, currency: 'eur', recurring: { interval: 'month', interval_count: 1 },
});

describe('stripe-checkout: Stripe-Betrag gegen Pricing-SSoT', () => {
  it('akzeptiert den Enterprise-Preis zu 1.498 € im Monat', () => {
    expect(stripePriceMatchesPlan(monthly(1498), enterprise, false)).toBe(true);
  });

  it('lehnt die alte Enterprise-Price-ID zu 1.249 € ab', () => {
    // Der Fall, für den die Prüfung gebaut ist: products zeigt noch auf den
    // alten Preis, die Seite schon auf den neuen.
    expect(stripePriceMatchesPlan(monthly(1249), enterprise, false)).toBe(false);
  });

  it('lehnt falsche Währung, fehlenden Betrag und unbekanntes Intervall ab', () => {
    expect(stripePriceMatchesPlan({ ...monthly(1498), currency: 'usd' }, enterprise, false)).toBe(false);
    expect(stripePriceMatchesPlan({ ...monthly(1498), unit_amount: null }, enterprise, false)).toBe(false);
    expect(stripePriceMatchesPlan({ ...monthly(1498), recurring: { interval: 'week', interval_count: 1 } }, enterprise, false)).toBe(false);
    expect(stripePriceMatchesPlan({ ...monthly(1498), recurring: null }, enterprise, false)).toBe(false);
  });

  it('lehnt 1.498 € alle drei Monate ab (interval_count ≠ 1)', () => {
    expect(stripePriceMatchesPlan({ ...monthly(1498), recurring: { interval: 'month', interval_count: 3 } }, enterprise, false)).toBe(false);
  });

  it('prüft Jahres-Prices gegen den Jahresbetrag', () => {
    const yearly = { unit_amount: enterprise.yearlyEur! * 100, currency: 'eur', recurring: { interval: 'year', interval_count: 1 } };
    expect(stripePriceMatchesPlan(yearly, enterprise, false)).toBe(true);
    expect(stripePriceMatchesPlan({ ...yearly, unit_amount: 1498 * 100 }, enterprise, false)).toBe(false);
  });

  it('prüft Einmalkäufe gegen oneTimeEur und lehnt wiederkehrende Prices ab', () => {
    const once = { unit_amount: launch.oneTimeEur! * 100, currency: 'eur', recurring: null };
    expect(stripePriceMatchesPlan(once, launch, true)).toBe(true);
    expect(stripePriceMatchesPlan({ ...once, recurring: { interval: 'month', interval_count: 1 } }, launch, true)).toBe(false);
  });
});

describe('stripe-checkout: Umgebung aus dem Secret-Key', () => {
  it('erkennt live und test, sonst null', () => {
    expect(stripeEnvironmentFromKey('sk_live_abc')).toBe('live');
    expect(stripeEnvironmentFromKey('rk_live_abc')).toBe('live');
    expect(stripeEnvironmentFromKey('sk_test_abc')).toBe('test');
    expect(stripeEnvironmentFromKey('rk_test_abc')).toBe('test');
    expect(stripeEnvironmentFromKey('pk_live_abc')).toBeNull();
    expect(stripeEnvironmentFromKey('sk_live')).toBeNull();
    expect(stripeEnvironmentFromKey('')).toBeNull();
    expect(stripeEnvironmentFromKey(null)).toBeNull();
  });
});

describe('stripe-checkout: planspezifische Stripe-Prüfung', () => {
  const PRODUCT = 'prod_TestEnterprise';
  const verified: Record<string, PlanStripeExpectation> = {
    enterprise: { taxBehavior: 'exclusive', productId: { live: PRODUCT, test: null } },
  };
  const enterprisePrice = (over: Partial<StripePriceFacts> = {}): StripePriceFacts => ({
    ...monthly(1498), active: true, livemode: true, tax_behavior: 'exclusive', product: PRODUCT, ...over,
  });
  const check = (price: StripePriceFacts, env: 'live' | 'test' | null = 'live') =>
    checkStripePrice(price, enterprise, false, 'enterprise', env, verified);

  it('akzeptiert Enterprise nur mit allen Merkmalen', () => {
    expect(check(enterprisePrice())).toEqual({ ok: true });
    // Produktobjekt statt ID (expand) zählt genauso.
    expect(check(enterprisePrice({ product: { id: PRODUCT } }))).toEqual({ ok: true });
  });

  it('lehnt jede einzelne Abweichung ab', () => {
    expect(check(enterprisePrice({ unit_amount: 124900 }))).toEqual({ ok: false, reason: 'AMOUNT_MISMATCH' });
    expect(check(enterprisePrice({ currency: 'usd' }))).toEqual({ ok: false, reason: 'AMOUNT_MISMATCH' });
    expect(check(enterprisePrice({ recurring: { interval: 'month', interval_count: 3 } }))).toEqual({ ok: false, reason: 'AMOUNT_MISMATCH' });
    expect(check(enterprisePrice({ active: false }))).toEqual({ ok: false, reason: 'PRICE_INACTIVE' });
    expect(check(enterprisePrice({ livemode: false }))).toEqual({ ok: false, reason: 'ENVIRONMENT_MISMATCH' });
    expect(check(enterprisePrice({ tax_behavior: 'inclusive' }))).toEqual({ ok: false, reason: 'TAX_BEHAVIOR_MISMATCH' });
    expect(check(enterprisePrice({ tax_behavior: 'unspecified' }))).toEqual({ ok: false, reason: 'TAX_BEHAVIOR_MISMATCH' });
    expect(check(enterprisePrice({ tax_behavior: null }))).toEqual({ ok: false, reason: 'TAX_BEHAVIOR_MISMATCH' });
    expect(check(enterprisePrice({ product: 'prod_Anderes' }))).toEqual({ ok: false, reason: 'PRODUCT_MISMATCH' });
    expect(check(enterprisePrice({ product: { id: 'prod_Anderes' } }))).toEqual({ ok: false, reason: 'PRODUCT_MISMATCH' });
  });

  it('lehnt unbekannte Umgebung und fehlende Produkt-Zuordnung ab', () => {
    expect(check(enterprisePrice(), null)).toEqual({ ok: false, reason: 'UNKNOWN_ENVIRONMENT' });
    // Test-Umgebung hat in `verified` keine Produkt-ID.
    expect(check(enterprisePrice({ livemode: false }), 'test')).toEqual({ ok: false, reason: 'PRODUCT_NOT_CONFIGURED' });
  });

  it('sperrt Enterprise, solange die echte Konfiguration keine verifizierte Produkt-ID hat', () => {
    const real = PLAN_STRIPE_EXPECTATIONS.enterprise;
    expect(real.taxBehavior).toBe('exclusive');
    for (const env of ['live', 'test'] as const) {
      if (real.productId[env] !== null) continue; // erst nach Verifikation befüllt
      const result = checkStripePrice(
        enterprisePrice({ livemode: env === 'live' }), enterprise, false, 'enterprise', env,
      );
      expect(result).toEqual({ ok: false, reason: 'PRODUCT_NOT_CONFIGURED' });
    }
  });

  it('blockiert Tarife ohne Eintrag nicht über Steuermodus, Produkt oder Umgebung', () => {
    // Bestandstarife (z. B. Growth) haben keine planspezifischen Erwartungen:
    // ein anderer Steuermodus oder eine unbekannte Umgebung sperrt sie nicht.
    expect(PLAN_STRIPE_EXPECTATIONS).not.toHaveProperty('growth');
    const growthPrice: StripePriceFacts = {
      ...monthly(growth.monthlyEur), active: true, livemode: true, tax_behavior: 'inclusive', product: 'prod_Irgendeins',
    };
    expect(checkStripePrice(growthPrice, growth, false, 'growth', 'live')).toEqual({ ok: true });
    expect(checkStripePrice(growthPrice, growth, false, 'growth', null)).toEqual({ ok: true });
    expect(checkStripePrice({ ...growthPrice, tax_behavior: 'unspecified' }, growth, false, 'growth', 'live')).toEqual({ ok: true });
    // Betrag und aktiver Price gelten für alle Pläne.
    expect(checkStripePrice({ ...growthPrice, unit_amount: 1 }, growth, false, 'growth', 'live')).toEqual({ ok: false, reason: 'AMOUNT_MISMATCH' });
    expect(checkStripePrice({ ...growthPrice, active: false }, growth, false, 'growth', 'live')).toEqual({ ok: false, reason: 'PRICE_INACTIVE' });
  });

  it('wertet geerbte Objekt-Schlüssel nicht als Plan-Eintrag', () => {
    const p: StripePriceFacts = { ...monthly(growth.monthlyEur), active: true, livemode: true, tax_behavior: null, product: 'x' };
    expect(checkStripePrice(p, growth, false, 'toString', null)).toEqual({ ok: true });
  });
});
