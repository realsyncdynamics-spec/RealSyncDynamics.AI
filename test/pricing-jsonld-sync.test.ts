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
 *   1. Jeder verkaufbare Tier hat genau ein @type=Offer mit passendem Namen
 *   2. Numerische Preise stimmen exakt überein
 *   3. Ein Tier ohne öffentlichen Festpreis (`priceOnRequest`) hat KEINE
 *      numerische price-Property — sonst zeigt Google einen Festpreis für
 *      etwas, das nur vertraglich zu haben ist
 *   4. Stillgelegte Pläne (`availability: 'legacy'`) tauchen GAR NICHT auf
 *
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 * Punkt 3 hing vorher am Anzeigetext (`priceString === 'individuell'`) statt
 * am Datenfeld und griff deshalb nicht, als Enterprise auf „Auf Anfrage"
 * umgestellt wurde — der Festpreis von 1.249 € blieb im JSON-LD stehen und
 * wurde auf jeder Seite maschinenlesbar ausgeliefert. Punkt 4 ist neu: Agency
 * und Partner sind seit AP2 stillgelegt und dürfen nicht als Angebot gelten.
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

  // Ein Angebot darf nur fuehren, wer heute noch abschliessbar ist.
  const OFFERABLE_TIERS = PRICING_TIERS.filter((t) => t.plan.availability !== 'legacy');
  const RETIRED_TIERS = PRICING_TIERS.filter((t) => t.plan.availability === 'legacy');

  it('hat dieselbe Anzahl Offers wie die verkaufbaren Tiers', () => {
    expect(offers.length).toBe(OFFERABLE_TIERS.length);
  });

  for (const tier of RETIRED_TIERS) {
    it(`stillgelegter Plan "${tier.name}" steht NICHT im JSON-LD`, () => {
      const offer = offers.find((o) => o.name === tier.name);
      expect(
        offer,
        `"${tier.name}" ist stillgelegt — ein schema.org-Offer waere ein Angebot ohne Kaufpfad.`,
      ).toBeUndefined();
    });
  }

  for (const tier of OFFERABLE_TIERS) {
    it(`Offer "${tier.name}" ist im JSON-LD vorhanden`, () => {
      const offer = offers.find((o) => o.name === tier.name);
      expect(offer, `Offer "${tier.name}" fehlt im index.html JSON-LD`).toBeDefined();
    });

    it(`Offer "${tier.name}" hat den richtigen Preis`, () => {
      const offer = offers.find((o) => o.name === tier.name)!;
      if (tier.priceOnRequest || tier.priceString === 'individuell') {
        expect(
          offer.price,
          `"${tier.name}" hat keinen oeffentlichen Festpreis und darf keine numerische price-Property im JSON-LD haben (Google wuerde sie als Festpreis rendern).`,
        ).toBeUndefined();
      } else {
        const expected = tier.priceString.replace(/\./g, '');
        expect(offer.price, `JSON-LD-Preis für "${tier.name}" stimmt nicht mit pricing.ts überein`).toBe(expected);
      }
    });
  }
});
