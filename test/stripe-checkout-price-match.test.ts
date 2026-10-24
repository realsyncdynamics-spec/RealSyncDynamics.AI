import { describe, it, expect } from 'vitest';
import { stripePriceMatchesPlan } from '../supabase/functions/stripe-checkout/price-match';
import { planById } from '../shared/pricing';

const enterprise = planById('enterprise')!.price;
const launch = planById('governance_launch')!.price;

const monthly = (eur: number) => ({ unit_amount: eur * 100, currency: 'eur', recurring: { interval: 'month' } });

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
    expect(stripePriceMatchesPlan({ ...monthly(1498), recurring: { interval: 'week' } }, enterprise, false)).toBe(false);
    expect(stripePriceMatchesPlan({ ...monthly(1498), recurring: null }, enterprise, false)).toBe(false);
  });

  it('prüft Jahres-Prices gegen den Jahresbetrag', () => {
    const yearly = { unit_amount: enterprise.yearlyEur! * 100, currency: 'eur', recurring: { interval: 'year' } };
    expect(stripePriceMatchesPlan(yearly, enterprise, false)).toBe(true);
    expect(stripePriceMatchesPlan({ ...yearly, unit_amount: 1498 * 100 }, enterprise, false)).toBe(false);
  });

  it('prüft Einmalkäufe gegen oneTimeEur und lehnt wiederkehrende Prices ab', () => {
    const once = { unit_amount: launch.oneTimeEur! * 100, currency: 'eur', recurring: null };
    expect(stripePriceMatchesPlan(once, launch, true)).toBe(true);
    expect(stripePriceMatchesPlan({ ...once, recurring: { interval: 'month' } }, launch, true)).toBe(false);
  });
});
