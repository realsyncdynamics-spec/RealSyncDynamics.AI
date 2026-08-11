/**
 * Shared Auth helpers for Edge Functions (F-04 / F-05 remediation).
 *
 * Pattern (canonical, already used by governance-keys / governance-approvals / governance-dsr):
 * 1. Create a user-scoped client with the incoming Bearer token + ANON key
 * 2. Call auth.getUser() — this is the only source of truth for identity
 * 3. Use service_role only AFTER membership in the target tenant is verified
 *
 * Never accept client-supplied tenant_id for service_role operations without
 * a membership check. Never treat "startsWith('Bearer ')" as authentication.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { jsonError } from './gateway.ts';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthContext {
  user: AuthUser;
  /** User-scoped client (respects RLS) */
  userClient: SupabaseClient;
  /** Service-role client — only use after membership is confirmed */
  admin: SupabaseClient;
}

/**
 * Validates the Authorization header and returns a verified user + clients.
 * Returns a Response (401) on failure, or AuthContext on success.
 */
export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing or invalid Authorization header');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SRK) {
    return jsonError(500, 'INTERNAL', 'Supabase environment variables missing');
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp?.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid or expired token');
  }

  const admin = createClient(SUPABASE_URL, SRK, {
    auth: { persistSession: false },
  });

  return {
    user: {
      id: userResp.user.id,
      email: userResp.user.email,
    },
    userClient,
    admin,
  };
}

/**
 * Checks that the authenticated user is a member of the given tenant.
 * Optionally restricts to specific roles (default: any membership).
 */
export async function requireTenantMembership(
  admin: SupabaseClient,
  userId: string,
  tenantId: string,
  allowedRoles?: string[],
): Promise<boolean> {
  if (!tenantId || !userId) return false;

  const { data, error } = await admin
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return false;

  if (allowedRoles && allowedRoles.length > 0) {
    return allowedRoles.includes(data.role as string);
  }

  return true;
}

/**
 * Convenience: requireUser + membership check for a tenant_id that came from
 * the request body/query. Returns AuthContext + verified tenantId, or a Response.
 */
export async function requireAuthAndTenant(
  req: Request,
  clientTenantId: string | null | undefined,
  allowedRoles?: string[],
): Promise<(AuthContext & { tenantId: string }) | Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  if (!clientTenantId || typeof clientTenantId !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id is required');
  }

  const ok = await requireTenantMembership(
    auth.admin,
    auth.user.id,
    clientTenantId,
    allowedRoles,
  );

  if (!ok) {
    return jsonError(403, 'FORBIDDEN', 'not a member of the requested tenant');
  }

  return { ...auth, tenantId: clientTenantId };
}
