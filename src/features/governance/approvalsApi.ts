import { getSupabase } from '../../lib/supabase';
import type { GovernanceRiskLevel } from './types';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalEventRef {
  id: string;
  title: string;
  summary: string | null;
  risk_level: GovernanceRiskLevel;
  event_type: string;
  event_source: string;
  vendor: string | null;
  model_name: string | null;
  data_types: string[];
  created_at: string;
}
export interface ApprovalPolicyRef {
  id: string;
  name: string;
  severity: GovernanceRiskLevel;
  policy_type: string;
}
export interface ApprovalAssetRef {
  id: string;
  name: string;
  asset_type: string;
  ai_act_class: string;
}

export interface Approval {
  id: string;
  tenant_id: string;
  event_id: string;
  policy_id: string | null;
  asset_id: string | null;
  status: ApprovalStatus;
  requested_action: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_reason: string | null;
  expires_at: string;
  created_at: string;
  event: ApprovalEventRef | null;
  policy: ApprovalPolicyRef | null;
  asset: ApprovalAssetRef | null;
}

export interface ListResult {
  ok: boolean;
  approvals?: Approval[];
  error?: { code: string; message: string };
}
export interface ResolveResult {
  ok: boolean;
  status?: ApprovalStatus;
  resolved_at?: string;
  error?: { code: string; message: string };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-approvals', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const listApprovals = (tenant_id: string, status: ApprovalStatus = 'pending') =>
  call<ListResult>({ op: 'list', tenant_id, status });

export const approveApproval = (approval_id: string, reason?: string) =>
  call<ResolveResult>({ op: 'approve', approval_id, reason });

export const rejectApproval = (approval_id: string, reason: string) =>
  call<ResolveResult>({ op: 'reject', approval_id, reason });

/** Fast count of pending approvals for the badge — direct Supabase read via RLS. */
export async function countPendingApprovals(tenant_id: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('governance_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}
