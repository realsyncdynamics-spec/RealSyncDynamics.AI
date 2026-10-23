// Tenant invite management.
//
// POST /functions/v1/tenant-invite
// Authorization: Bearer <user JWT>
// Body shapes:
//   { op: 'create',  tenant_id, email, role, ttl_hours? }
//   { op: 'list',    tenant_id }
//   { op: 'revoke',  invite_id }
//   { op: 'accept',  token }
//
// Owner / admin can create / list / revoke invites for their tenants.
// Any authenticated user can accept a token (we match the email if it
// is verified on the auth.users record).
//
// Nutzerplätze (`limit.team_seats`) werden beim Einladen und beim Annehmen
// geprüft — siehe `_shared/seat-limit.ts`. Überschreitung → 402.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sha256Hex, randomToken } from '../_shared/hash.ts';
import { loadEntitlementsForTenant } from '../_shared/entitlements.ts';
import { decideSeat, seatDecisionMessage, type SeatPhase } from '../_shared/seat-limit.ts';
import { observeAal2 } from '../_shared/requireAal2.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

type Role = 'admin' | 'editor' | 'viewer_auditor';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        order(col: string, options?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
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

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
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
  const user = userResp.user;
  const userId = user.id;
  const userEmail = (user.email ?? '').toLowerCase();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  // P0d Phase 1 — OBSERVE ONLY: nur privilegierte Ops beobachten, NICHT blocken.
  // `accept` ist bewusst ausgenommen (jeder authentifizierte Nutzer nimmt an).
  if (body.op !== 'accept') observeAal2(auth, `tenant-invite:${String(body.op)}`);

  try {
    switch (body.op) {
      case 'create': return await handleCreate(admin, userId, body, seatGate(admin));
      case 'list':   return await handleList(admin, userId, body);
      case 'revoke': return await handleRevoke(admin, userId, body);
      case 'accept': return await handleAccept(admin, userId, userEmail, body, seatGate(admin));
      default:       return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

/** Prüft die Plätze eines Mandanten; `null` heißt frei, sonst die Ablehnung. */
type SeatGate = (tenantId: string, phase: SeatPhase, userId?: string) => Promise<Response | null>;

function seatGate(admin: SupabaseClient): SeatGate {
  return async (tenantId, phase, userId) => {
    const ent = await loadEntitlementsForTenant(admin, tenantId);

    const members = await admin.from('memberships')
      .select('user_id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    if (members.error) throw members.error;

    let pendingInvites = 0;
    if (phase === 'invite') {
      const pending = await admin.from('tenant_invites')
        .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        .is('accepted_at', null).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString());
      if (pending.error) throw pending.error;
      pendingInvites = pending.count ?? 0;
    }

    let alreadyMember = false;
    if (phase === 'accept' && userId) {
      const own = await admin.from('memberships').select('user_id')
        .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
      if (own.error) throw own.error;
      alreadyMember = own.data !== null;
    }

    const decision = decideSeat({
      phase,
      limit: ent.byKey['limit.team_seats']?.value,
      members: members.count ?? 0,
      pendingInvites,
      alreadyMember,
    });
    if (decision.ok) return null;
    return jsonError(402, decision.code, seatDecisionMessage(decision, phase), corsHeaders,
      decision.code === 'SEAT_LIMIT_REACHED' ? { limit: decision.limit, used: decision.used } : undefined);
  };
}

async function handleCreate(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>, seats: SeatGate) {
  const tenant_id = body.tenant_id as string;
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = body.role as Role;
  const ttlHours = Math.min(Math.max(Number(body.ttl_hours ?? 168), 1), 24 * 30);

  if (!tenant_id || !email || !['admin', 'editor', 'viewer_auditor'].includes(role)) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, email, role required');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return jsonError(400, 'BAD_REQUEST', 'invalid email');
  }

  // Caller must be owner or admin of the tenant.
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const seatRefusal = await seats(tenant_id, 'invite');
  if (seatRefusal) return seatRefusal;

  const token = randomToken();
  const token_hash = await sha256Hex(token);
  const expires_at = new Date(Date.now() + ttlHours * 3600_000).toISOString();

  const { data, error } = await admin.from('tenant_invites').insert({
    tenant_id, email, role, token_hash, invited_by: userId, expires_at,
  }).select('id,tenant_id,email,role,expires_at,created_at').single();
  if (error) throw error;

  return jsonResponse({ ok: true, invite: data, token });
}

async function handleList(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }
  const { data, error } = await admin.from('tenant_invites')
    .select('id,tenant_id,email,role,expires_at,accepted_at,revoked_at,created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return jsonResponse({ ok: true, invites: data ?? [] });
}

async function handleRevoke(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>) {
  const invite_id = body.invite_id as string;
  if (!invite_id) return jsonError(400, 'BAD_REQUEST', 'invite_id required');

  const { data: invite } = await admin.from('tenant_invites')
    .select('tenant_id,accepted_at,revoked_at')
    .eq('id', invite_id).maybeSingle();
  if (!invite) return jsonError(404, 'NOT_FOUND', 'invite not found');
  if (invite.accepted_at) return jsonError(409, 'CONFLICT', 'invite already accepted');
  if (invite.revoked_at)  return jsonResponse({ ok: true, already_revoked: true });

  if (!(await isOwnerOrAdmin(admin, userId, invite.tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  const { error } = await admin.from('tenant_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invite_id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

async function handleAccept(admin: SupabaseAdminClient, userId: string, userEmail: string, body: Record<string, unknown>, seats: SeatGate) {
  const token = body.token as string;
  if (!token) return jsonError(400, 'BAD_REQUEST', 'token required');

  const token_hash = await sha256Hex(token);
  const { data: invite } = await admin.from('tenant_invites')
    .select('id,tenant_id,email,role,expires_at,accepted_at,revoked_at')
    .eq('token_hash', token_hash).maybeSingle();
  if (!invite) return jsonError(404, 'NOT_FOUND', 'invalid token');
  if (invite.revoked_at)  return jsonError(410, 'REVOKED',  'invite was revoked');
  if (invite.accepted_at) return jsonError(409, 'CONSUMED', 'invite already accepted');
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonError(410, 'EXPIRED', 'invite expired');
  }
  if (invite.email && userEmail && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return jsonError(403, 'EMAIL_MISMATCH', `invite is for ${invite.email}, you are signed in as ${userEmail}`);
  }

  const seatRefusal = await seats(invite.tenant_id, 'accept', userId);
  if (seatRefusal) return seatRefusal;

  // Idempotent membership upsert (don't error on existing).
  const { error: memErr } = await admin.from('memberships').insert({
    tenant_id: invite.tenant_id,
    user_id: userId,
    role: invite.role,
  });
  if (memErr && !/duplicate key/i.test(memErr.message)) throw memErr;

  const { error: updErr } = await admin.from('tenant_invites')
    .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('id', invite.id);
  if (updErr) throw updErr;

  return jsonResponse({ ok: true, tenant_id: invite.tenant_id, role: invite.role });
}

async function isOwnerOrAdmin(admin: SupabaseAdminClient, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

