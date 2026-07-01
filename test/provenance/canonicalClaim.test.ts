import { describe, it, expect } from 'vitest';
import {
  canonicalClaimBytes,
  claimHash,
  sha256HexOfString,
  type ProvenanceClaim,
} from '../../src/lib/provenance/canonicalClaim';

const base: ProvenanceClaim = {
  assetRef: 'AST-2026-0007',
  contentSha256: 'a'.repeat(64),
  issuer: 'tenant:acme',
  action: 'registered',
  timestamp: '2026-07-01T10:00:00.000Z',
  prevHash: null,
};

describe('canonicalClaimBytes', () => {
  it('ist deterministisch — gleiches Input, gleiche Bytes', () => {
    expect(canonicalClaimBytes(base)).toEqual(canonicalClaimBytes({ ...base }));
  });

  it('nutzt feste Schlüssel-Reihenfolge unabhängig von Objekt-Insert-Order', () => {
    const shuffled: ProvenanceClaim = {
      prevHash: null,
      timestamp: '2026-07-01T10:00:00.000Z',
      action: 'registered',
      issuer: 'tenant:acme',
      contentSha256: 'a'.repeat(64),
      assetRef: 'AST-2026-0007',
    };
    expect(canonicalClaimBytes(shuffled)).toEqual(canonicalClaimBytes(base));
  });

  it('normalisiert Hex (0x-Präfix, Groß-/Kleinschreibung)', () => {
    const upper = canonicalClaimBytes({ ...base, contentSha256: '0X' + 'A'.repeat(64) });
    expect(upper).toEqual(canonicalClaimBytes(base));
  });

  it('unterscheidet Claims mit verschiedenem contentSha256', () => {
    const other = canonicalClaimBytes({ ...base, contentSha256: 'b'.repeat(64) });
    expect(other).not.toEqual(canonicalClaimBytes(base));
  });
});

describe('sha256HexOfString', () => {
  it('erzeugt den bekannten SHA-256 Testvektor für "abc"', async () => {
    expect(await sha256HexOfString('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('erzeugt 64 Hex-Zeichen', async () => {
    const hex = await sha256HexOfString('irgendwas');
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('claimHash', () => {
  it('ist stabil über Aufrufe', async () => {
    expect(await claimHash(base)).toBe(await claimHash({ ...base }));
  });

  it('ändert sich, wenn prevHash sich ändert (Verkettung)', async () => {
    const a = await claimHash(base);
    const b = await claimHash({ ...base, prevHash: 'f'.repeat(64) });
    expect(a).not.toBe(b);
  });
});
