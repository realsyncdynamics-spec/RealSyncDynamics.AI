/** SHA-256 hex via Web Crypto. Node 19+ and browsers both expose crypto.subtle. */

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 requires Web Crypto (crypto.subtle)');
  }
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(buf));
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
