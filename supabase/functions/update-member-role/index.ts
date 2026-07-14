import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

interface RoleUpdateRequest {
  member_id: string;
  new_role: 'owner' | 'editor' | 'viewer' | 'approver';
  reason?: string;
}

interface RoleUpdateResponse {
  ok: boolean;
  success?: boolean;
  message: string;
  old_role?: string;
  new_role?: string;
  code?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return jsonResponse({ ok: false, code, message }, status);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST required');
  }

  let body: RoleUpdateRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const { member_id: memberId, new_role: newRole, reason } = body;
  if (!memberId || !newRole || !['owner', 'editor', 'viewer', 'approver'].includes(newRole)) {
    return jsonError(400, 'BAD_REQUEST', 'member_id and new_role (owner/editor/viewer/approver) required');
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'bearer token required');
  }

  // Caller-scoped client for reads.
  const caller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Service-role client for updates.
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Get current user.
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) {
    return jsonError(401, 'UNAUTHORIZED', 'could not get user from token');
  }

  // Get member details (with RLS enforcement via caller).
  const { data: memberData, error: memberErr } = await caller
    .from('terminal_session_members')
    .select('id, session_id, tenant_id, role, user_id')
    .eq('id', memberId)
    .single();

  if (memberErr || !memberData) {
    return jsonError(404, 'NOT_FOUND', 'member not found or access denied');
  }

  const tenantId = memberData.tenant_id;
  const sessionId = memberData.session_id;
  const oldRole = memberData.role;
  const targetUserId = memberData.user_id;

  // Verify caller is owner or approver in this session (permission check).
  const { data: callerMemberData } = await caller
    .from('terminal_session_members')
    .select('role')
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (!callerMemberData || (callerMemberData.role !== 'owner' && callerMemberData.role !== 'approver')) {
    return jsonError(403, 'FORBIDDEN', 'only owner or approver can change roles');
  }

  // Prevent self-downgrade from owner.
  if (user.id === targetUserId && oldRole === 'owner' && newRole !== 'owner') {
    return jsonError(409, 'INVALID_OPERATION', 'cannot downgrade your own owner role');
  }

  // Use the update_member_role stored procedure for atomic operation.
  const { data: updateResult, error: updateErr } = await admin.rpc(
    'update_member_role',
    {
      p_member_id: memberId,
      p_new_role: newRole,
      p_changed_by: user.id,
      p_tenant_id: tenantId,
      p_reason: reason || null,
    }
  );

  if (updateErr) {
    return jsonError(500, 'UPDATE_FAILED', updateErr.message);
  }

  if (!updateResult || !Array.isArray(updateResult) || updateResult.length === 0) {
    return jsonError(500, 'UPDATE_FAILED', 'unexpected response from update function');
  }

  const result = updateResult[0];
  const response: RoleUpdateResponse = {
    ok: result.success,
    success: result.success,
    message: result.message,
    old_role: result.old_role,
    new_role: newRole,
  };

  if (!result.success) {
    return jsonResponse(response, 409);
  }

  return jsonResponse(response);
});
