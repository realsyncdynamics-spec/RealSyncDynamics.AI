// Kodee Onboard — manages VPS connections and their encrypted SSH keys.
//
// Endpoint: POST /functions/v1/kodee-onboard
// Auth:     Authorization: Bearer <user JWT>
// Body:     { op: "create" | "list" | "delete" | "update", ... }
//
// "create" accepts a plaintext SSH private key in transit (HTTPS), encrypts it
// with KODEE_SECRETS_KEY before persisting. The plaintext key is never logged
// or stored in this function's memory beyond the encrypt call.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encryptPrivateKey } from '../kodee/secrets.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateOp {
  op: 'create';
  label: string;
  host: string;
  port?: number;
  username: string;
  private_key: string;
  known_host_fingerprint?: string;
  public_key_fingerprint?: string;
  /** Optional tenant scope; null = personal connection (owner-only). */
  tenant_id?: string | null;
}
interface ListOp { op: 'list' }
interface DeleteOp { op: 'delete'; connection_id: string }
interface UpdateOp {
  op: 'update';
  connection_id: string;
  label?: string;
  host?: string;
  port?: number;
  username?: string;
  known_host_fingerprint?: string | null;
  private_key?: string;
  /** Re-scope: null = make personal, uuid = move to that tenant. */
  tenant_id?: string | null;
}
type OnboardRequest = CreateOp | ListOp | DeleteOp | UpdateOp;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: OnboardRequest;
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    switch (body.op) {
      case 'list': {
        // Owner-or-tenant-member visibility — fetch the user's tenants and OR
        // them into the query. Done in two steps because supabase-js .or()
        // syntax is awkward across nullable refs.
        const { data: memberships } = await admin
          .from('memberships').select('tenant_id').eq('user_id', userId);
        const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
        const filter = tenantIds.length
          ? `owner_id.eq.${userId},tenant_id.in.(${tenantIds.join(',')})`
          : `owner_id.eq.${userId}`;
        const { data, error } = await admin
          .from('vps_connections')
          .select('id,label,host,port,username,owner_id,tenant_id,known_host_fingerprint,created_at,updated_at,last_used_at')
          .or(filter)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return json({ ok: true, connections: data ?? [] });
      }
      case 'create': {
        if (!body.label || !body.host || !body.username || !body.private_key) {
          return jsonError(400, 'BAD_REQUEST', 'label, host, username, private_key required');
        }
        const port = body.port ?? 22;
        if (port < 1 || port > 65535) return jsonError(400, 'BAD_REQUEST', 'port out of range');

        // If tenant_id is provided, the caller must be a member of it.
        if (body.tenant_id) {
          const { count } = await admin
            .from('memberships')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', body.tenant_id).eq('user_id', userId);
          if (!count) return jsonError(403, 'FORBIDDEN', 'not a member of the requested tenant');
        }

        const { data: conn, error: connErr } = await admin
          .from('vps_connections')
          .insert({
            owner_id: userId,
            tenant_id: body.tenant_id ?? null,
            label: body.label,
            host: body.host,
            port,
            username: body.username,
            known_host_fingerprint: body.known_host_fingerprint ?? null,
          })
          .select('id,label,host,port,username,owner_id,tenant_id,known_host_fingerprint,created_at')
          .single();
        if (connErr || !conn) throw connErr ?? new Error('insert failed');

        const envelope = await encryptPrivateKey(body.private_key, conn.id);
        const { error: keyErr } = await admin
          .from('vps_ssh_keys')
          .insert({
            connection_id: conn.id,
            encrypted_private_key: new TextEncoder().encode(envelope),
            public_key_fingerprint: body.public_key_fingerprint ?? null,
          });
        if (keyErr) {
          // rollback connection if key insert fails
          await admin.from('vps_connections').delete().eq('id', conn.id);
          throw keyErr;
        }

        return json({ ok: true, connection: conn });
      }
      case 'update': {
        if (!body.connection_id) return jsonError(400, 'BAD_REQUEST', 'connection_id required');
        const patch: Record<string, unknown> = {};
        if (body.label !== undefined) patch.label = body.label;
        if (body.host !== undefined) patch.host = body.host;
        if (body.port !== undefined) {
          if (body.port < 1 || body.port > 65535) return jsonError(400, 'BAD_REQUEST', 'port out of range');
          patch.port = body.port;
        }
        if (body.username !== undefined) patch.username = body.username;
        if (body.known_host_fingerprint !== undefined) patch.known_host_fingerprint = body.known_host_fingerprint;
        if (body.tenant_id !== undefined) {
          if (body.tenant_id) {
            const { count } = await admin
              .from('memberships')
              .select('id', { count: 'exact', head: true })
              .eq('tenant_id', body.tenant_id).eq('user_id', userId);
            if (!count) return jsonError(403, 'FORBIDDEN', 'not a member of the requested tenant');
          }
          patch.tenant_id = body.tenant_id;
        }

        if (Object.keys(patch).length) {
          const { error } = await admin
            .from('vps_connections')
            .update(patch)
            .eq('id', body.connection_id)
            .eq('owner_id', userId);
          if (error) throw error;
        }
        if (body.private_key) {
          const envelope = await encryptPrivateKey(body.private_key, body.connection_id);
          const { error } = await admin
            .from('vps_ssh_keys')
            .upsert({
              connection_id: body.connection_id,
              encrypted_private_key: new TextEncoder().encode(envelope),
            });
          if (error) throw error;
        }
        return json({ ok: true });
      }
      case 'delete': {
        if (!body.connection_id) return jsonError(400, 'BAD_REQUEST', 'connection_id required');
        const { error } = await admin
          .from('vps_connections')
          .delete()
          .eq('id', body.connection_id)
          .eq('owner_id', userId);
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message ?? String(e));
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
