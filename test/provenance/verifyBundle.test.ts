import { describe, it, expect } from 'vitest';
import { claimHash, type ProvenanceClaim } from '../../src/lib/provenance/canonicalClaim';
import { generateEd25519KeyPair, signEd25519, exportPublicKeySpkiB64 } from '../../src/lib/provenance/signature';
import { verifyBundle, type ProvenanceBundle, type BundleEvent } from '../../src/lib/provenance/verifyBundle';

const DIGEST = 'a'.repeat(64);
const ASSET = 'AST-2026-0007';

/** Baut ein gültiges, Ed25519-signiertes Bündel (wie es buildProvenanceBundle exportiert). */
async function buildBundle(n: number): Promise<ProvenanceBundle> {
  const kp = await generateEd25519KeyPair();
  const spki_b64 = await exportPublicKeySpkiB64(kp.publicKey);
  const events: BundleEvent[] = [];
  let prev: string | null = null;
  for (let seq = 1; seq <= n; seq++) {
    const action = seq === 1 ? 'registered' : 'audited';
    const event_ts = `2026-07-02T10:0${seq}:00.000Z`;
    const claim: ProvenanceClaim = { assetRef: ASSET, contentSha256: DIGEST, issuer: 'tenant:t1', action, timestamp: event_ts, prevHash: prev };
    const event_hash = await claimHash(claim);
    const signature = await signEd25519(kp.privateKey, event_hash);
    events.push({ seq, action, actor: 'tenant:t1', content_sha256: DIGEST, event_ts, prev_hash: prev, event_hash, signature, signature_alg: 'ed25519' });
    prev = event_hash;
  }
  return { format: 'rsd-provenance-bundle', version: 1, asset_ref: ASSET, exported_at: new Date().toISOString(), public_key: { alg: 'ed25519', key_id: 'rsd-ed25519-1', spki_b64 }, events };
}

describe('verifyBundle — gültig', () => {
  it('bestätigt Kette + Signaturen vollständig (offline, Schlüssel aus Bündel)', async () => {
    const r = await verifyBundle(await buildBundle(3));
    expect(r.ok).toBe(true);
    expect(r.chainIntact).toBe(true);
    expect(r.signaturesVerified).toBe(3);
    expect(r.issues).toEqual([]);
  });

  it('akzeptiert unsortierte Events', async () => {
    const b = await buildBundle(3);
    b.events = [b.events[2], b.events[0], b.events[1]];
    expect((await verifyBundle(b)).ok).toBe(true);
  });
});

describe('verifyBundle — Manipulation', () => {
  it('erkennt veränderten Inhalt', async () => {
    const b = await buildBundle(2);
    b.events[1] = { ...b.events[1], content_sha256: 'b'.repeat(64) };
    expect((await verifyBundle(b)).issues.some((i) => i.kind === 'hash_mismatch')).toBe(true);
  });

  it('erkennt gebrochene Verkettung', async () => {
    const b = await buildBundle(3);
    b.events[2] = { ...b.events[2], prev_hash: 'f'.repeat(64) };
    expect((await verifyBundle(b)).issues.some((i) => i.kind === 'broken_link')).toBe(true);
  });

  it('erkennt eine ungültige Signatur (fremder Schlüssel) bei intakter Kette', async () => {
    const b = await buildBundle(2);
    const other = await generateEd25519KeyPair();
    b.events[1] = { ...b.events[1], signature: await signEd25519(other.privateKey, b.events[1].event_hash) };
    expect((await verifyBundle(b)).issues.some((i) => i.kind === 'signature_invalid')).toBe(true);
  });

  it('erkennt fehlenden Genesis', async () => {
    const b = await buildBundle(3);
    b.events = [b.events[1], b.events[2]];
    expect((await verifyBundle(b)).issues.some((i) => i.kind === 'missing_genesis')).toBe(true);
  });
});

describe('verifyBundle — kein Schlüssel / HMAC', () => {
  it('meldet fehlenden Schlüssel als unverifizierbar (Kette bleibt ok)', async () => {
    const b = await buildBundle(2);
    b.public_key = null;
    const r = await verifyBundle(b);
    expect(r.ok).toBe(true);
    expect(r.signaturesUnverifiable).toBe(2);
    expect(r.signaturesVerified).toBe(0);
  });

  it('meldet HMAC als unverifizierbar (kein signature_invalid)', async () => {
    const b = await buildBundle(1);
    b.events[0] = { ...b.events[0], signature_alg: 'hmac-sha256' };
    const r = await verifyBundle(b);
    expect(r.signaturesUnverifiable).toBe(1);
    expect(r.issues.some((i) => i.kind === 'signature_invalid')).toBe(false);
  });
});
