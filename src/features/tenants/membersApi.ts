// Tenant members — client API for the tenant-members edge function (P0b).
import { getSupabase } from '../../lib/supabase';
import type { TenantMemberRole } from './memberGuards';

export interface Member {
  user_id: string;
  role: TenantMemberRole;
  created_at: string;
  email: string | null;
  is_self: boolean;
}

interface ListResult   { ok: boolean; members: Member[]; caller_role?: string; error?: { code: string; message: string } }
interface MutateResult { ok: boolean; error?: { code: string; message: string } }

async function call<T>(op: string, payload: Record<string, unknown>, empty: T): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('tenant-members', { body: { op, ...payload } });
  if (error) return { ...empty, ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as T;
}

export async function listMembers(tenantId: string): Promise<ListResult> {
  return call<ListResult>('list', { tenant_id: tenantId }, { ok: false, members: [] });
}

export async function setMemberRole(tenantId: string, targetUserId: string, role: TenantMemberRole): Promise<MutateResult> {
  return call<MutateResult>('set_role', { tenant_id: tenantId, target_user_id: targetUserId, role }, { ok: false });
}

export async function removeMember(tenantId: string, targetUserId: string): Promise<MutateResult> {
  return call<MutateResult>('remove', { tenant_id: tenantId, target_user_id: targetUserId }, { ok: false });
}
