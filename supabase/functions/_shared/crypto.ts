/**
 * Deno Cryptographic Functions for Edge Functions
 *
 * Provides Ed25519 and HMAC-SHA256 signing/verification for provenance verification.
 * Uses Web Crypto API (available in Deno).
 */

/**
 * Canonical Claim Format — must match src/lib/provenance/sign.ts
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
 * Sign event with Ed25519 using Web Crypto API.
 * Private key should be in JWK format (base64-encoded).
 */
export async function signEventEd25519Deno(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  privateKeyJwk: object,
): Promise<string> {
  const claim = canonicalClaimBytes(event);
  const encoder = new TextEncoder();
  const data = encoder.encode(claim);

  // Import private key
  const key = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'Ed25519' },
    false,
    ['sign'],
  );

  // Sign
  const signature = await crypto.subtle.sign('Ed25519', key, data);

  // Return Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify Ed25519 signature using Web Crypto API.
 * Public key should be in JWK format.
 */
export async function verifyEd25519DenoCrypto(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  signatureBase64: string,
  publicKeyJwk: object,
): Promise<boolean> {
  try {
    const claim = canonicalClaimBytes(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(claim);

    // Decode signature from Base64
    const binaryString = atob(signatureBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import public key
    const key = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );

    // Verify
    return await crypto.subtle.verify('Ed25519', key, bytes, data);
  } catch (err) {
    console.error('Ed25519 verification failed in Deno:', err);
    return false;
  }
}

/**
 * Sign event with HMAC-SHA256 using Web Crypto API.
 */
export async function signEventHmacDeno(
  event: {
    seq: number;
    action: string;
    actor: string;
    contentSha256: string;
    eventTs: Date;
    prevHash: string | null;
  },
  secretKey: string, // Raw secret (will be used as-is)
): Promise<string> {
  const claim = canonicalClaimBytes(event);
  const encoder = new TextEncoder();
  const data = encoder.encode(claim);
  const keyData = encoder.encode(secretKey);

  // Import key
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

  // Sign
  const signature = await crypto.subtle.sign('HMAC', key, data);

  // Return Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verify HMAC-SHA256 using Web Crypto API.
 */
export async function verifyHmacDenoCrypto(
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
): Promise<boolean> {
  try {
    const claim = canonicalClaimBytes(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(claim);
    const keyData = encoder.encode(secretKey);

    // Decode signature from Base64
    const binaryString = atob(signatureBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Import key
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
      'verify',
    ]);

    // Verify with constant-time comparison
    const isValid = await crypto.subtle.verify('HMAC', key, bytes, data);

    return isValid;
  } catch (err) {
    console.error('HMAC verification failed in Deno:', err);
    return false;
  }
}

/**
 * Convert Node.js PEM to JWK (Ed25519).
 * This is a helper for converting PEM-encoded keys to JWK for Web Crypto.
 */
export async function pemToJwkEd25519(pemBase64: string): Promise<object> {
  // Decode PEM
  const pem = atob(pemBase64);

  // Extract base64 content between BEGIN and END markers
  const lines = pem.split('\n');
  let keyBase64 = '';
  for (const line of lines) {
    if (!line.startsWith('-----')) {
      keyBase64 += line;
    }
  }

  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));

  // For Ed25519 public keys, extract the key material from the SPKI format
  // SPKI structure: [SEQUENCE [SEQUENCE [OID] [key material]]]
  // For simplicity, take the last 32 bytes (Ed25519 public key length)
  const publicKeyBytes = keyBytes.slice(keyBytes.length - 32);

  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: btoa(String.fromCharCode(...publicKeyBytes)),
  };
}
