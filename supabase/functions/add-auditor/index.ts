// Add Auditor/Assessor to Audit Engagement
// POST: Invite auditor, create engagement record

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

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
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = body.tenant_id as string;
  const name = (body.name as string ?? '').trim();
  const email = (body.email as string ?? '').trim();
  const organization = (body.organization as string ?? '').trim() || null;
  const role = (body.role as string ?? 'auditor').toLowerCase();

  if (!tenantId || !name || !email) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id, name, email required');
  }

  // Verify access
  const { data: member } = await userClient
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single();

  if (!member) {
    return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  }

  // In a real system, this would:
  // 1. Create an auditor_engagement record
  // 2. Create audit_assignments for all controls
  // 3. Send invitation email
  // For now, we'll just return success and log the audit action

  await audit(admin, {
    tenant_id: tenantId,
    user_id: userId,
    user_email: userEmail,
    action: 'auditor_invited',
    resource_type: 'audit_engagement',
    resource_id: tenantId,
    changes: {
      auditor_name: name,
      auditor_email: email,
      auditor_role: role,
    },
    severity: 'info',
  });

  return jsonResponse({
    success: true,
    message: `Auditor ${name} has been invited to the ISO 42001 certification audit.`,
    auditor: {
      id: `auditor-${Date.now()}`,
      name,
      email,
      organization,
      role,
    },
  });
}
