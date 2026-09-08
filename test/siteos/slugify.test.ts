import { describe, expect, it } from 'vitest';
import { slugify } from '../../packages/siteos-core/src/blueprint/synthesize';

/**
 * `slugify` bestimmt Site-Slug und Block-IDs und damit den kanonischen Hash.
 * Die Rand-Beschneidung wurde am 2026-09-07 von `-+$` auf `-$` umgestellt
 * (CodeQL js/polynomial-redos, erreichbar über `validatePageSlug` in pages.ts).
 * Das darf das Ergebnis für keine Eingabe ändern — sonst bekäme derselbe Brief
 * einen anderen Hash. Hier steht die frühere Fassung als Vergleichsmaßstab.
 */
function slugifyBefore(input: string): string {
  const umlauts: Record<string, string> = {
    ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ç: 'c',
  };
  let transliterated = '';
  for (const char of input.toLowerCase()) transliterated += umlauts[char] ?? char;
  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'site';
}

const INPUTS = [
  '', '-', '---', 'Zahnarztpraxis Dr. Müller', '/leistungen/', '--a--b--', 'a' + '-'.repeat(200) + 'b',
  '-'.repeat(5000), 'x'.repeat(63) + '-' + 'y', 'x'.repeat(64) + '--tail', 'Straße 12 / Hamburg',
  '/über-uns', '#!?', 'çà và', 'a-'.repeat(40), '-'.repeat(70) + 'ende',
];

describe('slugify', () => {
  it('liefert für jede Eingabe dasselbe wie vor der ReDoS-Bereinigung', () => {
    for (const input of INPUTS) expect(slugify(input)).toBe(slugifyBefore(input));
  });

  it('kennt nach dem Zusammenfassen keine doppelten Bindestriche mehr — der Grund, warum `-$` reicht', () => {
    for (const input of INPUTS) expect(slugify(input)).not.toMatch(/--/);
  });

  it('beschneidet nur einzelne Rand-Bindestriche', () => {
    expect(slugify('--a--')).toBe('a');
    expect(slugify('a' + '-'.repeat(200) + 'b')).toBe('a-b');
    expect(slugify('x'.repeat(63) + '-' + 'y')).toBe('x'.repeat(63));
    expect(slugify('-'.repeat(5000))).toBe('site');
  });
});
