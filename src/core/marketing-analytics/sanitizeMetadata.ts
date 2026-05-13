// sanitizeMetadata — entfernt PII aus Marketing-Event-Metadata bevor sie die
// Runtime verlassen. DSGVO-Datenminimierung (Art. 5 Abs. 1 lit. c).
//
// Drop-Rules:
//   - IPs (v4/v6)                  → komplett verwerfen
//   - E-Mails                      → komplett verwerfen
//   - User-Agent-Rohstrings (>40c) → komplett verwerfen (anstatt zu kuerzen)
//   - Strings > 200 Zeichen        → auf 200 Zeichen gekuerzt
//   - Schluessel auf PII-Allowlist → verwerfen
//   - Nested Objects > 2 Ebenen    → flatten/drop
//
// Hard Cap: 4096 Bytes JSON. Wenn das Ergebnis groesser ist, werden Felder
// von hinten verworfen bis die Grenze gehalten wird.

const MAX_BYTES = 4096;
const MAX_STRING_LEN = 200;
const MAX_DEPTH = 2;

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/i;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/;
// UA tells: mehrere typische Browser/OS-Tokens auf engem Raum.
const UA_HINT = /(mozilla|chrome|safari|firefox|edge|opera|webkit|trident|gecko)/i;

const FORBIDDEN_KEYS = new Set([
  'ip', 'ipv4', 'ipv6', 'remote_addr', 'x_forwarded_for',
  'email', 'mail', 'e_mail',
  'user_agent', 'useragent', 'ua',
  'password', 'token', 'api_key', 'secret', 'authorization',
  'cookie', 'session_id', 'sid',
  'first_name', 'last_name', 'phone', 'phone_number',
]);

function looksLikePII(value: string): boolean {
  if (IPV4.test(value)) return true;
  if (IPV6.test(value)) return true;
  if (EMAIL.test(value)) return true;
  // Heuristik fuer User-Agent-Rohstrings.
  if (value.length > 40 && UA_HINT.test(value)) return true;
  return false;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    if (looksLikePII(value)) return undefined;
    return value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) : value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return undefined;
    const cleaned = value
      .slice(0, 50)
      .map((v) => sanitizeValue(v, depth + 1))
      .filter((v) => v !== undefined);
    return cleaned;
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return undefined;
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  return undefined;
}

function sanitizeObject(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (key.length > 64) continue;
    const cleaned = sanitizeValue(rawValue, depth);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

function byteSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Bereinigt Metadata fuer marketing_events. Niemals roh persistieren.
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};

  const cleaned = sanitizeObject(metadata, 0);

  if (byteSize(cleaned) <= MAX_BYTES) return cleaned;

  // Truncation: drop keys from the end until we fit.
  const keys = Object.keys(cleaned);
  while (keys.length > 0 && byteSize(cleaned) > MAX_BYTES) {
    const k = keys.pop();
    if (k) delete cleaned[k];
  }
  return cleaned;
}
