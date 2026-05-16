/**
 * Evidence hashing — deterministic SHA-256 over canonical JSON.
 *
 * Used as the integrity primitive of the evidence chain. Two callers
 * with the same logical body MUST produce the same hash regardless of
 * property order, whitespace or platform. Anything that breaks this
 * property silently invalidates the customer's audit trail.
 *
 * Pure module. No DB, no network. Backed by the Web Crypto API which
 * is available in Node ≥ 19, Deno (Supabase edge functions) and modern
 * browsers — i.e. every runtime this codebase actually targets.
 */

/**
 * Canonical JSON: object keys sorted recursively, no extra whitespace,
 * `undefined` properties dropped. Arrays preserve order (they carry
 * semantic meaning). Numbers and strings use JSON.stringify's encoding.
 *
 * `NaN`, `Infinity` and `-Infinity` are rejected — they have no JSON
 * representation and would be encoded as `null` silently otherwise.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalize: non-finite number (${String(value)})`);
    }
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(normalize);

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = normalize(v);
  return out;
}

/**
 * SHA-256 hex digest of the canonical JSON encoding of `body`.
 * Returns a 64-char lowercase hex string. Async because Web Crypto's
 * `digest` is async on every supported runtime.
 */
export async function hashEvidence(body: unknown): Promise<string> {
  const canonical = canonicalize(body);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await getSubtle().digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new Error('hashEvidence: Web Crypto SubtleCrypto unavailable');
  }
  return c.subtle;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}
