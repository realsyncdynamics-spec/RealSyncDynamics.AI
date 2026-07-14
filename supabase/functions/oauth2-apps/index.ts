// oauth2-apps — OAuth2 application management (rotate secrets, delete apps)
//
// POST /functions/v1/oauth2-apps
// Authorization: Bearer <user JWT>
// Body:
//   { op: 'rotate_secret', tenant_id, app_id }
//   { op: 'delete_app', tenant_id, app_id }
//   { op: 'get_app', tenant_id, app_id }
//
// Operations:
//   'rotate_secret': Generate new client secret (old tokens still valid until expiry)
//   'delete_app':    Delete app and revoke all active tokens
//   'get_app':       Retrieve app details (client_id visible, client_secret hidden)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');
  }

  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonError(401, 'UNAUTHORIZED', 'Missing bearer token');
    }

    const body = await req.json();
    const { op, tenant_id, app_id } = body;

    if (!op || !tenant_id || !app_id) {
      return jsonError(400, 'INVALID_REQUEST', 'Missing op, tenant_id, or app_id');
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (op) {
      case 'rotate_secret':
        return await handleRotateSecret(sb, tenant_id, app_id, req);
      case 'delete_app':
        return await handleDeleteApp(sb, tenant_id, app_id, req);
      case 'get_app':
        return await handleGetApp(sb, tenant_id, app_id);
      default:
        return jsonError(400, 'INVALID_OP', `Unknown operation: ${op}`);
    }
  } catch (err) {
    console.error('OAuth2 apps error:', err);
    return jsonError(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error');
  }
});

// Rotate client secret
async function handleRotateSecret(
  sb: any,
  tenantId: string,
  appId: string,
  req: Request
) {
  // Verify app belongs to tenant
  const { data: app, error: appError } = await sb
    .from('oauth2_applications')
    .select('id, tenant_id, client_id, client_secret_hash')
    .eq('id', appId)
    .eq('tenant_id', tenantId)
    .single();

  if (appError || !app) {
    return jsonError(404, 'NOT_FOUND', 'Application not found');
  }

  // Generate new secret
  const newSecret = generateSecret(64);
  const newSecretHash = await hashSecret(newSecret);

  // Update app with new secret hash
  const { error: updateError } = await sb
    .from('oauth2_applications')
    .update({ client_secret_hash: newSecretHash })
    .eq('id', appId);

  if (updateError) {
    return jsonError(500, 'UPDATE_ERROR', 'Failed to update secret');
  }

  // Revoke all existing tokens for this app
  await sb
    .from('oauth2_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('app_id', appId)
    .is('revoked_at', null);

  // Audit log
  await audit(sb, {
    tenant_id: tenantId,
    action: 'OAUTH2_SECRET_ROTATED',
    resource_type: 'oauth2_application',
    metadata: {
      app_id: appId,
      client_id: app.client_id,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    },
  });

  return jsonResponse({
    success: true,
    client_secret: newSecret, // Only returned once
    client_id: app.client_id,
    message: 'Secret rotated. All existing tokens have been revoked.',
  });
}

// Delete app and revoke tokens
async function handleDeleteApp(
  sb: any,
  tenantId: string,
  appId: string,
  req: Request
) {
  // Verify app belongs to tenant
  const { data: app, error: appError } = await sb
    .from('oauth2_applications')
    .select('id, tenant_id, client_id')
    .eq('id', appId)
    .eq('tenant_id', tenantId)
    .single();

  if (appError || !app) {
    return jsonError(404, 'NOT_FOUND', 'Application not found');
  }

  // Revoke all tokens
  await sb
    .from('oauth2_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('app_id', appId)
    .is('revoked_at', null);

  // Delete app
  const { error: deleteError } = await sb
    .from('oauth2_applications')
    .delete()
    .eq('id', appId);

  if (deleteError) {
    return jsonError(500, 'DELETE_ERROR', 'Failed to delete application');
  }

  // Audit log
  await audit(sb, {
    tenant_id: tenantId,
    action: 'OAUTH2_APP_DELETED',
    resource_type: 'oauth2_application',
    metadata: {
      app_id: appId,
      client_id: app.client_id,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    },
  });

  return jsonResponse({
    success: true,
    app_id: appId,
    message: 'Application deleted. All tokens have been revoked.',
  });
}

// Get app details (for verification)
async function handleGetApp(sb: any, tenantId: string, appId: string) {
  const { data: app, error: appError } = await sb
    .from('oauth2_applications')
    .select('id, client_id, name, description, redirect_uris, scopes, is_active, created_at, last_used_at')
    .eq('id', appId)
    .eq('tenant_id', tenantId)
    .single();

  if (appError || !app) {
    return jsonError(404, 'NOT_FOUND', 'Application not found');
  }

  // Get active token count
  const { count: activeTokens } = await sb
    .from('oauth2_tokens')
    .select('id', { count: 'exact' })
    .eq('app_id', appId)
    .is('revoked_at', null);

  return jsonResponse({
    ...app,
    active_tokens: activeTokens || 0,
  });
}

// Helper: Generate random secret
function generateSecret(length: number = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let secret = '';
  const crypto = globalThis.crypto;
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    secret += chars[randomValues[i] % chars.length];
  }
  return secret;
}

// Helper: Hash secret (simple SHA-256 for now)
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
