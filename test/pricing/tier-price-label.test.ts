/**
 * Kein Betrag ohne Kaufpfad — geprüft an der Quelle, nicht je Oberfläche.
 *
 * Am 2026-09-27 zeigten sechs Oberflächen „1.249 €" für Enterprise, einen
 * Plan, den es nur per Vertrag gibt (`priceOnRequest: true`): Optimizer,
 * Governance Score, Upgrade-Dialog, Plan-Auswahl, Billing und die
 * Enterprise-Sektion. Jede hatte die Regel selbst zu prüfen, und keine tat es.
 * `check:offer-prices` fand keinen der Fälle, weil der Betrag erst zur
 * Laufzeit aus `priceString` entsteht und nie als Literal im Quelltext steht.
 *
 * Deshalb zwei Prüfungen, die zusammen die Klasse schließen:
 *   1. `tierPriceLabel()` gibt für jeden Anfrage-Plan keine Ziffer aus.
 *   2. Außerhalb der Projektion greift keine Anzeige direkt auf `.priceString`
 *      zu — jede muss durch `tierPriceLabel()`. Eine neue Oberfläche, die den
 *      Umweg spart, fällt hier auf, bevor sie ausgeliefert wird.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ON_REQUEST_LABEL, PRICING_TIERS, tierPriceLabel } from '../../src/config/pricing';

describe('tierPriceLabel', () => {
  it('es gibt mindestens einen Anfrage-Plan — sonst prüft der Test nichts', () => {
    expect(PRICING_TIERS.some((t) => t.priceOnRequest)).toBe(true);
  });

  it('ein Anfrage-Plan zeigt das Label und keine Ziffer, gleich mit welchem Suffix', () => {
    for (const tier of PRICING_TIERS.filter((t) => t.priceOnRequest)) {
      for (const suffix of [' €', '€', ' €/Mo.', '']) {
        const label = tierPriceLabel(tier, suffix);
        expect(label, `${tier.id} mit Suffix "${suffix}"`).toBe(ON_REQUEST_LABEL);
        expect(label, `${tier.id} mit Suffix "${suffix}"`).not.toMatch(/\d/);
      }
    }
  });

  it('ein Plan mit Festpreis zeigt genau seinen Betrag — nicht bloß irgendeine Zahl', () => {
    for (const tier of PRICING_TIERS.filter((t) => !t.priceOnRequest)) {
      expect(tierPriceLabel(tier), tier.id).toBe(`${tier.priceString} €`);
      expect(tierPriceLabel(tier, '/Mo.'), tier.id).toBe(`${tier.priceString}/Mo.`);
    }
  });
});

/**
 * Dateien, die `.priceString` lesen dürfen, jeweils mit Grund. Wer hier
 * etwas ergänzt, muss begründen, warum der Wert kein SSoT-Betrag ist.
 */
const ALLOWED: Record<string, string> = {
  'src/config/pricing.ts': 'Definition der Projektion und von tierPriceLabel selbst',
  'src/content/pricingContent.ts':
    'eigener Typ mit Text statt Beträgen („Individuelles Angebot"); geprüft in test/content/pricingContent.test.ts',
  'src/components/pricing/FeatureDetailPage.tsx': 'liest pricingContent, nicht die SSoT-Projektion',
  'src/components/pricing/PlanDetailPage.tsx': 'liest pricingContent, nicht die SSoT-Projektion',
};

const ROOT = resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** Kommentare tragen Erklärungen, keine Anzeigen — sonst meldet der Test seine eigene Doku. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Anzeigen lesen priceString nur über tierPriceLabel', () => {
  it('kein direkter Zugriff auf .priceString außerhalb der Ausnahmeliste', () => {
    const offenders = sourceFiles(join(ROOT, 'src'))
      .map((abs) => relative(ROOT, abs).split('\\').join('/'))
      .filter((rel) => !(rel in ALLOWED))
      .filter((rel) => /\.priceString\b/.test(stripComments(readFileSync(join(ROOT, rel), 'utf8'))));

    expect(
      offenders,
      'Diese Dateien lesen .priceString direkt. Über tierPriceLabel() aus ' +
        'src/config/pricing.ts gehen — sonst zeigt die Oberfläche für ' +
        'Anfrage-Pläne einen Betrag, den kein Kaufpfad einlöst.',
    ).toEqual([]);
  });

  it('jede Ausnahme existiert noch — eine verwaiste Ausnahme wäre ein stilles Loch', () => {
    for (const rel of Object.keys(ALLOWED)) {
      expect(() => statSync(join(ROOT, rel)), rel).not.toThrow();
    }
  });
});
