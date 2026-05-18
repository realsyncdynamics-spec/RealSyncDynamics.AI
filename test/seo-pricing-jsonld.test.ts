import { describe, it, expect } from 'vitest';
import { PRICING_TIERS } from '../src/config/pricing';

// Diese Tests fixieren den Vertrag zwischen pricing.ts (SSoT) und der
// JSON-LD-Ableitung in seo.ts. Bricht jemand das mapping, schlaegt der
// Test an — Drift zwischen Pricing-Page und Google-Rich-Results wird
// verhindert. Wir laden das Modul ueber einen dynamischen Pfad, damit
// PRICING_PRODUCT_JSONLD (modul-lokal) gerendert wird.

interface Offer {
  '@type': 'Offer';
  name: string;
  price?: string;
  priceCurrency: string;
  url: string;
  description?: string;
  priceSpecification?: {
    '@type': 'UnitPriceSpecification';
    price: string;
    priceCurrency: 'EUR';
    billingDuration?: string;
    priceType?: string;
  };
}

interface ProductJsonLd {
  '@context': string;
  '@type': 'Product';
  name: string;
  offers: Offer[];
}

async function loadPricingOffers(): Promise<Offer[]> {
  // SEO-Page rendert PRICING_PRODUCT_JSONLD inline via jsonLd-Feld der
  // /pricing-Route. Wir reichen ueber die exportierte SEO_CONFIG ran.
  const mod = await import('../src/config/seo');
  const SEO_CONFIG = (mod as unknown as { SEO_CONFIG: Record<string, { jsonLd?: ProductJsonLd | ProductJsonLd[] }> }).SEO_CONFIG;
  const pricingRoute = SEO_CONFIG['/pricing'];
  if (!pricingRoute?.jsonLd) throw new Error('SEO_CONFIG["/pricing"].jsonLd missing');
  const jsonLd = Array.isArray(pricingRoute.jsonLd) ? pricingRoute.jsonLd : [pricingRoute.jsonLd];
  const product = jsonLd.find((x) => x['@type'] === 'Product');
  if (!product) throw new Error('Product JSON-LD missing on /pricing');
  return product.offers;
}

describe('seo.ts pricing JSON-LD', () => {
  it('emits one Offer per PRICING_TIER (no duplicates, no orphans)', async () => {
    const offers = await loadPricingOffers();
    expect(offers).toHaveLength(PRICING_TIERS.length);
    for (const tier of PRICING_TIERS) {
      const match = offers.find((o) => o.name === tier.name);
      expect(match, `Offer for tier "${tier.name}" missing`).toBeDefined();
    }
  });

  it('mirrors tier.priceString into Offer.price for paid recurring tiers', async () => {
    const offers = await loadPricingOffers();
    for (const tier of PRICING_TIERS) {
      if (!tier.recurring || tier.priceString === 'individuell') continue;
      const offer = offers.find((o) => o.name === tier.name)!;
      expect(offer.price).toBe(tier.priceString);
      expect(offer.priceSpecification?.price).toBe(tier.priceString);
      expect(offer.priceSpecification?.billingDuration).toBe('P1M');
    }
  });

  it('emits no price field for the Enterprise tier (Custom Pricing)', async () => {
    const offers = await loadPricingOffers();
    const enterpriseTier = PRICING_TIERS.find((t) => t.priceString === 'individuell');
    expect(enterpriseTier).toBeDefined();
    const offer = offers.find((o) => o.name === enterpriseTier!.name)!;
    expect(offer.price).toBeUndefined();
    expect(offer.priceSpecification).toBeUndefined();
    expect(offer.description).toContain(enterpriseTier!.priceSuffix);
  });

  it('routes Free Audit to /audit and paid tiers to /pricing', async () => {
    const offers = await loadPricingOffers();
    for (const tier of PRICING_TIERS) {
      const offer = offers.find((o) => o.name === tier.name)!;
      if (tier.id === 'free') {
        expect(offer.url).toContain('/audit');
      } else if (tier.id === 'enterprise') {
        expect(offer.url).toContain('/contact-sales');
      } else {
        expect(offer.url).toContain('/pricing');
      }
    }
  });
});
