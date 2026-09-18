// Merkle root over a file tree. Same algorithm as
// src/features/app-builder/bolt/hash.ts (sorted path:sha256(content), then SHA-256).
// Used by siteos/code-persist so the client merkle is never authority.

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export async function merkleOfFiles(files: Record<string, string>): Promise<string> {
  const keys = Object.keys(files).sort();
  const lines: string[] = [];
  for (const path of keys) {
    lines.push(`${path}:${await sha256Hex(files[path] ?? '')}`);
  }
  return sha256Hex(lines.join('\n'));
}
