import { describe, expect, it } from 'vitest';
import { canonicalJson, hashObject, sha256Hex } from '../../workers/govard-gateway/src/lib/hash';

describe('govard canonicalJson', () => {
  it('hasht strukturell identische Objekte unabhängig von der Schlüssel-Reihenfolge gleich', async () => {
    const a = { intent: 'send_email', budget: { currency: 'EUR', value: 500 } };
    const b = { budget: { value: 500, currency: 'EUR' }, intent: 'send_email' };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(await hashObject(a)).toBe(await hashObject(b));
  });

  it('lässt undefined-Felder aus, statt sie zu serialisieren', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it('bewahrt Array-Reihenfolge — sie ist bedeutungstragend', () => {
    expect(canonicalJson({ r: ['a', 'b'] })).not.toBe(canonicalJson({ r: ['b', 'a'] }));
  });

  it('kanonisiert null, Primitives und verschachtelte Strukturen deterministisch', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson({ x: { b: [1, null], a: 'ä"quote' } }))
      .toBe('{"x":{"a":"ä\\"quote","b":[1,null]}}');
  });

  it('sha256Hex liefert den bekannten Vektor für den leeren String', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
