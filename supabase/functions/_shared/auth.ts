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

/**
 * Constant-time string comparison. Keeps the response time from revealing how
 * much of a token was guessed correctly.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Machine-caller gate for endpoints that are NOT invoked by a human: pg_cron
 * jobs and database triggers. They authenticate with the service-role key,
 * which `net.http_post` sends as `Bearer <service_role_key>` (see
 * 20260719000000_stripe_trial_webhook_trigger.sql).
 *
 * Why this is not a loophole: whoever holds the service-role key already has
 * full, RLS-free database access, so gating the function adds nothing against
 * that holder. What it DOES stop is the case these endpoints actually had — an
 * ordinary logged-in user passing the platform JWT gate and then triggering a
 * cross-tenant recalculation or injecting billing state, because the function
 * only ever checked that the header started with "Bearer ".
 *
 * The comparison is against the EXACT key, in constant time. Never use this as
 * a substitute for requireUser on an endpoint a human calls.
 *
 * Returns null when the caller is the platform itself, or a 401/500 Response.
 */
export function requireServiceRole(req: Request): Response | null {
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SRK) {
    return jsonError(500, 'INTERNAL', 'Supabase environment variables missing');
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing or invalid Authorization header');
  }

  const token = authHeader.slice(7).trim();
  // An empty token must never pass: `startsWith('Bearer ')` alone was exactly
  // the bug this helper exists to close.
  if (!token || !timingSafeEqual(token, SRK)) {
    return jsonError(401, 'UNAUTHORIZED', 'internal endpoint — service role required');
  }

  return null;
}
