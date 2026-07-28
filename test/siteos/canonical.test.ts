import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalHash, sha256Hex } from '../../packages/siteos-core/src/canonical';

// Die Kanonisierung ist der Anker jedes Nachweises. Bricht eine dieser
// Zusicherungen, werden alle bereits ausgestellten Blueprint-Hashes
// unprüfbar — die Tests sind deshalb absichtlich streng.
describe('canonicalize', () => {
  it('sortiert Objektschlüssel unabhängig von der Einfügereihenfolge', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ a: 2, b: 1 })).toBe(canonicalize({ b: 1, a: 2 }));
  });

  it('sortiert auch verschachtelt', () => {
    const left = { outer: { z: 1, a: { y: 2, b: 3 } } };
    const right = { outer: { a: { b: 3, y: 2 }, z: 1 } };
    expect(canonicalize(left)).toBe(canonicalize(right));
  });

  it('erhält die Array-Reihenfolge', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });

  it('lässt undefined-Felder aus, statt sie als null zu schreiben', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('behält Array-Positionen bei undefined-Elementen', () => {
    // Analog zu JSON.stringify: die Position darf nicht verrutschen, sonst
    // ändert sich die Bedeutung der Liste.
    expect(canonicalize([1, undefined, 3])).toBe('[1,null,3]');
  });

  it('reduziert Date auf ISO-8601', () => {
    expect(canonicalize({ at: new Date(0) })).toBe('{"at":"1970-01-01T00:00:00.000Z"}');
  });

  it('wirft bei nicht darstellbaren Zahlen', () => {
    expect(() => canonicalize({ x: NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: Infinity })).toThrow(/non-finite/);
  });

  it('wirft bei einem Top-Level-undefined', () => {
    expect(() => canonicalize(undefined)).toThrow(/not serializable/);
  });

  it('unterscheidet Zahl und Zahl als Zeichenkette', () => {
    expect(canonicalize({ v: 1 })).not.toBe(canonicalize({ v: '1' }));
  });
});

describe('sha256Hex', () => {
  it('liefert den bekannten Digest der leeren Zeichenkette', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('liefert 64 Hex-Zeichen in Kleinschreibung', async () => {
    expect(await sha256Hex('realsync')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalHash', () => {
  it('ist unabhängig von der Schlüsselreihenfolge', async () => {
    const a = await canonicalHash({ slug: 'x', version: 1, pages: [{ path: '/', title: 'A' }] });
    const b = await canonicalHash({ pages: [{ title: 'A', path: '/' }], version: 1, slug: 'x' });
    expect(a).toBe(b);
  });

  it('ändert sich bei inhaltlicher Abweichung', async () => {
    const a = await canonicalHash({ slug: 'x', version: 1 });
    const b = await canonicalHash({ slug: 'x', version: 2 });
    expect(a).not.toBe(b);
  });
});
