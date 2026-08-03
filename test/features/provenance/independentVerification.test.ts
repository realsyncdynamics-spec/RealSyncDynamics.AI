/**
 * independentlyVerifySignatures — the client-side re-check that makes
 * "externally verifiable" a real capability rather than a server claim.
 * Given a custody chain and the (mocked) public `pubkey` response, it must
 * recompute the Ed25519 verification itself using Web Crypto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateEd25519KeyPair,
  signEd25519,
  exportPublicKeySpkiB64,
} from '../../../src/lib/provenance/signature';

let invokeResponse: { data: unknown; error: unknown };

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: () => Promise.resolve(invokeResponse),
    },
  }),
}));

import { independentlyVerifySignatures, type CustodyEntry } from '../../../src/features/provenance/provenanceApi';

const EVENT_HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);

function makeEntry(overrides: Partial<CustodyEntry> = {}): CustodyEntry {
  return {
    seq: 1,
    action: 'registered',
    actor: 'tenant:x',
    timestamp: '2026-01-01T00:00:00Z',
    event_hash: EVENT_HASH,
    signed: true,
    signature: null,
    signature_alg: 'ed25519',
    ...overrides,
  };
}

describe('independentlyVerifySignatures', () => {
  beforeEach(() => {
    invokeResponse = { data: null, error: null };
  });

  it('reports publicKeyAvailable=false when no ed25519 entries are signed', async () => {
    const entries = [makeEntry({ signature: null, signature_alg: null })];
    const result = await independentlyVerifySignatures(entries);
    expect(result.publicKeyAvailable).toBe(false);
    expect(result.checkedCount).toBe(0);
  });

  it('reports publicKeyAvailable=false when no public key is configured server-side', async () => {
    invokeResponse = { data: { ok: true, alg: null, key_id: null, public_key_spki_b64: null }, error: null };
    const entries = [makeEntry({ signature: 'ff'.repeat(64) })];
    const result = await independentlyVerifySignatures(entries);
    expect(result.publicKeyAvailable).toBe(false);
  });

  it('verifies a genuine Ed25519 signature against the fetched public key', async () => {
    const kp = await generateEd25519KeyPair();
    const spkiB64 = await exportPublicKeySpkiB64(kp.publicKey);
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    invokeResponse = {
      data: { ok: true, alg: 'ed25519', key_id: 'test-key', public_key_spki_b64: spkiB64 },
      error: null,
    };

    const entries = [makeEntry({ signature: sig, event_hash: EVENT_HASH })];
    const result = await independentlyVerifySignatures(entries);

    expect(result.publicKeyAvailable).toBe(true);
    expect(result.checkedCount).toBe(1);
    expect(result.verifiedCount).toBe(1);
    expect(result.failedSeqs).toEqual([]);
  });

  it('flags a tampered event_hash as a signature mismatch', async () => {
    const kp = await generateEd25519KeyPair();
    const spkiB64 = await exportPublicKeySpkiB64(kp.publicKey);
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    invokeResponse = {
      data: { ok: true, alg: 'ed25519', key_id: 'test-key', public_key_spki_b64: spkiB64 },
      error: null,
    };

    // Signature was produced over EVENT_HASH but the entry now claims OTHER_HASH —
    // simulates a server (or man-in-the-middle) presenting a tampered chain.
    const entries = [makeEntry({ seq: 3, signature: sig, event_hash: OTHER_HASH })];
    const result = await independentlyVerifySignatures(entries);

    expect(result.publicKeyAvailable).toBe(true);
    expect(result.verifiedCount).toBe(0);
    expect(result.failedSeqs).toEqual([3]);
  });

  it('rejects a signature produced by a different key pair (server compromise scenario)', async () => {
    const legitimate = await generateEd25519KeyPair();
    const attacker = await generateEd25519KeyPair();
    const spkiB64 = await exportPublicKeySpkiB64(legitimate.publicKey);
    const forgedSig = await signEd25519(attacker.privateKey, EVENT_HASH);
    invokeResponse = {
      data: { ok: true, alg: 'ed25519', key_id: 'test-key', public_key_spki_b64: spkiB64 },
      error: null,
    };

    const entries = [makeEntry({ signature: forgedSig, event_hash: EVENT_HASH })];
    const result = await independentlyVerifySignatures(entries);

    expect(result.verifiedCount).toBe(0);
    expect(result.failedSeqs).toEqual([1]);
  });

  it('only checks ed25519-signed entries, skipping hmac/unsigned ones', async () => {
    const kp = await generateEd25519KeyPair();
    const spkiB64 = await exportPublicKeySpkiB64(kp.publicKey);
    const sig = await signEd25519(kp.privateKey, EVENT_HASH);
    invokeResponse = {
      data: { ok: true, alg: 'ed25519', key_id: 'test-key', public_key_spki_b64: spkiB64 },
      error: null,
    };

    const entries = [
      makeEntry({ seq: 1, signature: sig, event_hash: EVENT_HASH }),
      makeEntry({ seq: 2, signature: 'deadbeef', signature_alg: 'hmac-sha256' }),
      makeEntry({ seq: 3, signature: null, signature_alg: null, signed: false }),
    ];
    const result = await independentlyVerifySignatures(entries);

    expect(result.checkedCount).toBe(1);
    expect(result.verifiedCount).toBe(1);
  });
});
