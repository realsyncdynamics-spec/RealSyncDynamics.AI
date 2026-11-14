/**
 * Kleinunternehmer nach § 19 UStG (Entscheidung 2026-11-01, umgesetzt in #2157).
 *
 * Regressionsschutz über die Quelltexte der öffentlichen Preis-Oberflächen:
 * kein „€ … netto“, kein „zzgl. … Umsatzsteuer/USt/MwSt“, kein „plus/excl.
 * VAT“ und kein `valueAddedTaxIncluded` im Offer-Markup (ohne Umsatzsteuer ist
 * weder „inklusive“ noch „exklusive“ zutreffend). Modus und Hinweistexte
 * prüfen `test/billing/checkout-tax.test.ts` und `test/i18n/handoff-tax-copy.test.ts`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANS, PRICING_TAX_MODE, monthlyPriceText, planById } from '../../shared/pricing';

const ROOT = join(__dirname, '..', '..');

describe('Kleinunternehmer § 19 UStG: Beträge und Anzeige', () => {
  it('Steuermodus ist EXEMPT', () => {
    expect(PRICING_TAX_MODE).toBe('EXEMPT');
  });

  it('Preis-Snapshot unverändert: 0 / 79 / 249 / 699 / 1.498 €', () => {
    expect(planById('free').price.monthlyEur).toBe(0);
    expect(planById('starter').price.monthlyEur).toBe(79);
    expect(planById('growth').price.monthlyEur).toBe(249);
    expect(planById('agency').price.monthlyEur).toBe(699);
    expect(planById('enterprise').price.monthlyEur).toBe(1498);
  });

  it('kein „netto“ an einem Monatspreis', () => {
    for (const plan of PLANS) expect(monthlyPriceText(plan)).not.toMatch(/netto/);
  });
});

/** Öffentliche Oberflächen mit Preisangaben (ohne Finanz-/Steuer-Fachmodul). */
const SCAN_PATHS = [
  'index.html',
  'public/llms.txt',
  'src/pages',
  'src/components/landing',
  'src/components/pricing',
  'src/features/billing',
  'src/features/legal/LegalTerms.tsx',
  'src/enterprise-os/pages/LegalPage.tsx',
  'src/config/seo.ts',
  'src/content/pricingContent.ts',
  'src/lib/optimizer',
];

function collect(path: string): string[] {
  const abs = join(ROOT, path);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((name) => collect(join(path, name)));
}

const FORBIDDEN: Array<[string, RegExp]> = [
  ['Betrag mit „netto“', /\d\s*€[^\n"'`]{0,12}netto/],
  ['„zzgl. … Umsatzsteuer/USt/MwSt“', /zzgl\.?[^\n]{0,40}(Umsatzsteuer|\bUSt\b|MwSt)/],
  ['„exkl. MwSt/USt“', /exkl\.?\s*(MwSt|USt)/i],
  ['„plus VAT“ / „excl. VAT“', /plus VAT|excl\.? VAT/i],
  ['valueAddedTaxIncluded im Offer-Markup', /valueAddedTaxIncluded\s*:/],
];

describe('Regression: keine Netto-/USt-Angaben auf Preis-Oberflächen', () => {
  const files = SCAN_PATHS.flatMap(collect).filter((f) => /\.(tsx?|html|txt)$/.test(f));

  it.each(FORBIDDEN)('%s', (_label, pattern) => {
    const hits = files
      .filter((f) => pattern.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
