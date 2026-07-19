// Telegram Channels — Workspace-Verknüpfung verwalten.
//
// POST /functions/v1/telegram-channels
// Authorization: Bearer <user JWT>
//
// Body shapes:
//   { op: 'connect_complete', token }       — Token validieren, Connection aktivieren
//   { op: 'status' }                         — Verbindungsstatus abrufen
//   { op: 'revoke' }                         — Verbindung widerrufen
//
// Das connect_init (Token erzeugen) läuft im telegram-webhook beim /connect Command.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex } from '../_shared/hash.ts';
import { audit } from '../_shared/auditLog.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): SelectChain;
    update(obj: Record<string, unknown>): UpdateChain;
  };
}

interface SelectChain {
  eq(col: string, val: unknown): SelectChain;
  neq(col: string, val: unknown): SelectChain;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
}

interface UpdateChain extends Promise<{ error: unknown }> {
  eq(col: string, val: unknown): UpdateChain;
  neq(col: string, val: unknown): UpdateChain;
}

// Token-Gültigkeit: 15 Minuten
const TOKEN_TTL_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK               = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth:   { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId    = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'connect_complete': return await handleConnectComplete(admin, userId, userEmail, body);
      case 'status':           return await handleStatus(admin, userId);
      case 'revoke':           return await handleRevoke(admin, userId, userEmail);
      default:                 return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleConnectComplete(admin: SupabaseAdminClient, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const token          = (body.token as string ?? '').trim();
  const tenantId       = (body.tenant_id as string ?? '').trim();
  // telegram_user_id wird vom Bot in der Connect-URL als ?uid= mitgegeben und
  // hier zur Bindungsprüfung genutzt — verhindert Cross-User-Token-Diebstahl.
  const telegramUserId = (body.telegram_user_id as string ?? '').trim();

  if (!token)          return jsonError(400, 'BAD_REQUEST', 'token required');
  if (!tenantId)       return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!telegramUserId) return jsonError(400, 'BAD_REQUEST', 'telegram_user_id required');

  // Mitgliedschaft prüfen
  const { data: membership } = await admin
    .from('memberships')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this workspace');

  const tokenHash = await sha256Hex(token);

  // Token-Lookup mit Bindung an telegram_user_id — verhindert, dass ein
  // anderer Auth-User einen fremden Connect-Token einlöst.
  const { data: conn, error: connErr } = await admin
    .from('telegram_connections')
    .select('id, telegram_user_id, telegram_chat_id, created_at')
    .eq('connection_token_hash', tokenHash)
    .eq('telegram_user_id', telegramUserId)
    .eq('status', 'pending')
    .maybeSingle();

  if (connErr || !conn) return jsonError(404, 'NOT_FOUND', 'invalid or expired token');

  // TTL prüfen
  const createdAt = new Date(conn.created_at).getTime();
  if (Date.now() - createdAt > TOKEN_TTL_MS) {
    return jsonError(410, 'GONE', 'token expired');
  }

  // Bestehende 'connected' Rows für diesen User revoken → max. 1 aktive Verbindung pro User
  await admin
    .from('telegram_connections')
    .update({ status: 'revoked', connection_token_hash: null })
    .eq('user_id', userId)
    .eq('status', 'connected')
    .neq('id', conn.id);

  // Verbindung aktivieren
  const { error: updateErr } = await admin
    .from('telegram_connections')
    .update({
      user_id:               userId,
      tenant_id:             tenantId,
      status:                'connected',
      connection_token_hash: null,
      connected_at:          new Date().toISOString(),
    })
    .eq('id', conn.id);

  if (updateErr) return jsonError(500, 'INTERNAL', updateErr.message);

  await audit(admin, {
    tenant_id:     tenantId,
    actor_user_id: userId,
    actor_email:   userEmail,
    action:        'telegram.connect_complete',
    target_type:   'telegram_connection',
    target_id:     conn.id,
    payload: { telegram_user_id: conn.telegram_user_id, telegram_chat_id: conn.telegram_chat_id },
  });

  return jsonResponse({ ok: true, connected: true, telegram_user_id: conn.telegram_user_id });
}

async function handleStatus(admin: SupabaseAdminClient, userId: string) {
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('id, telegram_username, telegram_chat_id, status, connected_at, tenant_id')
    .eq('user_id', userId)
    .neq('status', 'revoked')
    .maybeSingle();

  if (!conn) return jsonResponse({ ok: true, connected: false });

  let tenantName: string | null = null;
  if (conn.tenant_id) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('name')
      .eq('id', conn.tenant_id)
      .maybeSingle();
    tenantName = tenant?.name ?? null;
  }

  return jsonResponse({
    ok:            true,
    connected:     conn.status === 'connected',
    status:        conn.status,
    telegram_username: conn.telegram_username,
    connected_at:  conn.connected_at,
    tenant_name:   tenantName,
  });
}

async function handleRevoke(admin: SupabaseAdminClient, userId: string, userEmail: string | null) {
  const { data: conn } = await admin
    .from('telegram_connections')
    .select('id, tenant_id, telegram_user_id')
    .eq('user_id', userId)
    .neq('status', 'revoked')
    .maybeSingle();

  if (!conn) return jsonResponse({ ok: true, revoked: false, msg: 'no active connection' });

  const { error } = await admin
    .from('telegram_connections')
    .update({ status: 'revoked', connection_token_hash: null })
    .eq('id', conn.id);

  if (error) return jsonError(500, 'INTERNAL', error.message);

  await audit(admin, {
    tenant_id:     conn.tenant_id ?? '00000000-0000-0000-0000-000000000000',
    actor_user_id: userId,
    actor_email:   userEmail,
    action:        'telegram.revoke',
    target_type:   'telegram_connection',
    target_id:     conn.id,
    payload: { telegram_user_id: conn.telegram_user_id },
  });

  return jsonResponse({ ok: true, revoked: true });
}

// --- Helpers --------------------------------------------------------------
