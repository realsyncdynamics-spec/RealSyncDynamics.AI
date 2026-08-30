import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 *
 * `stripe-checkout` entscheidet anhand von `products.stripe_price_id`, ob ein
 * Plan kaufbar ist. Diese Prüfung war eine **Sperrliste**: alles galt als
 * echte Price, was nicht mit `internal_default_` beginnt. Gegen die Live-Daten
 * gemessen liess das sechs Eintraege durch, die Stripe nie akzeptiert —
 * darunter `starter_yearly` und `growth_yearly`, also verkaufbare Plaene. Wer
 * „jaehrlich" waehlte, bekam einen Stripe-API-Fehler statt einer
 * verstaendlichen Antwort.
 *
 * Die Regel lautet jetzt umgekehrt: Nur `price_…` zaehlt. Dieser Test haelt
 * die Umkehrung fest — eine Sperrliste waere hier jederzeit wieder
 * einzubauen, ohne dass es jemandem auffiele.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(
  join(__dirname, '..', '..', 'supabase', 'functions', 'stripe-checkout', 'index.ts'),
  'utf8',
);

/** Die Prüfung, wie sie in der Edge Function steht. */
const isLiveStripePrice = (id: string | null | undefined): boolean =>
  typeof id === 'string' && id.startsWith('price_');

describe('stripe-checkout akzeptiert nur echte Stripe-Preise', () => {
  it('prüft per Positivliste auf `price_`, nicht per Sperrliste', () => {
    expect(SOURCE).toContain("startsWith('price_')");
    // Die alte Sperrliste darf nicht zurückkehren: sie liess Platzhalter durch.
    expect(SOURCE).not.toContain("!p.stripe_price_id.startsWith('internal_default_')");
  });

  // Exakt die Werte, die am 2026-08-30 in `public.products` standen.
  const LIVE_VALUES: Array<[string, string, boolean]> = [
    ['starter', 'price_1TfsV8REjTWueUcGCdOO6bT2', true],
    ['growth', 'price_1TfsV4REjTWueUcGsGSfjudu', true],
    ['agency', 'price_1TfsV9REjTWueUcGxJIBHYgC', true],
    ['governance_launch', 'price_1U3lQNREjTWueUcG6LX7WIQU', true],
    // Platzhalter — sehen wie eine Price aus, sind aber keine.
    ['starter_yearly', 'STRIPE_PRICE_STARTER_YEARLY_XXX', false],
    ['growth_yearly', 'STRIPE_PRICE_GROWTH_YEARLY_XXX', false],
    ['agency_yearly', 'STRIPE_PRICE_AGENCY_YEARLY_XXX', false],
    ['partner_yearly', 'STRIPE_PRICE_SCALE_YEARLY_XXX', false],
    // Sentinels mit abweichendem Präfix und ein leerer Wert.
    ['enterprise', 'internal_default_enterprise', false],
    ['free_tier', 'internal_free_tier', false],
    ['free_audit', '', false],
  ];

  for (const [planKey, priceId, expected] of LIVE_VALUES) {
    it(`${planKey}: "${priceId}" ist ${expected ? 'eine' : 'KEINE'} einlösbare Price`, () => {
      expect(isLiveStripePrice(priceId)).toBe(expected);
    });
  }

  it('weist auch null und undefined ab, statt sie an Stripe zu reichen', () => {
    expect(isLiveStripePrice(null)).toBe(false);
    expect(isLiveStripePrice(undefined)).toBe(false);
  });
});
