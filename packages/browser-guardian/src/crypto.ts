// Kanonisches JSON + WebCrypto (Node 22, Browser, Deno) — keine Abhängigkeit.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto nicht verfügbar');
  return s;
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return hex(await subtle().digest('SHA-256', bytes as BufferSource));
}

/** Zufälliger HMAC-Schlüssel, nicht exportierbar (bleibt im Prozess). */
export async function generateHmacKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacHex(key: CryptoKey, input: string): Promise<string> {
  return hex(await subtle().sign('HMAC', key, new TextEncoder().encode(input)));
}

export function randomId(): string {
  return globalThis.crypto.randomUUID();
}
