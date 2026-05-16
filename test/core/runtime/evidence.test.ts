import { describe, it, expect } from 'vitest';
import { canonicalize, hashEvidence } from '../../../src/core/runtime/evidence';

describe('canonicalize', () => {
  it('sorts object keys recursively', () => {
    const a = canonicalize({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalize({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined properties', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ x: NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: Infinity })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: -Infinity })).toThrow(/non-finite/);
  });

  it('handles primitives and null', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(true)).toBe('true');
  });
});

describe('hashEvidence', () => {
  it('produces a 64-char lowercase hex digest', async () => {
    const hash = await hashEvidence({ name: 'tracker.pre_consent.detected' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable across key order', async () => {
    const a = await hashEvidence({ b: 1, a: 2 });
    const b = await hashEvidence({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('changes when content changes', async () => {
    const a = await hashEvidence({ tracker: 'gtm' });
    const b = await hashEvidence({ tracker: 'plausible' });
    expect(a).not.toBe(b);
  });

  it('matches the known SHA-256 of an empty object', async () => {
    // sha256 of the canonical JSON `{}` (two bytes: 0x7b 0x7d)
    expect(await hashEvidence({})).toBe(
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    );
  });
});
