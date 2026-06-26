// Governance Ingest-Key management.
//
// POST /functions/v1/governance-keys
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'create', tenant_id, name, allowed_sources?, rate_limit_per_minute? }
//   { op: 'list',   tenant_id }
//   { op: 'revoke', key_id }
//
// Caller must be owner or admin of the target tenant (looked up
// in `public.memberships`). On `create` the raw `rsd_gov_…` token
// is returned EXACTLY ONCE; the server only persists the sha256
// hash + a display-only prefix. Subsequent `list` calls never
// reveal the token.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex, randomToken } from '../_shared/hash.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const ALLOWED_SOURCES = [
  'website_scanner', 'browser_extension', 'sdk', 'api',
  'github', 'ci_cd', 'manual', 'agent_runtime',
] as const;

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'create': return await handleCreate(admin, userId, body);
      case 'list':   return await handleList(admin, userId, body);
      case 'revoke': return await handleRevoke(admin, userId, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const name = (body.name as string ?? '').trim();
  const allowedSources = Array.isArray(body.allowed_sources)
    ? (body.allowed_sources as string[]).map((s) => String(s))
    : [];
  const rateLimit = clampInt(body.rate_limit_per_minute, 60, 1, 10000);

  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!name || name.length > 120) return jsonError(400, 'BAD_REQUEST', 'name required (max 120 chars)');
  for (const s of allowedSources) {
    if (!ALLOWED_SOURCES.includes(s as typeof ALLOWED_SOURCES[number])) {
      return jsonError(400, 'BAD_REQUEST', `allowed_sources contains invalid value: ${s}`);
    }
  }

  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const token = 'rsd_gov_' + randomToken(24);
  const key_hash = await sha256Hex(token);
  const key_prefix = token.slice(0, 12); // `rsd_gov_xxxx`

  const { data, error } = await admin.from('governance_ingest_keys').insert({
    tenant_id,
    name,
    key_hash,
    key_prefix,
    allowed_sources: allowedSources,
    rate_limit_per_minute: rateLimit,
    created_by: userId,
  }).select('id, tenant_id, name, key_prefix, allowed_sources, rate_limit_per_minute, created_at')
    .single();
  if (error) throw error;

  return jsonResponse({ ok: true, key: data, token });
}

// deno-lint-ignore no-explicit-any
async function handleList(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }
  const { data, error } = await admin.from('governance_ingest_keys')
    .select('id, tenant_id, name, key_prefix, allowed_sources, rate_limit_per_minute, last_used_at, revoked_at, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return jsonResponse({ ok: true, keys: data ?? [] });
}

// deno-lint-ignore no-explicit-any
async function handleRevoke(admin: any, userId: string, body: Record<string, unknown>) {
  const key_id = body.key_id as string;
  if (!key_id) return jsonError(400, 'BAD_REQUEST', 'key_id required');

  const { data: keyRow } = await admin.from('governance_ingest_keys')
    .select('tenant_id, revoked_at')
    .eq('id', key_id).maybeSingle();
  if (!keyRow) return jsonError(404, 'NOT_FOUND', 'key not found');
  if (keyRow.revoked_at) return jsonResponse({ ok: true, already_revoked: true });

  if (!(await isOwnerOrAdmin(admin, userId, keyRow.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('governance_ingest_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', key_id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

