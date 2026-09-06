/**
 * secretBox — AES-256-GCM-Versiegelung fuer Kunden-Zugangsdaten (Plan P0-1).
 *
 * Governance-Zweck: integration_configs.credentials lag im Klartext und war
 * per RLS fuer jedes Tenant-Mitglied lesbar. Ab jetzt gilt: Zugangsdaten
 * werden serverseitig versiegelt (credentials_enc), der Klartext verlaesst
 * die Edge Function nie wieder in Richtung Browser oder Tabelle.
 * DSGVO Art. 32 (Stand der Technik), Auftrag §5 („Secrets niemals
 * unverschluesselt in der Datenbank oder im Frontend").
 *
 * Nur WebCrypto — laeuft identisch in Deno (Edge) und Node ≥ 18 (Vitest).
 * Format: v1:<base64(iv)>:<base64(ciphertext+tag)> — versioniert, damit
 * eine spaetere Schluesselrotation alte Siegel erkennen kann.
 */

const VERSION = 'v1';

function b64encode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Importiert einen base64-kodierten 32-Byte-Schluessel. */
export async function importSecretKey(base64Key: string): Promise<CryptoKey> {
  const raw = b64decode(base64Key.trim());
  if (raw.length !== 32) {
    throw new Error(`secretBox: key must be 32 bytes, got ${raw.length}`);
  }
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Versiegelt ein JSON-serialisierbares Objekt. */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return `${VERSION}:${b64encode(iv)}:${b64encode(new Uint8Array(ciphertext))}`;
}

/**
 * Oeffnet ein Siegel. Wirft bei Manipulation (GCM-Tag), falschem Schluessel
 * oder unbekannter Version — nie stiller Fallback auf Klartext.
 */
export async function open(key: CryptoKey, sealed: string): Promise<unknown> {
  const parts = sealed.split(':');
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error('secretBox: unknown seal format');
  }
  const iv = b64decode(parts[1]);
  const ciphertext = b64decode(parts[2]);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
