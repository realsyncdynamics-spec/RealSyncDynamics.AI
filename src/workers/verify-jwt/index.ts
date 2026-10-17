/**
 * Cloudflare Worker: Supabase JWT verification.
 *
 * SECURITY BOUNDARY
 * -----------------
 * This handler is the only application endpoint exposed by src/workers/index.ts.
 * Tenant-scoped policy/evidence routes stay disconnected until they have a
 * verified user -> membership -> tenant authorization chain. A syntactic
 * "Bearer " prefix is never sufficient authorization.
 *
 * Current signing mode is deliberately fail-closed: HS256 only. If the
 * Supabase project moves to an asymmetric signing key, add a JWKS-based
 * verifier in a separately reviewed security change instead of overloading
 * SUPABASE_JWT_SECRET with a public key.
 */

export interface VerifyJwtEnv {
  SUPABASE_JWT_SECRET: string;
  /** Public project URL, e.g. https://project-ref.supabase.co */
  SUPABASE_URL: string;
}

interface JwtPayload {
  sub?: string;
  email?: string;
  aal?: 'aal1' | 'aal2';
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
}

interface VerifyResponse {
  ok: boolean;
  user_id?: string;
  email?: string;
  aal?: 'aal1' | 'aal2';
  error?: 'invalid_token' | 'expired_token' | 'missing_token';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeBase64UrlBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function decodeBase64Url(input: string): string {
  return new TextDecoder().decode(decodeBase64UrlBytes(input));
}

function parseJwtUnsafe(token: string): { header: JwtHeader; payload: JwtPayload } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  try {
    return {
      header: JSON.parse(decodeBase64Url(parts[0])) as JwtHeader,
      payload: JSON.parse(decodeBase64Url(parts[1])) as JwtPayload,
    };
  } catch {
    return null;
  }
}

async function verifyHmacSignature(
  token: string,
  secret: string,
  signatureB64: string,
): Promise<boolean> {
  if (!secret) return false;

  try {
    const [header, payload] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64UrlBytes(signatureB64),
      new TextEncoder().encode(`${header}.${payload}`),
    );
  } catch {
    return false;
  }
}

function expectedIssuer(supabaseUrl: string): string | null {
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:') return null;
    return `${url.origin}/auth/v1`;
  } catch {
    return null;
  }
}

function audienceAllowsAuthenticated(aud: JwtPayload['aud']): boolean {
  return typeof aud === 'string'
    ? aud === 'authenticated'
    : Array.isArray(aud) && aud.includes('authenticated');
}

async function verifyJwt(
  token: string,
  env: VerifyJwtEnv,
): Promise<VerifyResponse> {
  const parsed = parseJwtUnsafe(token);
  if (!parsed) return { ok: false, error: 'invalid_token' };

  // Fail closed on algorithm ambiguity. Asymmetric signing requires JWKS.
  if (parsed.header.alg !== 'HS256' || parsed.header.typ !== 'JWT') {
    return { ok: false, error: 'invalid_token' };
  }

  const signature = token.split('.')[2];
  const signatureValid = await verifyHmacSignature(
    token,
    env.SUPABASE_JWT_SECRET,
    signature,
  );
  if (!signatureValid) return { ok: false, error: 'invalid_token' };

  const issuer = expectedIssuer(env.SUPABASE_URL);
  if (
    !issuer ||
    parsed.payload.iss !== issuer ||
    !audienceAllowsAuthenticated(parsed.payload.aud) ||
    typeof parsed.payload.sub !== 'string' ||
    !UUID_RE.test(parsed.payload.sub) ||
    typeof parsed.payload.exp !== 'number'
  ) {
    return { ok: false, error: 'invalid_token' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (parsed.payload.exp <= nowSeconds) {
    return { ok: false, error: 'expired_token' };
  }

  // Reject tokens issued materially in the future.
  if (typeof parsed.payload.iat === 'number' && parsed.payload.iat > nowSeconds + 60) {
    return { ok: false, error: 'invalid_token' };
  }

  return {
    ok: true,
    user_id: parsed.payload.sub,
    email: parsed.payload.email,
    aal: parsed.payload.aal,
  };
}

export async function handleVerifyJwt(
  request: Request,
  env: VerifyJwtEnv,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'method_not_allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }

  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_token' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_token' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }

  const result = await verifyJwt(token, env);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 401,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
