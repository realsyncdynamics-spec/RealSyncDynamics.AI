/**
 * Provenance — asymmetrische Signatur (Ed25519).
 *
 * Ersetzt die bisherige HMAC-Signatur (geteiltes Geheimnis → nur intern
 * prüfbar) durch ein Ed25519-Schlüsselpaar: signiert wird mit dem privaten
 * Schlüssel, geprüft mit dem ÖFFENTLICHEN Schlüssel. Damit kann jeder Dritte
 * (Aufsicht, Kunde, Verify-Seite) eine Custody-Signatur unabhängig prüfen, ohne
 * ein Geheimnis zu kennen.
 *
 * Reine WebCrypto-Wrapper — laufen identisch in Browser, Deno und Node ≥ 20.
 * Signiert wird stets die UTF-8-Bytefolge des event_hash-Hex-Strings (gleiche
 * Eingabefläche wie zuvor bei HMAC), Signatur als Lowercase-Hex.
 */

export type SignatureAlg = 'ed25519' | 'hmac-sha256';

const ED = { name: 'Ed25519' } as const;

// ── Kodierungs-Helfer (cross-env: WebCrypto + atob/btoa) ─────────────────────
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim().toLowerCase().replace(/^0x/, '');
  if (h.length % 2 !== 0) throw new Error('hex length must be even');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Schlüssel-Import/Export ──────────────────────────────────────────────────
export function importEd25519PublicKeySpki(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', b64ToBytes(spkiB64), ED, true, ['verify']);
}

export function importEd25519PrivateKeyPkcs8(pkcs8B64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', b64ToBytes(pkcs8B64), ED, false, ['sign']);
}

export async function exportPublicKeySpkiB64(key: CryptoKey): Promise<string> {
  return bytesToB64(new Uint8Array(await crypto.subtle.exportKey('spki', key)));
}

export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ED, true, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

// ── Signieren / Prüfen ───────────────────────────────────────────────────────
/** Signiert die UTF-8-Bytes von `message` (i.d.R. der event_hash-Hex-String). */
export async function signEd25519(privateKey: CryptoKey, message: string): Promise<string> {
  const sig = await crypto.subtle.sign(ED, privateKey, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(sig));
}

/** Prüft eine Hex-Signatur gegen `message` mit dem öffentlichen Schlüssel. */
export async function verifyEd25519(publicKey: CryptoKey, message: string, signatureHex: string): Promise<boolean> {
  let sigBytes: Uint8Array;
  try { sigBytes = hexToBytes(signatureHex); } catch { return false; }
  try {
    return await crypto.subtle.verify(ED, publicKey, sigBytes, new TextEncoder().encode(message));
  } catch {
    return false;
  }
}
