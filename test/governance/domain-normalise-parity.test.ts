/**
 * Parität: normaliseDomain im Client vs. in der Edge Function
 *
 * Die Funktion existiert zweimal:
 *   src/features/governance/scans/scansApi.ts                  (Client)
 *   supabase/functions/tenant-website-register/index.ts        (Deno, Spiegel)
 *
 * Deno erreicht `src/` nicht — das Repo spiegelt solche Helfer bewusst und
 * bindet sie per Test (gleiches Vorgehen wie rfc003-sql-parity.test.ts).
 *
 * Warum die Bindung hier zählt: `websites` hat `unique (tenant_id, domain)`.
 * Normalisieren Client und Server verschieden, halten beide dieselbe Eingabe
 * für verschiedene Domains — das UI zeigt einen Duplikatfehler, wo keiner ist,
 * oder legt zwei Zeilen für dieselbe Website an.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { __test } from '@/src/features/governance/scans/scansApi';

const ROOT = resolve(__dirname, '../..');

const clientSrc = readFileSync(resolve(ROOT, 'src/features/governance/scans/scansApi.ts'), 'utf8');
const edgeSrc = readFileSync(
  resolve(ROOT, 'supabase/functions/tenant-website-register/index.ts'),
  'utf8',
);

/** Schneidet die Funktion heraus, bis zur schließenden Klammer in Spalte 0. */
function extract(source: string): string {
  const start = source.indexOf('function normaliseDomain');
  expect(start, 'normaliseDomain nicht gefunden').toBeGreaterThan(-1);
  const end = source.indexOf('\n}', start);
  expect(end, 'Ende von normaliseDomain nicht gefunden').toBeGreaterThan(start);
  return source.slice(start, end + 2).replace(/\s+/g, ' ').trim();
}

describe('normaliseDomain — Parität Client ↔ Edge', () => {
  it('beide Fassungen existieren', () => {
    expect(clientSrc).toContain('function normaliseDomain');
    expect(edgeSrc).toContain('function normaliseDomain');
  });

  it('der Rumpf ist zeichengleich (bis auf Formatierung)', () => {
    expect(extract(edgeSrc)).toBe(extract(clientSrc));
  });

  it('die Edge-Fassung verweist auf ihre Quelle', () => {
    // Ohne Hinweis findet niemand die zweite Fassung, wenn er die erste ändert.
    expect(edgeSrc).toContain('scansApi.ts');
    expect(edgeSrc).toContain('domain-normalise-parity');
  });
});

describe('normaliseDomain — Verhalten (Client-Fassung, gilt via Parität für beide)', () => {
  const { normaliseDomain } = __test;

  it('normalisiert Schema, Pfad und Groß-/Kleinschreibung weg', () => {
    expect(normaliseDomain('https://Example.COM/pfad?x=1')).toBe('example.com');
  });

  it('weist an, was keine Domain ist', () => {
    expect(normaliseDomain('kein hostname')).toBeNull();
    expect(normaliseDomain('https://')).toBeNull();
    expect(normaliseDomain('')).toBeNull();
  });

  it('bildet dieselbe Website auf denselben Wert ab — Grundlage des Unique-Index', () => {
    const variants = [
      'example.de',
      'EXAMPLE.de',
      '  example.de  ',
      'https://example.de',
      'http://example.de/',
      'https://example.de/impressum',
    ];
    const normalised = new Set(variants.map((v) => normaliseDomain(v)));
    expect(normalised.size, `uneinheitlich: ${[...normalised].join(', ')}`).toBe(1);
  });
});
