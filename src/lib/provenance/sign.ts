/**
 * Provenance Signing — Ed25519 + HMAC-SHA256 Signature Generation
 *
 * Produces cryptographically verifiable signatures for custody events.
 * Supports:
 * - Ed25519 (public-key): organization-level signing
 * - HMAC-SHA256 (symmetric): quick verification with shared secret
 *
 * Usage:
 *   const signature = signEvent(event, privateKey, 'ed25519');
 *   const canonical = canonicalClaimBytes(event);
 */

import {
  createHmac,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'crypto';

export interface SigningKey {
  publicKey: string; // Base64-encoded Ed25519 public key
  privateKey: string; // Base64-encoded Ed25519 private key (server-side only)
  algorithm: 'ed25519' | 'hmac-sha256';
  issuer: string; // Organization or user ID
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Canonical Claim Format für Signature.
 * Muss mit src/lib/provenance/verify.ts identisch sein.
 */
export function canonicalClaimBytes(event: {
  seq: number;
  action: string;
  actor: string;
  contentSha256: string;
  eventTs: Date;
  prevHash: string | null;
}): string {
  const fields = [
    event.seq.toString(),
    event.action,
    event.actor,
    event.contentSha256,
    Math.floor(event.eventTs.getTime() / 1000).toString(),
    event.prevHash ?? '',
  ];
  return fields.join('\x00');
}

/**
 * Generate new Ed25519 key pair for organization.
 * Returns { publicKey, privateKey } in Base64.
 */
export function generateEd25519KeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Convert PEM to Base64 for storage
  return {
    publicKey: Buffer.from(publicKey).toString('base64'),
    privateKey: Buffer.from(privateKey).toString('base64'),
  };
}

/**
 * Sign event with Ed25519 private key.
 * Returns Base64-encoded signature.
 */
export function signEventEd25519(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  privateKeyBase64: string,
): string {
  const claim = canonicalClaimBytes(event);
  const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

  // Ed25519 nutzt die One-Shot-API mit algorithm=null (createSign unterstützt Ed25519 nicht)
  const signature = cryptoSign(null, Buffer.from(claim), privateKeyPem);
  return signature.toString('base64');
}

/**
 * Verify Ed25519 signature against public key.
 * Returns true if signature is valid.
 */
export function verifyEd25519Signature(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  signatureBase64: string,
  publicKeyBase64: string,
): boolean {
  try {
    const claim = canonicalClaimBytes(event);
    const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');
    const signature = Buffer.from(signatureBase64, 'base64');

    return cryptoVerify(null, Buffer.from(claim), publicKeyPem, signature);
  } catch (err) {
    console.error('Ed25519 verification failed:', err);
    return false;
  }
}

/**
 * Sign event with HMAC-SHA256 secret.
 * Returns Base64-encoded HMAC.
 */
export function signEventHmac(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  secretKey: string, // Shared secret (e.g., API key or derived key)
): string {
  const claim = canonicalClaimBytes(event);
  const hmac = createHmac('sha256', secretKey);
  hmac.update(claim);
  return hmac.digest('base64');
}

/**
 * Verify HMAC-SHA256 signature against secret.
 * Returns true if signature is valid.
 */
export function verifyHmacSignature(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  signatureBase64: string,
  secretKey: string,
): boolean {
  try {
    const expected = signEventHmac(event, secretKey);
    // Constant-time comparison to prevent timing attacks
    return timingSafeCompare(signatureBase64, expected);
  } catch (err) {
    console.error('HMAC verification failed:', err);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }

  return result === 0;
}

/**
 * Create SigningKey record for organization.
 * Stores public key; private key kept in secure vault only.
 */
export function createSigningKeyRecord(
  organizationId: string,
  algorithm: 'ed25519' | 'hmac-sha256' = 'ed25519',
  expiresInDays: number | null = 365,
): SigningKey {
  const now = new Date();
  const expiresAt = expiresInDays ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  if (algorithm === 'ed25519') {
    const { publicKey, privateKey } = generateEd25519KeyPair();
    return {
      publicKey,
      privateKey,
      algorithm: 'ed25519',
      issuer: organizationId,
      createdAt: now,
      expiresAt,
    };
  }

  // For HMAC, generate random secret
  const secret = randomBytes(32).toString('base64');
  return {
    publicKey: secret,
    privateKey: secret,
    algorithm: 'hmac-sha256',
    issuer: organizationId,
    createdAt: now,
    expiresAt,
  };
}

/**
 * Rotate signing key: create new key and mark old as deprecated.
 * Maintains chain of trust with key metadata.
 */
export function rotateSigningKey(
  oldKey: SigningKey,
  organizationId: string,
): { oldKey: SigningKey; newKey: SigningKey } {
  const now = new Date();
  oldKey.expiresAt = now; // Mark old key as expired

  const newKey = createSigningKeyRecord(organizationId, oldKey.algorithm, 365);
  return { oldKey, newKey };
}
