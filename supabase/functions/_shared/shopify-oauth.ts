// Shopify OAuth helpers — install URL, HMAC verification, token
// exchange, AES-256-GCM token encryption.
//
// Hard product constraint: scopes are read-only. The list is allowed
// by validateScopes() and any deviation refuses to mint an install URL.
// Never log tokens. Never persist plaintext access tokens.

const ALLOWED_SCOPES = new Set([
  'read_themes',
  'read_content',
  'read_products',
  'read_script_tags',
  'read_pixels',
  // additive read-only scopes can be added here; never *write_* or unscoped *_all*.
]);

export function normalizeShopDomain(input: string): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null;
  return s;
}

export function validateScopes(raw: string): string[] {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (!ALLOWED_SCOPES.has(p)) {
      throw new Error(`scope not allowed: ${p}`);
    }
  }
  return parts;
}

export function buildShopifyInstallUrl(args: {
  shop: string;
  apiKey: string;
  scopes: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.apiKey,
    scope: args.scopes,
    redirect_uri: args.redirectUri,
    state: args.state,
    'grant_options[]': 'per-user',
  });
  return `https://${args.shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify the HMAC signature Shopify attaches to OAuth callbacks +
 * webhooks. For OAuth callbacks Shopify excludes the `hmac` and
 * `signature` query params from the message and uses the secret as
 * key. Returns boolean — never throws.
 */
export async function verifyShopifyHmac(
  query: URLSearchParams,
  secret: string,
): Promise<boolean> {
  const received = query.get('hmac') ?? '';
  if (!received) return false;
  const entries: Array<[string, string]> = [];
  for (const [k, v] of query.entries()) {
    if (k === 'hmac' || k === 'signature') continue;
    entries.push([k, v]);
  }
  entries.sort(([a], [b]) => a.localeCompare(b));
  const message = entries.map(([k, v]) => `${k}=${v}`).join('&');
  return await constantTimeEqualsHex(await hmacHex(secret, message), received);
}

export async function exchangeCodeForToken(args: {
  shop: string;
  code: string;
  apiKey: string;
  apiSecret: string;
}): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(`https://${args.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: args.apiKey,
      client_secret: args.apiSecret,
      code: args.code,
    }),
  });
  if (!res.ok) throw new Error(`shopify token exchange failed: ${res.status}`);
  const body = await res.json();
  if (!body.access_token || typeof body.access_token !== 'string') {
    throw new Error('shopify response missing access_token');
  }
  return { access_token: body.access_token, scope: String(body.scope ?? '') };
}

// AES-256-GCM with key from SHOPIFY_TOKEN_ENCRYPTION_KEY env var (base64-encoded 32 bytes).
// Payload layout (base64): iv(12) || ciphertext || tag(16).

async function getEncryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('SHOPIFY_TOKEN_ENCRYPTION_KEY') ?? '';
  if (!raw) throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY not set');
  const bytes = b64decode(raw);
  if (bytes.byteLength !== 32) throw new Error('SHOPIFY_TOKEN_ENCRYPTION_KEY must be 32 bytes base64');
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc));
  const out = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(cipher, iv.byteLength);
  return b64encode(out);
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const buf = b64decode(encrypted);
  const iv = buf.subarray(0, 12);
  const cipher = buf.subarray(12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
  return new TextDecoder().decode(plain);
}

// ─── helpers ──────────────────────────────────────────────────────────

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function constantTimeEqualsHex(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function b64encode(u8: Uint8Array): string {
  let bin = '';
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export function newState(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
