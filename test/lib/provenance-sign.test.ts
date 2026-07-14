/**
 * Provenance Signing Tests
 *
 * Tests Ed25519 and HMAC-SHA256 signature generation and verification.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateEd25519KeyPair,
  signEventEd25519,
  verifyEd25519Signature,
  signEventHmac,
  verifyHmacSignature,
  createSigningKeyRecord,
  rotateSigningKey,
  canonicalClaimBytes,
} from '../../src/lib/provenance/sign';

describe('Provenance Signing', () => {
  const mockEvent = {
    seq: 1,
    action: 'create_asset',
    actor: 'user-123',
    contentSha256: 'abc123def456',
    eventTs: new Date('2026-07-03T10:00:00Z'),
    prevHash: null,
  };

  describe('canonicalClaimBytes', () => {
    it('should produce consistent canonical format', () => {
      const canonical1 = canonicalClaimBytes(mockEvent);
      const canonical2 = canonicalClaimBytes(mockEvent);

      expect(canonical1).toBe(canonical2);
      expect(canonical1).toContain('1\x00create_asset\x00user-123');
    });

    it('should differ when event changes', () => {
      const canonical1 = canonicalClaimBytes(mockEvent);
      const canonical2 = canonicalClaimBytes({
        ...mockEvent,
        action: 'update_asset',
      });

      expect(canonical1).not.toBe(canonical2);
    });

    it('should handle null prevHash', () => {
      const canonical = canonicalClaimBytes({ ...mockEvent, prevHash: null });
      // prevHash ist das letzte Feld — null wird zu leerem String nach dem letzten Separator
      expect(canonical.endsWith('\x00')).toBe(true);
    });

    it('should handle non-null prevHash', () => {
      const canonical = canonicalClaimBytes({
        ...mockEvent,
        prevHash: 'hash123',
      });
      expect(canonical).toContain('hash123');
    });
  });

  describe('Ed25519 Signing', () => {
    let publicKey: string;
    let privateKey: string;

    beforeAll(() => {
      const keyPair = generateEd25519KeyPair();
      publicKey = keyPair.publicKey;
      privateKey = keyPair.privateKey;
    });

    it('should generate Ed25519 key pair', () => {
      expect(publicKey).toBeTruthy();
      expect(privateKey).toBeTruthy();
      expect(publicKey.length).toBeGreaterThan(0);
      expect(privateKey.length).toBeGreaterThan(0);
    });

    it('should sign event and produce base64 signature', () => {
      const signature = signEventEd25519(mockEvent, privateKey);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
      // Base64 only contains alphanumeric + /+= characters
      expect(/^[A-Za-z0-9+/=]+$/.test(signature)).toBe(true);
    });

    it('should verify valid signature', () => {
      const signature = signEventEd25519(mockEvent, privateKey);
      const isValid = verifyEd25519Signature(mockEvent, signature, publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject tampered signature', () => {
      const signature = signEventEd25519(mockEvent, privateKey);
      const tamperedSignature = signature.slice(0, -5) + 'XXXXX';

      const isValid = verifyEd25519Signature(mockEvent, tamperedSignature, publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject signature for different event', () => {
      const signature = signEventEd25519(mockEvent, privateKey);
      const differentEvent = { ...mockEvent, actor: 'different-user' };

      const isValid = verifyEd25519Signature(differentEvent, signature, publicKey);
      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong public key', () => {
      const signature = signEventEd25519(mockEvent, privateKey);
      const wrongKeyPair = generateEd25519KeyPair();

      const isValid = verifyEd25519Signature(mockEvent, signature, wrongKeyPair.publicKey);
      expect(isValid).toBe(false);
    });
  });

  describe('HMAC-SHA256 Signing', () => {
    const secret = 'my-shared-secret-key-12345';

    it('should sign event with HMAC', () => {
      const signature = signEventHmac(mockEvent, secret);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should verify valid HMAC signature', () => {
      const signature = signEventHmac(mockEvent, secret);
      const isValid = verifyHmacSignature(mockEvent, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should produce consistent HMAC for same event and secret', () => {
      const signature1 = signEventHmac(mockEvent, secret);
      const signature2 = signEventHmac(mockEvent, secret);

      expect(signature1).toBe(signature2);
    });

    it('should reject HMAC with wrong secret', () => {
      const signature = signEventHmac(mockEvent, secret);
      const wrongSecret = 'different-secret';

      const isValid = verifyHmacSignature(mockEvent, signature, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should reject tampered HMAC', () => {
      const signature = signEventHmac(mockEvent, secret);
      const tamperedSignature = signature.slice(0, -5) + 'XXXXX';

      const isValid = verifyHmacSignature(mockEvent, tamperedSignature, secret);
      expect(isValid).toBe(false);
    });

    it('should reject HMAC for different event', () => {
      const signature = signEventHmac(mockEvent, secret);
      const differentEvent = { ...mockEvent, action: 'delete_asset' };

      const isValid = verifyHmacSignature(differentEvent, signature, secret);
      expect(isValid).toBe(false);
    });
  });

  describe('SigningKeyRecord', () => {
    it('should create Ed25519 signing key record', () => {
      const orgId = 'org-123';
      const key = createSigningKeyRecord(orgId, 'ed25519', 365);

      expect(key.issuer).toBe(orgId);
      expect(key.algorithm).toBe('ed25519');
      expect(key.publicKey).toBeTruthy();
      expect(key.privateKey).toBeTruthy();
      expect(key.createdAt).toBeInstanceOf(Date);
      expect(key.expiresAt).toBeInstanceOf(Date);
    });

    it('should create HMAC signing key record', () => {
      const orgId = 'org-456';
      const key = createSigningKeyRecord(orgId, 'hmac-sha256', 180);

      expect(key.issuer).toBe(orgId);
      expect(key.algorithm).toBe('hmac-sha256');
      expect(key.publicKey).toBeTruthy();
      expect(key.privateKey).toBeTruthy();
      expect(key.publicKey).toBe(key.privateKey); // HMAC secret is same for both
    });

    it('should create non-expiring key when duration is null', () => {
      const key = createSigningKeyRecord('org-789', 'ed25519', null);

      expect(key.expiresAt).toBe(null);
    });

    it('should calculate expiration correctly', () => {
      const now = new Date();
      const key = createSigningKeyRecord('org-123', 'ed25519', 365);

      const expiresIn = key.expiresAt!.getTime() - key.createdAt.getTime();
      const daysInMs = 365 * 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(expiresIn - daysInMs)).toBeLessThan(1000);
    });
  });

  describe('Key Rotation', () => {
    it('should rotate signing key', () => {
      const orgId = 'org-rotation';
      const oldKey = createSigningKeyRecord(orgId, 'ed25519', 365);

      const { oldKey: rotatedOld, newKey } = rotateSigningKey(oldKey, orgId);

      // Old key should be marked as expired
      expect(rotatedOld.expiresAt).toBeInstanceOf(Date);
      expect(rotatedOld.expiresAt?.getTime()).toBeLessThanOrEqual(new Date().getTime());

      // New key should be active (Rotation kann innerhalb derselben Millisekunde erfolgen)
      expect(newKey.createdAt.getTime()).toBeGreaterThanOrEqual(rotatedOld.createdAt.getTime());
      expect(newKey.issuer).toBe(orgId);
      expect(newKey.algorithm).toBe('ed25519');
    });

    it('should maintain chain of trust with rotation metadata', () => {
      const orgId = 'org-chain';
      const key1 = createSigningKeyRecord(orgId, 'ed25519', 365);
      const { oldKey: key1Rotated, newKey: key2 } = rotateSigningKey(key1, orgId);

      // Should be able to track rotation relationship
      expect(key2.issuer).toBe(key1Rotated.issuer);
      expect(key1Rotated.expiresAt).toBeTruthy();
      // Rotation kann innerhalb derselben Millisekunde erfolgen
      expect(key2.createdAt.getTime()).toBeGreaterThanOrEqual(key1Rotated.createdAt.getTime());
    });
  });

  describe('Integration', () => {
    it('should sign and verify full custody event flow', () => {
      const orgId = 'org-integration';
      const signingKey = createSigningKeyRecord(orgId, 'ed25519', 365);

      // Sign event
      const signature = signEventEd25519(mockEvent, signingKey.privateKey);

      // Verify with public key
      const isValid = verifyEd25519Signature(mockEvent, signature, signingKey.publicKey);

      expect(isValid).toBe(true);
    });

    it('should support multiple events in sequence', () => {
      const signingKey = createSigningKeyRecord('org-seq', 'hmac-sha256', 365);

      const event1 = { ...mockEvent, seq: 1, action: 'create' };
      const event2 = { ...mockEvent, seq: 2, action: 'update', prevHash: 'hash1' };
      const event3 = { ...mockEvent, seq: 3, action: 'sign', prevHash: 'hash2' };

      const sig1 = signEventHmac(event1, signingKey.publicKey);
      const sig2 = signEventHmac(event2, signingKey.publicKey);
      const sig3 = signEventHmac(event3, signingKey.publicKey);

      expect(verifyHmacSignature(event1, sig1, signingKey.publicKey)).toBe(true);
      expect(verifyHmacSignature(event2, sig2, signingKey.publicKey)).toBe(true);
      expect(verifyHmacSignature(event3, sig3, signingKey.publicKey)).toBe(true);

      // Signatures should differ for different events
      expect(sig1).not.toBe(sig2);
      expect(sig2).not.toBe(sig3);
    });
  });
});
