import { getSupabase } from '../../lib/supabase';
import type { GovernanceRiskLevel } from './types';

/**
 * Entscheidungsstatus einer Freigabe. Ob eine freigegebene Browser-Aktion
 * ausgeführt wurde, steht NICHT hier, sondern in browser_executions (#1728) —
 * siehe Approval.execution.
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

/** Einlösung einer Freigabe (browser_executions, höchstens eine je Freigabe). */
export type ApprovalExecutionStatus = 'reserved' | 'executed' | 'executed_unrecorded' | 'executor_failed';

export interface ApprovalExecution {
  id: string;
  status: ApprovalExecutionStatus;
  reserved_at: string;
  finished_at: string | null;
  detail: string | null;
}

const EXECUTION_STATUSES: ReadonlySet<string> = new Set(['reserved', 'executed', 'executed_unrecorded', 'executor_failed']);

/** PostgREST bettet die 1:1-Beziehung je nach Version als Objekt oder Array ein. */
export function normalizeExecution(value: unknown): ApprovalExecution | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.status !== 'string' || !EXECUTION_STATUSES.has(r.status)) return null;
  return {
    id: r.id,
    status: r.status as ApprovalExecutionStatus,
    reserved_at: typeof r.reserved_at === 'string' ? r.reserved_at : '',
    finished_at: typeof r.finished_at === 'string' ? r.finished_at : null,
    detail: typeof r.detail === 'string' ? r.detail : null,
  };
}

/** Redigierte Details einer Browser-Aktion (governance_events.payload, browser-execute). */
export interface BrowserActionPayload {
  browser_session_id?: string;
  action?: Record<string, unknown>;
  target?: string | null;
  page_url?: string | null;
  correlation_id?: string;
  initiated_by?: string;
  policy?: {
    decision: string;
    policy_id: string;
    policy_version: string;
    reason: string;
    risk_level: string;
    conditions: string[];
  };
}

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
  payload?: BrowserActionPayload | Record<string, unknown> | null;
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
  requested_by?: string | null;
  browser_session_id?: string | null;
  /** null = nie eingelöst. */
  execution?: ApprovalExecution | null;
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

export async function listApprovals(tenant_id: string, status: ApprovalStatus = 'pending'): Promise<ListResult> {
  const res = await call<ListResult>({ op: 'list', tenant_id, status });
  if (!res?.ok || !Array.isArray(res.approvals)) return res;
  return { ...res, approvals: res.approvals.map((a) => ({ ...a, execution: normalizeExecution((a as { execution?: unknown }).execution) })) };
}

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
  if (error) throw new Error(error.message);
  return count ?? 0;
}
