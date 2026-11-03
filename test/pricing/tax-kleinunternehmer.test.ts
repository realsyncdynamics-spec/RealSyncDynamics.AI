/**
 * Kleinunternehmer nach § 19 UStG (Entscheidung Dominik 2026-11-01).
 *
 * Die Website darf keine Netto-Preise und kein „zzgl. Umsatzsteuer“ mehr
 * ausweisen; der § 19-Hinweis kommt aus einer Stelle (`TAX_NOTICE` in
 * shared/pricing.ts). Beträge bleiben unverändert.
 *
 * Stripe/Billing (`PRICING_TAX_MODE`) ist bewusst NICHT Teil dieser Prüfung:
 * die Umstellung braucht eine eigene Freigabe (siehe Kommentar in
 * shared/pricing.ts).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLANS,
  PRICE_DISPLAY_TAX_MODE,
  PRICING_TAX_NOTE,
  TAX_NOTICE,
  TAX_NOTICE_EN,
  formatNetVatGrossEur,
  monthlyPriceSuffix,
  monthlyPriceText,
  planById,
  pricingTaxNote,
} from '../../shared/pricing';
import { COMPANY } from '../../src/config/company';

const ROOT = join(__dirname, '..', '..');

describe('Steuer-Anzeige: Kleinunternehmer § 19 UStG', () => {
  it('Anzeige-Steuermodus ist EXEMPT, COMPANY folgt ihm', () => {
    expect(PRICE_DISPLAY_TAX_MODE).toBe('EXEMPT');
    expect(COMPANY.taxMode).toBe('EXEMPT');
  });

  it('§ 19-Hinweis hat genau einen Wortlaut (DE/EN)', () => {
    expect(TAX_NOTICE).toBe('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
    expect(TAX_NOTICE_EN).toBe('VAT exempt under § 19 UStG (German small business regulation).');
  });

  it('Steuerhinweis: B2B-Satz bleibt, USt-Teil ist der § 19-Hinweis', () => {
    const note = pricingTaxNote(COMPANY.taxMode);
    expect(note).toBe(`Angebot nur für Unternehmer (B2B) – ${TAX_NOTICE}`);
    expect(PRICING_TAX_NOTE).toBe(note);
    expect(note).not.toMatch(/zzgl|netto/i);
  });

  it('kein „netto“ an Monatspreisen, auch nicht bei netPriceLabel (Enterprise)', () => {
    for (const plan of PLANS) {
      expect(monthlyPriceSuffix(plan)).toBe('/ Monat');
      expect(monthlyPriceText(plan)).not.toMatch(/netto/);
    }
    expect(formatNetVatGrossEur(79)).not.toMatch(/netto|USt|brutto/);
  });

  it('Preis-Snapshot unverändert: 0 / 79 / 249 / 699 / 1.498 €', () => {
    expect(planById('free').price.monthlyEur).toBe(0);
    expect(planById('starter').price.monthlyEur).toBe(79);
    expect(planById('growth').price.monthlyEur).toBe(249);
    expect(planById('agency').price.monthlyEur).toBe(699);
    expect(planById('enterprise').price.monthlyEur).toBe(1498);
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
  ['valueAddedTaxIncluded im Offer-Markup', /valueAddedTaxIncluded/],
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
