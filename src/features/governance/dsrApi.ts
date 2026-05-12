import { getSupabase } from '../../lib/supabase';
import type { DsrStatus, DsrRequestType } from './types';

export interface DbDsrRequest {
  id: string;
  tenant_id: string | null;
  request_type: DsrRequestType;
  status: DsrStatus;
  requester_name: string | null;
  requester_email: string;
  subject_description: string | null;
  affected_assets: string[];
  received_at: string;
  deadline_at: string;
  completed_at: string | null;
  response_notes: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface CreateResult { ok: boolean; dsr?: DbDsrRequest; error?: { code: string; message: string }; }
interface UpdateResult extends CreateResult {}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-dsr', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createDsr = (input: Record<string, unknown>) => call<CreateResult>({ op: 'create', ...input });
export const updateDsr = (id: string, patch: Record<string, unknown>) => call<UpdateResult>({ op: 'update', id, ...patch });

export async function fetchTenantDsrs(tenantId: string): Promise<DbDsrRequest[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('dsr_requests').select('*')
    .eq('tenant_id', tenantId).order('received_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbDsrRequest[];
}

export async function countOpenDsrs(tenantId: string): Promise<{ total: number; overdue: number }> {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { count: total } = await sb.from('dsr_requests').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).in('status', ['received', 'in_progress', 'pending_verification']);
  const { count: overdue } = await sb.from('dsr_requests').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).in('status', ['received', 'in_progress', 'pending_verification', 'overdue'])
    .lt('deadline_at', now);
  return { total: total ?? 0, overdue: overdue ?? 0 };
}
