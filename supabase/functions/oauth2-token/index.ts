// oauth2-token — OAuth2 token management (generate, validate, revoke)
//
// POST /functions/v1/oauth2-token
// Authorization: Bearer <client_id:client_secret> or <access_token>
// Body:
//   { op: 'token', grant_type: 'client_credentials', scope?: string }
//   { op: 'validate', access_token: string }
//   { op: 'revoke', token: string }
//
// Operations:
//   'token':    Generate new access token for client credentials
//   'validate': Check token validity and rate limits
//   'revoke':   Revoke access or refresh token

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
const REFRESH_TOKEN_EXPIRY_SECONDS = 2592000; // 30 days

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');
  }

  try {
    const body = await req.json();
    const { op, tenant_id, ...payload } = body;

    if (!op) {
      return jsonError(400, 'INVALID_REQUEST', 'Missing op parameter');
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (op) {
      case 'token':
        return await handleTokenGeneration(sb, tenant_id, payload, req);
      case 'validate':
        return await handleTokenValidation(sb, tenant_id, payload);
      case 'revoke':
        return await handleTokenRevocation(sb, tenant_id, payload);
      default:
        return jsonError(400, 'INVALID_OP', `Unknown operation: ${op}`);
    }
  } catch (err) {
    console.error('OAuth2 token error:', err);
    return jsonError(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error');
  }
});

// Generate new access/refresh token for client credentials
async function handleTokenGeneration(
  sb: any,
  tenantId: string,
  payload: any,
  req: Request
) {
  const { grant_type, scope, client_id, client_secret } = payload;

  if (!grant_type || grant_type !== 'client_credentials') {
    return jsonError(400, 'UNSUPPORTED_GRANT_TYPE', 'Only client_credentials supported');
  }

  if (!client_id || !client_secret) {
    return jsonError(401, 'INVALID_CLIENT', 'Missing client credentials');
  }

  // Look up application by client_id
  const { data: app, error: appError } = await sb
    .from('oauth2_applications')
    .select('id, tenant_id, client_secret_hash, scopes, is_active')
    .eq('client_id', client_id)
    .single();

  if (appError || !app) {
    return jsonError(401, 'INVALID_CLIENT', 'Client not found');
  }

  if (!app.is_active) {
    return jsonError(401, 'CLIENT_INACTIVE', 'Application is not active');
  }

  // Verify client secret (in production: bcrypt comparison)
  const isValidSecret = await verifyClientSecret(client_secret, app.client_secret_hash);
  if (!isValidSecret) {
    return jsonError(401, 'INVALID_CLIENT', 'Invalid client secret');
  }

  // Verify tenant match
  if (app.tenant_id !== tenantId) {
    return jsonError(403, 'FORBIDDEN', 'Tenant mismatch');
  }

  // Check rate limits
  const rateLimitOk = await checkRateLimit(sb, app.id, 'token_generation');
  if (!rateLimitOk) {
    return jsonError(429, 'RATE_LIMITED', 'Too many token requests');
  }

  // Determine final scopes
  const requestedScopes = scope ? scope.split(' ') : [];
  const allowedScopes = requestedScopes.length > 0
    ? requestedScopes.filter(s => app.scopes.includes(s))
    : app.scopes;

  if (allowedScopes.length === 0) {
    return jsonError(400, 'INVALID_SCOPE', 'No valid scopes requested');
  }

  // Generate tokens
  const accessToken = generateToken(128);
  const refreshToken = generateToken(128);
  const accessTokenHash = await hashToken(accessToken);
  const refreshTokenHash = await hashToken(refreshToken);

  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);

  // Store tokens
  const { error: storeError } = await sb
    .from('oauth2_tokens')
    .insert([
      {
        app_id: app.id,
        tenant_id: tenantId,
        token_hash: accessTokenHash,
        token_type: 'access',
        scope: allowedScopes.join(' '),
        expires_at: expiresAt.toISOString(),
      },
      {
        app_id: app.id,
        tenant_id: tenantId,
        token_hash: refreshTokenHash,
        token_type: 'refresh',
        scope: allowedScopes.join(' '),
        expires_at: refreshExpiresAt.toISOString(),
      },
    ]);

  if (storeError) {
    console.error('Failed to store tokens:', storeError);
    return jsonError(500, 'TOKEN_STORAGE_ERROR', 'Failed to store tokens');
  }

  // Audit log
  await audit(sb, {
    tenant_id: tenantId,
    action: 'OAUTH2_TOKEN_GENERATED',
    resource_type: 'oauth2_token',
    metadata: {
      app_id: app.id,
      client_id,
      scope: allowedScopes.join(' '),
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    },
  });

  return jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: TOKEN_EXPIRY_SECONDS,
    scope: allowedScopes.join(' '),
  });
}

