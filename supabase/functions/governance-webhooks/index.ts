// Governance Webhooks — CRUD.
//
// POST /functions/v1/governance-webhooks
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'create', tenant_id, name, target_url, min_risk_level? }
//   { op: 'list',   tenant_id }
//   { op: 'toggle', webhook_id, enabled }
//   { op: 'revoke', webhook_id }
//
// Owner / admin gated against memberships. On `create`, the raw
// `rsd_whsec_<24-bytes-b64url>` HMAC secret is returned EXACTLY
// ONCE. The server only stores its sha256 hash + a display
// prefix. governance-ingest reads the row but never the secret.
//
// NOTE: the secret_hash is what governance-ingest reads to derive
// the HMAC signing key — see ingest-handler delivery code.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex, randomToken } from '../_shared/hash.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        order(col: string, opts: { ascending: boolean }): Promise<{ data: unknown; error: unknown }>;
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
      order(col: string, opts: { ascending: boolean }): Promise<{ data: unknown; error: unknown }>;
    };
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    update(row: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
  };
}

const RISK_LEVELS = ['info', 'low', 'medium', 'high', 'critical'];

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
      case 'toggle': return await handleToggle(admin, userId, body);
      case 'revoke': return await handleRevoke(admin, userId, body);
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleCreate(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const name = (body.name as string ?? '').trim();
  const target_url = (body.target_url as string ?? '').trim();
  const min_risk_level = (body.min_risk_level as string) ?? 'high';

  if (!tenant_id || !name || !target_url) return jsonError(400, 'BAD_REQUEST', 'tenant_id, name, target_url required');
  if (name.length > 120) return jsonError(400, 'BAD_REQUEST', 'name max 120 chars');
  if (!/^https:\/\/[^\s]+$/.test(target_url)) return jsonError(400, 'BAD_REQUEST', 'target_url must be https URL');
  if (target_url.length > 500) return jsonError(400, 'BAD_REQUEST', 'target_url max 500 chars');
  if (!RISK_LEVELS.includes(min_risk_level)) {
    return jsonError(400, 'BAD_REQUEST', `min_risk_level must be one of ${RISK_LEVELS.join('|')}`);
  }
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const secret = 'rsd_whsec_' + randomToken(24);
  const secret_hash = await sha256Hex(secret);
  const secret_prefix = secret.slice(0, 14); // `rsd_whsec_xxxx`

  const { data, error } = await admin.from('governance_webhooks').insert({
    tenant_id,
    name,
    target_url,
    secret_hash,
    secret_prefix,
    min_risk_level,
    enabled: true,
    created_by: userId,
  }).select('id, tenant_id, name, target_url, secret_prefix, min_risk_level, enabled, created_at')
    .single();
  if (error) throw error;

  return jsonResponse({ ok: true, webhook: data, secret });
}

async function handleList(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }
  const { data, error } = await admin.from('governance_webhooks')
    .select('id, tenant_id, name, target_url, secret_prefix, min_risk_level, enabled, last_called_at, last_status, last_error, revoked_at, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return jsonResponse({ ok: true, webhooks: data ?? [] });
}

async function handleToggle(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const webhook_id = body.webhook_id as string;
  const enabled = body.enabled !== false;
  if (!webhook_id) return jsonError(400, 'BAD_REQUEST', 'webhook_id required');

  const { data: row } = await admin.from('governance_webhooks')
    .select('tenant_id').eq('id', webhook_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'webhook not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('governance_webhooks')
    .update({ enabled }).eq('id', webhook_id);
  if (error) throw error;
  return jsonResponse({ ok: true, enabled });
}

async function handleRevoke(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const webhook_id = body.webhook_id as string;
  if (!webhook_id) return jsonError(400, 'BAD_REQUEST', 'webhook_id required');

  const { data: row } = await admin.from('governance_webhooks')
    .select('tenant_id, revoked_at').eq('id', webhook_id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'webhook not found');
  if (row.revoked_at) return jsonResponse({ ok: true, already_revoked: true });
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('governance_webhooks')
    .update({ revoked_at: new Date().toISOString(), enabled: false })
    .eq('id', webhook_id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

async function isOwnerOrAdmin(admin: SupabaseAdminClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

