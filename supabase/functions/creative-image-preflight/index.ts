/**
 * Creative Studio image request preflight.
 *
 * Authenticated, tenant-scoped, read-only. It NEVER generates an image or
 * charges money. Production generation stays disabled until an atomic job
 * reservation and tenant-isolated storage have been approved and deployed.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { CreativeInputError, validateImageCreateInput } from '../_shared/creativeImageContract.ts';
import { loadEntitlementsForTenant, hasFeature } from '../_shared/entitlements.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;
const FEATURE_KEY = 'creative.image.generate'; // Proposed entitlement, not provisioned.

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length > 8192) {
    return jsonError(401, 'UNAUTHORIZED', 'authentication required');
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) {
    return jsonError(503, 'NOT_CONFIGURED', 'Creative Studio unavailable');
  }

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid session');
  }

  const declaredSize = Number(req.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declaredSize) || declaredSize > MAX_BODY_BYTES) {
    return jsonError(413, 'PAYLOAD_TOO_LARGE', 'request too large');
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid body');
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return jsonError(413, 'PAYLOAD_TOO_LARGE', 'request too large');
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid payload');
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !['tenant_id', 'image'].includes(key)) ||
      typeof record.tenant_id !== 'string' || !UUID.test(record.tenant_id)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid tenant');
  }
  try {
    validateImageCreateInput(record.image);
  } catch (error) {
    if (error instanceof CreativeInputError) {
      return jsonError(400, 'BAD_REQUEST', error.message);
    }
    return jsonError(400, 'BAD_REQUEST', 'invalid image settings');
  }

  // User-scoped query: membership RLS applies; never trust a tenant ID alone.
  const { data: membership, error: memberError } = await userClient
    .from('memberships')
    .select('tenant_id')
    .eq('tenant_id', record.tenant_id)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (memberError) {
    return jsonError(503, 'MEMBERSHIP_UNAVAILABLE', 'membership verification unavailable');
  }
  if (!membership) {
    return jsonError(403, 'FORBIDDEN', 'tenant access denied');
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    const entitlements = await loadEntitlementsForTenant(admin, record.tenant_id);
    if (!hasFeature(entitlements, FEATURE_KEY)) {
      return jsonError(403, 'FEATURE_DISABLED', 'Creative image generation is not enabled');
    }
  } catch {
    return jsonError(503, 'ENTITLEMENTS_UNAVAILABLE', 'entitlement verification unavailable');
  }

  // Deliberately no call to xAI or Storage. Budget reservation is not built.
  return jsonResponse({
    ok: false,
    ready: false,
    status: 'blocked',
    reason: 'ATOMIC_RESERVATION_NOT_IMPLEMENTED',
  }, 503);
});