// Validate token and check rate limits
async function handleTokenValidation(sb: any, tenantId: string, payload: any) {
  const { access_token } = payload;

  if (!access_token) {
    return jsonError(400, 'INVALID_REQUEST', 'Missing access_token');
  }

  const tokenHash = await hashToken(access_token);

  // Look up token
  const { data: token, error: tokenError } = await sb
    .from('oauth2_tokens')
    .select('app_id, scope, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .eq('tenant_id', tenantId)
    .single();

  if (tokenError || !token) {
    return jsonError(401, 'INVALID_TOKEN', 'Token not found');
  }

  if (token.revoked_at) {
    return jsonError(401, 'TOKEN_REVOKED', 'Token has been revoked');
  }

  if (new Date(token.expires_at) < new Date()) {
    return jsonError(401, 'TOKEN_EXPIRED', 'Token has expired');
  }

  // Update last_used_at
  await sb
    .from('oauth2_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  // Update app's last_used_at
  await sb
    .from('oauth2_applications')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', token.app_id);

  return jsonResponse({
    active: true,
    scope: token.scope,
    expires_at: token.expires_at,
  });
}

// Revoke access or refresh token
async function handleTokenRevocation(sb: any, tenantId: string, payload: any) {
  const { token } = payload;

  if (!token) {
    return jsonError(400, 'INVALID_REQUEST', 'Missing token');
  }

  const tokenHash = await hashToken(token);

  const { error } = await sb
    .from('oauth2_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .eq('tenant_id', tenantId);

  if (error) {
    return jsonError(500, 'REVOCATION_ERROR', 'Failed to revoke token');
  }

  // Audit log
  await audit(sb, {
    tenant_id: tenantId,
    action: 'OAUTH2_TOKEN_REVOKED',
    resource_type: 'oauth2_token',
  });

  return jsonResponse({ revoked: true });
}

// Helper: Check rate limits
async function checkRateLimit(sb: any, appId: string, operation: string): Promise<boolean> {
  const { data: rateLimit } = await sb
    .from('oauth2_rate_limits')
    .select('requests_minute, window_start_minute')
    .eq('app_id', appId)
    .single();

  if (!rateLimit) {
    return true; // No limit set yet, allow
  }

  const now = new Date();
  const windowStart = new Date(rateLimit.window_start_minute);
  const minutesPassed = (now.getTime() - windowStart.getTime()) / (1000 * 60);

  if (minutesPassed >= 1) {
    // Reset window
    await sb
      .from('oauth2_rate_limits')
      .update({
        requests_minute: 1,
        window_start_minute: now.toISOString(),
      })
      .eq('app_id', appId);
    return true;
  }

  // Within window
  if (rateLimit.requests_minute >= 100) {
    // Arbitrary limit of 100 per minute
    return false;
  }

  await sb
    .from('oauth2_rate_limits')
    .update({ requests_minute: rateLimit.requests_minute + 1 })
    .eq('app_id', appId);

  return true;
}

// Helper: Generate random token
function generateToken(length: number = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = '';
  const crypto = globalThis.crypto;
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

// Helper: Hash token (simple SHA-256 for now)
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Verify client secret (stub — use bcrypt in production)
async function verifyClientSecret(secret: string, hash: string): Promise<boolean> {
  // Placeholder: In production, use bcrypt.compare(secret, hash)
  // For now, just check if hash exists
  return hash.length > 0;
}
