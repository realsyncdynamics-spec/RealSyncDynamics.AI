import { describe, it, expect } from 'vitest';
import {
  verifyChain, verifyAllChains, serializeSnapshotForHash, normalizeHex,
  type SnapshotRecord, type HashHex,
} from '../../src/lib/evidence/verifyChain';

// Echte SHA-256-Hex-Funktion (Node/Browser-WebCrypto) — identisch zur Edge-Fn.
const sha256Hex: HashHex = async (input: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const DIGEST = 'a'.repeat(64);

/** Baut eine gültige, korrekt verkettete Snapshot-Kette. */
async function buildChain(subject: string, n: number): Promise<SnapshotRecord[]> {
  const out: SnapshotRecord[] = [];
  let prev: string | null = null;
  for (let v = 1; v <= n; v++) {
    const rec: SnapshotRecord = {
      subject_ref: subject,
      version: v,
      content_sha256: DIGEST,
      retention_class: 'forever',
      prev_hash: prev,
      event_hash: '',
      event_timestamp: `2026-07-02T10:0${v}:00.000Z`,
    };
    rec.event_hash = await sha256Hex(serializeSnapshotForHash(rec));
    prev = rec.event_hash;
    out.push(rec);
  }
  return out;
}

describe('verifyChain — gültige Ketten', () => {
  it('bestätigt eine intakte Kette vollständig', async () => {
    const chain = await buildChain('asset:1', 3);
    const r = await verifyChain(chain, sha256Hex);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.cryptoVerified).toBe(3);
    expect(r.legacy).toBe(0);
  });

  it('akzeptiert unsortierte Eingabe', async () => {
    const chain = await buildChain('asset:1', 3);
    const shuffled = [chain[2], chain[0], chain[1]];
    const r = await verifyChain(shuffled, sha256Hex);
    expect(r.ok).toBe(true);
  });
});

describe('verifyChain — Manipulation & Defekte', () => {
  it('erkennt eine nachträgliche Content-Änderung (hash_mismatch)', async () => {
    const chain = await buildChain('asset:1', 2);
    chain[1] = { ...chain[1], content_sha256: 'b'.repeat(64) }; // event_hash bleibt alt
    const r = await verifyChain(chain, sha256Hex);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === 'hash_mismatch')).toBe(true);
  });

  it('erkennt eine gebrochene Verkettung (broken_link)', async () => {
    const chain = await buildChain('asset:1', 3);
    chain[2] = { ...chain[2], prev_hash: 'f'.repeat(64) };
    const r = await verifyChain(chain, sha256Hex);
    expect(r.issues.some((i) => i.kind === 'broken_link')).toBe(true);
  });

  it('erkennt eine Versionslücke', async () => {
    const chain = await buildChain('asset:1', 3);
    const gapped = [chain[0], chain[2]]; // Version 2 fehlt
    const r = await verifyChain(gapped, sha256Hex);
    expect(r.issues.some((i) => i.kind === 'version_gap')).toBe(true);
  });

  it('erkennt fehlenden Genesis (Kette beginnt nicht bei 1)', async () => {
    const chain = await buildChain('asset:1', 3);
    const r = await verifyChain([chain[1], chain[2]], sha256Hex);
    expect(r.issues.some((i) => i.kind === 'missing_genesis')).toBe(true);
  });

  it('erkennt einen prev_hash am Genesis', async () => {
    const chain = await buildChain('asset:1', 1);
    chain[0] = { ...chain[0], prev_hash: 'c'.repeat(64) };
    // event_hash neu berechnen, damit NUR der Genesis-Link-Fehler greift
    chain[0].event_hash = await sha256Hex(serializeSnapshotForHash(chain[0]));
    const r = await verifyChain(chain, sha256Hex);
    expect(r.issues.some((i) => i.kind === 'broken_link')).toBe(true);
  });

  it('meldet ungültiges content_sha256-Format', async () => {
    const chain = await buildChain('asset:1', 1);
    chain[0] = { ...chain[0], content_sha256: 'zzz' };
    chain[0].event_hash = await sha256Hex(serializeSnapshotForHash(chain[0]));
    const r = await verifyChain(chain, sha256Hex);
    expect(r.issues.some((i) => i.kind === 'bad_content_digest')).toBe(true);
  });
});

describe('verifyChain — Legacy (kein event_timestamp)', () => {
  it('prüft strukturell, überspringt Krypto und zählt legacy', async () => {
    const chain = await buildChain('asset:1', 2);
    const legacy = chain.map((s) => ({ ...s, event_timestamp: null }));
    const r = await verifyChain(legacy, sha256Hex);
    expect(r.legacy).toBe(2);
    expect(r.cryptoVerified).toBe(0);
    // Struktur ist intakt → keine hash_mismatch-Issues.
    expect(r.issues.some((i) => i.kind === 'hash_mismatch')).toBe(false);
    expect(r.issues.filter((i) => i.kind === 'broken_link')).toEqual([]);
  });
});

describe('verifyAllChains', () => {
  it('gruppiert nach subject_ref und sortiert deterministisch', async () => {
    const a = await buildChain('asset:a', 2);
    const b = await buildChain('asset:b', 1);
    const reports = await verifyAllChains([...b, ...a], sha256Hex);
    expect(reports.map((r) => r.subjectRef)).toEqual(['asset:a', 'asset:b']);
    expect(reports.every((r) => r.ok)).toBe(true);
  });
});

describe('normalizeHex', () => {
  it('trimmt, kleinschreibt und entfernt 0x-Präfix', () => {
    expect(normalizeHex('  0xABCdef  ')).toBe('abcdef');
  });
});
