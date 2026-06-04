import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PRICING_TIERS } from '../src/config/pricing';

/**
 * index.html JSON-LD Offers werden manuell gepflegt (Hard-Coded, ohne
 * Build-Step-Propagation). Der Kommentar in src/config/pricing.ts
 * bezeichnet sie trotzdem als Single-Source-Konsumenten — dieser Test
 * macht das Versprechen verbindlich. Bei jeder Pricing-Änderung muss
 * auch das JSON-LD nachgezogen werden, sonst rote CI.
 *
 * Wir prüfen:
 *   1. Jeder Code-Tier hat genau ein @type=Offer mit passendem Namen
 *   2. Numerische Preise stimmen exakt überein
 *   3. Enterprise (priceString='individuell') hat KEINE numerische price-
 *      Property im JSON-LD — sonst zeigt Google falsche Rich-Snippets
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

interface JsonLdOffer { name?: string; price?: string }

function extractOffers(): JsonLdOffer[] {
  const match = INDEX_HTML.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('JSON-LD block in index.html nicht gefunden');
  const parsed = JSON.parse(match[1]) as { '@graph': Array<{ offers?: JsonLdOffer[] }> };
  const sw = parsed['@graph'].find((n) => Array.isArray(n.offers));
  if (!sw?.offers) throw new Error('SoftwareApplication-offers im JSON-LD nicht gefunden');
  return sw.offers;
}

describe('Pricing JSON-LD <-> pricing.ts drift guard', () => {
  const offers = extractOffers();

  it('hat dieselbe Anzahl Offers wie PRICING_TIERS', () => {
    expect(offers.length).toBe(PRICING_TIERS.length);
  });

  for (const tier of PRICING_TIERS) {
    it(`Offer "${tier.name}" ist im JSON-LD vorhanden`, () => {
      const offer = offers.find((o) => o.name === tier.name);
      expect(offer, `Offer "${tier.name}" fehlt im index.html JSON-LD`).toBeDefined();
    });

    it(`Offer "${tier.name}" hat den richtigen Preis`, () => {
      const offer = offers.find((o) => o.name === tier.name)!;
      if (tier.priceString === 'individuell') {
        expect(
          offer.price,
          `Enterprise/Custom-Tier "${tier.name}" darf keine numerische price-Property im JSON-LD haben (Google würde sie als Festpreis rendern).`,
        ).toBeUndefined();
      } else {
        const expected = tier.priceString.replace(/\./g, '');
        expect(offer.price, `JSON-LD-Preis für "${tier.name}" stimmt nicht mit pricing.ts überein`).toBe(expected);
      }
    });
  }
});
