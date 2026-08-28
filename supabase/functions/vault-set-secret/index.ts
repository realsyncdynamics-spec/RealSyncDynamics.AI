// Operator function: write an allowlisted secret into vault.secrets.
//
// POST /functions/v1/vault-set-secret
// Body: { name: string, secret: string }
//
// Auth (fail-closed):
//   Authorization: Bearer <VAULT_OPERATOR_TOKEN>
//   OR service-role JWT.
// Never returns the secret value. Never accepts names outside ALLOWLIST.
// Distinct from Evidence Vault.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const ALLOWLIST = new Set([
  'resend_api_key',
  'stripe_secret_key',
  'stripe_webhook_secret',
]);

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  const operator = Deno.env.get('VAULT_OPERATOR_TOKEN');
  if (operator && token === operator) return true;

  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (service && token === service) return true;

  return false;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');
  if (!isAuthorized(req)) return jsonError(401, 'UNAUTHORIZED', 'operator token required');

  let body: { name?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const name = (body.name ?? '').trim();
  const secret = body.secret ?? '';
  if (!ALLOWLIST.has(name)) {
    return jsonError(400, 'NAME_NOT_ALLOWED', 'secret name is not on the operator allowlist');
  }
  if (typeof secret !== 'string' || secret.length < 16) {
    return jsonError(400, 'SECRET_TOO_SHORT', 'secret must be at least 16 characters');
  }
  if (name === 'resend_api_key' && !secret.startsWith('re_')) {
    return jsonError(400, 'BAD_RESEND_KEY', 'resend_api_key must start with re_');
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supa.rpc('set_app_secret', { secret_name: name, secret_value: secret });
  if (error) {
    console.error('[vault-set-secret] rpc failed', error.message);
    return jsonError(502, 'VAULT_WRITE_FAILED', error.message.slice(0, 200));
  }

  return jsonResponse({ ok: true, name, length: secret.length });
});
