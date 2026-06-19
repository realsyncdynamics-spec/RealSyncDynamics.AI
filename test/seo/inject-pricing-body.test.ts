/**
 * Tests fuer scripts/inject-pricing-body.mts — die deterministische Body-
 * Prerender-Injektion fuer /pricing.
 *
 * Hintergrund (Befund 1): Der Pricing-Content (Tarif-Karten) ist client-only;
 * der Playwright-Prerender hydriert im CI nicht zuverlaessig, dann bleibt #root
 * leer und Crawler ohne JS sehen kein Pricing. Dieses Script fuellt ein LEERES
 * #root deterministisch aus src/config/pricing.ts. Diese Tests pinnen die
 * Kern-Invarianten: alle Tarife/Preise/Bullets im Output, Enterprise-Banner,
 * korrekte CTA-Links, und Idempotenz (gefuelltes #root wird nicht angefasst).
 */
import { describe, it, expect } from 'vitest';
import { esc, buildPricingBodyHtml, injectPricingBody } from '../../scripts/inject-pricing-body.mts';
import { PUBLIC_PRICING_TIERS, ENTERPRISE_TIER, PRICING_TRUST_NOTE } from '../../src/config/pricing';

const EMPTY_SHELL = `<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>`;

describe('esc', () => {
  it('escaped Ampersand, Quotes und Winkelklammern', () => {
    expect(esc('DSGVO & "AI Act" <x>')).toBe('DSGVO &amp; &quot;AI Act&quot; &lt;x&gt;');
  });
});

describe('buildPricingBodyHtml', () => {
  const body = buildPricingBodyHtml();

  it('enthaelt Hero-H1 und Prerender-Marker', () => {
    expect(body).toContain('<h1>Welche Governance-Abdeckung passt zu Ihnen?</h1>');
    expect(body).toContain('data-prerender="pricing"');
  });

  it('enthaelt jeden oeffentlichen Tarif mit Name, Preis-Suffix, Tagline und CTA-Link', () => {
    for (const tier of PUBLIC_PRICING_TIERS) {
      expect(body, `${tier.id} name`).toContain(`<h2>${esc(tier.name)}</h2>`);
      expect(body, `${tier.id} suffix`).toContain(esc(tier.priceSuffix));
      expect(body, `${tier.id} tagline`).toContain(esc(tier.tagline));
      expect(body, `${tier.id} cta`).toContain(`href="${esc(tier.cta.href)}"`);
      expect(body, `${tier.id} cta label`).toContain(esc(tier.cta.label));
      for (const bullet of tier.bullets) {
        expect(body, `${tier.id} bullet`).toContain(`<li>${esc(bullet)}</li>`);
      }
    }
  });

  it('rendert konkrete kanonische Preise (Starter 79, Growth 249, Agency 699, Scale 1.999)', () => {
    expect(body).toContain('79 €');
    expect(body).toContain('249 €');
    expect(body).toContain('699 €');
    // Scale: priceEur=1999 -> "1999 €" als Anzeige (priceString "1.999" ist das
    // Stripe-Offer-Schema, die TierCard zeigt priceEur). Pinnt das Verhalten.
    expect(body).toContain('1999 €');
  });

  it('enthaelt Enterprise-Banner (Name, individueller Preis, Anfrage-CTA) und Trust-Note', () => {
    expect(body).toContain(esc(ENTERPRISE_TIER.name));
    expect(body).toContain(esc(ENTERPRISE_TIER.priceString)); // "individuell"
    expect(body).toContain(`href="${esc(ENTERPRISE_TIER.cta.href)}"`);
    expect(body).toContain(esc(PRICING_TRUST_NOTE));
  });
});

describe('injectPricingBody', () => {
  it('fuellt ein leeres #root mit dem Pricing-Body', () => {
    const out = injectPricingBody(EMPTY_SHELL);
    expect(out).not.toContain('<div id="root"></div>');
    expect(out).toContain('data-prerender="pricing"');
    expect(out).toContain('Welche Governance-Abdeckung passt zu Ihnen?');
  });

  it('ist idempotent: ein bereits gefuelltes #root bleibt unveraendert', () => {
    const once = injectPricingBody(EMPTY_SHELL);
    const twice = injectPricingBody(once);
    expect(twice).toBe(once);
    // genau ein Pricing-Block, keine Verdopplung
    expect((twice.match(/data-prerender="pricing"/g) ?? []).length).toBe(1);
  });

  it('laesst vorhandenen Prerender-Content (nicht-leeres #root) unangetastet', () => {
    const prerendered = `<body><div id="root"><main>echter prerender content</main></div></body>`;
    expect(injectPricingBody(prerendered)).toBe(prerendered);
  });
});
