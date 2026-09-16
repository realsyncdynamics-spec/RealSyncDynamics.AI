/** SHA-256 hex, works in the browser (subtle) and in Node tests. */

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return bytesToHex(new Uint8Array(buf));
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(text).digest('hex');
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export async function merkleOf(pathsToSha: Record<string, string>): Promise<string> {
  const keys = Object.keys(pathsToSha).sort();
  const joined = keys.map((k) => `${k}:${pathsToSha[k]}`).join('\n');
  return sha256Hex(joined);
}
