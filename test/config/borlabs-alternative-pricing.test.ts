/**
 * Die Borlabs-Alternative nennt den Borlabs-Preis aus der zentralen Quelle.
 *
 * Befund 27.09.: `src/config/competitor-pricing.ts` fuehrte 79 €/Jahr, die
 * Seite hart codiert ~99 €/Jahr an zwei Stellen. Entscheidung Dominik: 79 €.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPETITOR_PRICING } from '../../src/config/competitor-pricing';

const QUELLE = readFileSync(
  resolve(__dirname, '../../src/pages/BorlabsAlternative.tsx'),
  'utf8',
);

describe('BorlabsAlternative: Preis aus COMPETITOR_PRICING', () => {
  it('SSOT fuehrt 79 €/Jahr', () => {
    expect(COMPETITOR_PRICING.BorlabsCookie.pricing).toMatch(/^79 €\/Jahr/);
  });

  it('die Seite liest den Preis aus der SSOT', () => {
    expect(QUELLE).toContain('COMPETITOR_PRICING.BorlabsCookie.pricing');
  });

  it('kein hart codierter Borlabs-Preis mehr', () => {
    expect(QUELLE).not.toMatch(/99 €\/Jahr/);
  });
});
