/**
 * Provenance Verification Suite Tests
 *
 * Tests für Hash-Chain, Signatures, Tampering Detection.
 */

import { describe, it, expect } from 'vitest';
import { verifyProvenance, verifyChainIntegrity, type CustodyEvent, type ProvenanceManifest } from '../../src/lib/provenance/verify';

describe('Provenance Verification', () => {
  // Mock event hash calculator (mirrors the real canonicalClaimBytes → SHA256)
  const mockEventHash = (seq: number, prevHash: string | null): string => {
    const canonical = `${seq}\x00registered\x00tenant-admin\x00abc123def456\x001751607200\x00${prevHash ?? ''}`;
    return `hash-${seq}-${canonical.length}`.substring(0, 64).padEnd(64, '0'); // Mock hash
  };

  const baseEvent = (seq: number, prevHash: string | null = null): CustodyEvent => {
    const eventHash = mockEventHash(seq, prevHash);
    return {
      id: `evt-${seq}`,
      seq,
      action: 'registered',
      actor: 'tenant-admin',
      contentSha256: 'abc123def456',
      eventTs: new Date('2026-07-03T10:00:00Z'),
      prevHash,
      eventHash,
      signature: null,
      signatureAlg: null,
    };
  };

  const baseManifest = (events: CustodyEvent[]): ProvenanceManifest => ({
    id: 'manifest-1',
    assetRef: 'AST-2026-0001',
    contentSha256: 'abc123def456',
    issuer: 'tenant-id',
    signature: null,
    latestHash: events[events.length - 1]?.eventHash ?? '',
    trustScore: null,
    tamperState: 'intact',
    events,
  });

  describe('Empty/Invalid Cases', () => {
    it('should fail on empty events', () => {
      const manifest = baseManifest([]);
      const result = verifyProvenance(manifest);
      expect(result.valid).toBe(false);
      expect(result.tamperState).toBe('unverifiable');
      expect(result.issues).toContain('No custody events found');
    });

    it('should handle single event (no chaining)', () => {
      const evt = baseEvent(1, null);
      evt.eventHash = 'computed-hash-1';
      const manifest = baseManifest([evt]);
      const result = verifyProvenance(manifest);
      // Single event should verify if hashes match
      expect(result.chainLength).toBe(1);
    });
  });

  describe('Hash-Chain Integrity', () => {
    it('should detect broken chain (missing prev_hash)', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, null); // Should have evt1.eventHash, not null — broken chain

      const events = [evt1, evt2];
      const result = verifyChainIntegrity(events);
      expect(result).toBe(false);
    });

    it('should detect chain break in middle', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, evt1.eventHash); // Correct chain
      const evt3 = baseEvent(3, 'wrong-hash'); // Should be evt2.eventHash — broken

      const events = [evt1, evt2, evt3];
      const result = verifyChainIntegrity(events);
      expect(result).toBe(false);
    });

    it('should verify intact chain', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, evt1.eventHash);
      const evt3 = baseEvent(3, evt2.eventHash);

      const events = [evt1, evt2, evt3];
      const result = verifyChainIntegrity(events);
      expect(result).toBe(true);
    });
  });

  describe('Manifest Integrity', () => {
    it('should detect latest_hash mismatch', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, evt1.eventHash);

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = 'wrong-hash'; // Should be evt2.eventHash

      const result = verifyProvenance(manifest);
      expect(result.valid).toBe(false);
      expect(result.tamperState).toBe('tampered');
      expect(result.issues.some((i) => i.includes('latest_hash mismatch'))).toBe(true);
    });

    it('should verify intact manifest', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, evt1.eventHash);

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = evt2.eventHash; // Correct

      const result = verifyProvenance(manifest);
      expect(result.valid).toBe(true);
      expect(result.tamperState).toBe('intact');
    });
  });

  describe('Trust Score Calculation', () => {
    it('should give high score for signed chain', () => {
      const evt1 = baseEvent(1, null);
      evt1.signature = 'sig-1';
      evt1.signatureAlg = 'ed25519';

      const evt2 = baseEvent(2, evt1.eventHash);
      evt2.signature = 'sig-2';
      evt2.signatureAlg = 'ed25519';

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = evt2.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.trustScore).toBeGreaterThanOrEqual(90);
    });

    it('should reduce score for unsigned events', () => {
      const evt1 = baseEvent(1, null);
      evt1.signature = null; // Not signed

      const evt2 = baseEvent(2, evt1.eventHash);
      evt2.signature = null; // Not signed

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = evt2.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.trustScore).toBeLessThan(96); // 100 - 2*2 (unsigned count)
    });

    it('should heavily penalize broken chain', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, null); // Broken chain (should have evt1.eventHash)
      evt2.signature = 'sig-2';
      evt2.signatureAlg = 'ed25519';

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = evt2.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.trustScore).toBeLessThanOrEqual(50); // 100 - 50 for broken chain
    });
  });

  describe('Tampering Detection', () => {
    it('should mark as tampered on hash mismatch', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, evt1.eventHash);
      evt2.signature = 'sig-2';

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = 'wrong-hash'; // Tampering!

      const result = verifyProvenance(manifest);
      expect(result.tamperState).toBe('tampered');
      expect(result.valid).toBe(false);
    });

    it('should mark as tampered on chain break', () => {
      const evt1 = baseEvent(1, null);
      const evt2 = baseEvent(2, 'wrong-prev-hash'); // Chain broken

      const manifest = baseManifest([evt1, evt2]);
      manifest.latestHash = evt2.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.tamperState).toBe('tampered');
    });
  });

  describe('Signature Algorithm Support', () => {
    it('should handle Ed25519 signature algorithm', () => {
      const evt1 = baseEvent(1, null);
      evt1.signature = 'ed25519-sig-base64';
      evt1.signatureAlg = 'ed25519';

      const manifest = baseManifest([evt1]);
      manifest.latestHash = evt1.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.chainLength).toBe(1);
      // Signature verification would need actual key in production
    });

    it('should handle HMAC-SHA256 (legacy)', () => {
      const evt1 = baseEvent(1, null);
      evt1.signature = 'hmac-hex-value';
      evt1.signatureAlg = 'hmac-sha256';

      const manifest = baseManifest([evt1]);
      manifest.latestHash = evt1.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.chainLength).toBe(1);
    });

    it('should handle null signature_alg (legacy HMAC)', () => {
      const evt1 = baseEvent(1, null);
      evt1.signature = 'legacy-hmac-sig';
      evt1.signatureAlg = null; // Legacy = HMAC-SHA256

      const manifest = baseManifest([evt1]);
      manifest.latestHash = evt1.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.chainLength).toBe(1);
    });
  });

  describe('Multi-Action Chains', () => {
    it('should verify chain with mixed actions', () => {
      const evt1 = baseEvent(1, null);
      evt1.action = 'registered';

      const evt2 = baseEvent(2, evt1.eventHash);
      evt2.action = 'updated';

      const evt3 = baseEvent(3, evt2.eventHash);
      evt3.action = 'audited';

      const manifest = baseManifest([evt1, evt2, evt3]);
      manifest.latestHash = evt3.eventHash;

      const result = verifyProvenance(manifest);
      expect(result.valid).toBe(true);
      expect(result.chainLength).toBe(3);
    });
  });
});
