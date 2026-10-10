import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handleVerifyJwt, type VerifyJwtEnv } from '../../src/workers/verify-jwt/index';

const SECRET = 'super-secret-key-for-testing-only-32-chars';
const SUPABASE_URL = 'https://test.supabase.co';
const USER_ID = '123e4567-e89b-42d3-a456-426614174000';

const env: VerifyJwtEnv = {
  SUPABASE_JWT_SECRET: SECRET,
  SUPABASE_URL,
};

function token(
  overrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
  signingSecret = SECRET,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT', ...headerOverrides };
  const payload = {
    sub: USER_ID,
    email: 'test@example.com',
    aal: 'aal1',
    exp: now + 3600,
    iat: now,
    iss: `${SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    ...overrides,
  };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${signature}`;
}

async function verify(jwt: string, customEnv: VerifyJwtEnv = env) {
  const response = await handleVerifyJwt(
    new Request('https://worker.invalid/api/auth/verify-jwt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    }),
    customEnv,
  );
  return { response, body: await response.json() as Record<string, unknown> };
}

describe('Cloudflare JWT security gate', () => {
  it('accepts a correctly signed Supabase authenticated-user token', async () => {
    const { response, body } = await verify(token());
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, user_id: USER_ID, email: 'test@example.com' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects a tampered or wrongly signed token', async () => {
    const { response, body } = await verify(token({}, {}, 'different-secret'));
    expect(response.status).toBe(401);
    expect(body).toMatchObject({ ok: false, error: 'invalid_token' });
  });

  it('rejects missing expiration instead of treating it as non-expiring', async () => {
    const { response } = await verify(token({ exp: undefined }));
    expect(response.status).toBe(401);
  });

  it('rejects expired tokens after signature verification', async () => {
    const { response, body } = await verify(token({ exp: Math.floor(Date.now() / 1000) - 1 }));
    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: 'expired_token' });
  });

  it('rejects a token from a different Supabase issuer', async () => {
    const { response } = await verify(token({ iss: 'https://attacker.example/auth/v1' }));
    expect(response.status).toBe(401);
  });

  it('rejects a token without authenticated audience', async () => {
    const { response } = await verify(token({ aud: 'anon' }));
    expect(response.status).toBe(401);
  });

  it('rejects malformed or non-UUID subjects', async () => {
    const { response } = await verify(token({ sub: 'attacker-controlled' }));
    expect(response.status).toBe(401);
  });

  it('fails closed for asymmetric/unknown algorithms until JWKS support exists', async () => {
    const { response } = await verify(token({}, { alg: 'EdDSA' }));
    expect(response.status).toBe(401);
  });

  it('rejects missing and empty bearer tokens', async () => {
    for (const authorization of [null, 'Bearer ']) {
      const headers = new Headers();
      if (authorization !== null) headers.set('Authorization', authorization);
      const response = await handleVerifyJwt(
        new Request('https://worker.invalid/api/auth/verify-jwt', { method: 'POST', headers }),
        env,
      );
      expect(response.status).toBe(401);
    }
  });

  it('rejects non-POST methods', async () => {
    const response = await handleVerifyJwt(
      new Request('https://worker.invalid/api/auth/verify-jwt', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token()}` },
      }),
      env,
    );
    expect(response.status).toBe(405);
  });
});
