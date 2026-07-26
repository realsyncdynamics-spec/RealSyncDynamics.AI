/**
 * Cloudflare Worker: JWT Verification
 *
 * Route: POST /api/auth/verify-jwt
 * Purpose: Verify Supabase JWT locally at edge without round-trip to Supabase auth service
 *
 * Performance: <50ms latency (vs. 100-300ms for auth.getUser() RPC)
 * Canary: 5% production traffic initially, scale to 100% after validation
 *
 * Accepts:
 *   POST /api/auth/verify-jwt
 *   Authorization: Bearer <jwt>
 *
 * Returns (200 OK):
 *   { ok: true, user_id: "...", email: "...", aal: "aal1|aal2" }
 *
 * Returns (401 Unauthorized):
 *   { ok: false, error: "invalid_token" | "expired_token" | "missing_token" }
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Decode JWT (base64url payload)
 * 3. Verify signature using SUPABASE_JWT_SECRET (Ed25519 or HS256)
 * 4. Check expiration (exp claim)
 * 5. Return user_id, email, aal claim
 *
 * Note: This Worker ONLY verifies JWT signature + expiration.
 * It does NOT check tenant membership (that stays in governance-agent Edge Function via RLS).
 * This maintains security: Worker is stateless, tenant isolation happens in DB layer.
 */

interface Env {
  SUPABASE_JWT_SECRET: string;
  SUPABASE_URL: string;
  POLICY_CACHE: KVNamespace;
  SESSION_CACHE: KVNamespace;
}

interface JwtPayload {
  sub: string;        // user_id (UUID)
  email?: string;
  email_verified?: boolean;
  aal?: 'aal1' | 'aal2';
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

interface VerifyResponse {
  ok: boolean;
  user_id?: string;
  email?: string;
  aal?: 'aal1' | 'aal2';
  error?: string;
}

/**
 * Decode base64url to string (RFC 7515)
 * Handles: base64url → base64 → binary → UTF-8
 */
function decodeBase64Url(input: string): string {
  const b64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  // Properly decode UTF-8 bytes
  return new TextDecoder().decode(
    new Uint8Array([...binary].map(c => c.charCodeAt(0)))
  );
}

/**
 * Parse JWT without verification (for claim inspection)
 */
function parseJwtUnsafe(token: string): { header: unknown; payload: JwtPayload } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Verify HMAC-SHA256 signature (most common for Supabase JWTs in non-EU deployments)
 */
async function verifyHmacSignature(
  token: string,
  secret: string,
  signatureB64: string
): Promise<boolean> {
  const parts = token.split('.');
  const message = `${parts[0]}.${parts[1]}`;

  // Convert secret to bytes (HMAC key)
  const keyBuffer = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Decode signature from base64url
  const signatureBytes = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map(c => c.charCodeAt(0))
  );

  // Verify
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    new TextEncoder().encode(message)
  );

  return isValid;
}

/**
 * Verify Ed25519 signature (EU deployment option, more secure for JWTs)
 */
async function verifyEd25519Signature(
  token: string,
  publicKeyPem: string,
  signatureB64: string
): Promise<boolean> {
  const parts = token.split('.');
  const message = `${parts[0]}.${parts[1]}`;

  try {
    // Parse PEM (expected format: -----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----)
    const pemContent = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');

    const keyBuffer = Uint8Array.from(
      atob(pemContent)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      'Ed25519',
      false,
      ['verify']
    );

    const signatureBytes = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );

    return isValid;
  } catch (e) {
    console.error('Ed25519 signature verification failed:', e);
    return false;
  }
}

/**
 * Verify Supabase JWT: signature + expiration
 *
 * Security considerations:
 * - Signature verification ensures JWT wasn't tampered with
 * - Expiration check ensures token is still valid
 * - Does NOT check revocation (that's handled by Supabase metadata lookup in governance-agent)
 * - Does NOT check tenant membership (handled by RLS in DB layer)
 *
 * This keeps the Worker stateless and focused on cryptographic verification only.
 */
async function verifyJwt(token: string, secret: string): Promise<VerifyResponse> {
  // Parse JWT structure
  const parsed = parseJwtUnsafe(token);
  if (!parsed) {
    return { ok: false, error: 'invalid_token' };
  }

  const { header, payload } = parsed;
  const headerObj = header as { alg?: string; typ?: string };

  // Check expiration
  if (payload.exp && Date.now() > payload.exp * 1000) {
    return { ok: false, error: 'expired_token' };
  }

  // Verify signature based on algorithm
  const parts = token.split('.');
  const signatureB64 = parts[2];

  let isValid = false;
  const alg = headerObj.alg;

  if (alg === 'HS256') {
    // HMAC-SHA256 (most common for Supabase)
    isValid = await verifyHmacSignature(token, secret, signatureB64);
  } else if (alg === 'EdDSA') {
    // Ed25519 (if Supabase is configured for Ed25519)
    // In this case, `secret` would be the public key in PEM format
    isValid = await verifyEd25519Signature(token, secret, signatureB64);
  } else {
    // Unsupported algorithm
    return { ok: false, error: 'invalid_token' };
  }

  if (!isValid) {
    return { ok: false, error: 'invalid_token' };
  }

  // Signature valid, return claims
  return {
    ok: true,
    user_id: payload.sub,
    email: payload.email,
    aal: payload.aal as 'aal1' | 'aal2' | undefined,
  };
}

/**
 * Main handler: POST /api/auth/verify-jwt
 *
 * Timing target: <50ms (all operations are CPU-bound crypto, no I/O)
 */
export async function handleVerifyJwt(
  request: Request,
  env: Env
): Promise<Response> {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Extract Bearer token
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verify JWT
  const result = await verifyJwt(token, env.SUPABASE_JWT_SECRET);

  const statusCode = result.ok ? 200 : 401;
  return new Response(JSON.stringify(result), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Worker-Time': `${Date.now()}`,
    },
  });
}

/**
 * Durable Objects: VerifyJwtCounter
 * (Optional enhancement: track verify-jwt calls for metrics)
 * Not implemented in initial canary, added post-validation.
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to verify-jwt handler
    if (url.pathname === '/api/auth/verify-jwt') {
      return handleVerifyJwt(request, env);
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ error: 'not_found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },
};
