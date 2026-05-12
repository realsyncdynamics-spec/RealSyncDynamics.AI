import { getSupabase } from '../../lib/supabase';
import type { DpiaStatus } from './types';

export interface DbDpia {
  id: string;
  tenant_id: string | null;
  asset_id: string | null;
  title: string;
  status: DpiaStatus;
  necessity_assessment: string | null;
  proportionality_assessment: string | null;
  risk_description: string | null;
  mitigation_measures: string | null;
  dpo_consulted: boolean;
  dpo_email: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_due_at: string | null;
  created_at: string;
  updated_at: string;
  asset?: { id: string; name: string; asset_type: string; ai_act_class: string } | null;
}

interface Wrapper<T> { ok: boolean; error?: { code: string; message: string }; }
interface ListResult extends Wrapper<DbDpia> { dpias?: DbDpia[]; }
interface OneResult  extends Wrapper<DbDpia> { dpia?: DbDpia; }
interface ApproveResult extends Wrapper<unknown> { approved_at?: string; }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-dpias', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const listDpias    = (tenant_id: string)              => call<ListResult>({ op: 'list', tenant_id });
export const createDpia   = (input: Record<string, unknown>) => call<OneResult>({ op: 'create', ...input });
export const updateDpia   = (id: string, patch: Record<string, unknown>) => call<OneResult>({ op: 'update', id, ...patch });
export const approveDpia  = (id: string)                     => call<ApproveResult>({ op: 'approve', id });

export async function countOpenDpias(tenantId: string): Promise<number> {
  const sb = getSupabase();
  const { count } = await sb.from('dpias').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).in('status', ['draft', 'in_review']);
  return count ?? 0;
}
