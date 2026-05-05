// Tiny crypto helpers used by the invite flow.

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** URL-safe random token, ~ 192 bits. Format: base64url, no padding. */
export function randomToken(byteLength = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
