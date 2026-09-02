/**
 * Deterministische Serialisierung. JSON.stringify bewahrt die Einfüge-
 * Reihenfolge — zwei strukturell identische Objekte können also
 * unterschiedlich hashen. Für Evidence, die Jahre später re-verifizierbar
 * sein muss, wäre das fatal. Deshalb: Schlüssel sortieren, `undefined`
 * auslassen, rekursiv kanonisieren.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const hashObject = (value: unknown) => sha256Hex(canonicalJson(value));
