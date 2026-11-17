// Media Studio — Signaturen ohne Tabelle.
//
// Zwei Zwecke, beide an den serverseitig verifizierten Mandanten gebunden:
//  1. Job-Token: Ein asynchroner Anbieterauftrag (Higgsfield request_id) darf
//     nur vom Mandanten abgefragt werden, der ihn angelegt hat.
//  2. Asset-Signatur: Referenzbilder werden nur angenommen, wenn sie vorher von
//     diesem Studio für diesen Mandanten erzeugt wurden. So gelangen keine
//     fremden Fotos (z. B. von Personen) über das Studio zu US-Anbietern.
//
// HMAC-SHA256 über WebCrypto (Deno und Node 20+). Ohne Secret: fail-closed.

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256HexOf(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SIGNING_SECRET_MIN_CHARS = 32;

export function usableSecret(secret: string | null | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= SIGNING_SECRET_MIN_CHARS;
}

export async function signJob(secret: string, tenantId: string, provider: string, requestId: string): Promise<string> {
  return hmacHex(secret, `job|${tenantId}|${provider}|${requestId}`);
}

export async function verifyJob(
  secret: string,
  tenantId: string,
  provider: string,
  requestId: string,
  token: string,
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  return constantTimeEqual(await signJob(secret, tenantId, provider, requestId), token);
}

/** Fingerabdruck eines Assets: Hash der Base64-Daten oder der URL. */
export async function assetFingerprint(asset: { data_base64?: string; url?: string }): Promise<string> {
  if (asset.data_base64) return `b64:${await sha256HexOf(asset.data_base64)}`;
  if (asset.url) return `url:${await sha256HexOf(asset.url)}`;
  return '';
}

export async function signAsset(secret: string, tenantId: string, fingerprint: string): Promise<string> {
  return hmacHex(secret, `asset|${tenantId}|${fingerprint}`);
}

export async function verifyAsset(
  secret: string,
  tenantId: string,
  asset: { data_base64?: string; url?: string },
  sig: string,
): Promise<boolean> {
  if (!sig || typeof sig !== 'string') return false;
  const fp = await assetFingerprint(asset);
  if (!fp) return false;
  return constantTimeEqual(await signAsset(secret, tenantId, fp), sig);
}
