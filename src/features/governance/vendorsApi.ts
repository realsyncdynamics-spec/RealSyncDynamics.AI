import { getSupabase } from '../../lib/supabase';

export type DpaStatus = 'none' | 'requested' | 'signed' | 'expired' | 'not_required';
export type TransferMechanism = 'adequacy' | 'scc' | 'bcr' | 'derogation' | 'none' | 'unknown';

export interface DbVendor {
  id: string;
  tenant_id: string | null;
  name: string;
  legal_name: string | null;
  country: string | null;
  website: string | null;
  privacy_policy_url: string | null;
  dpa_status: DpaStatus;
  dpa_signed_at: string | null;
  dpa_expires_at: string | null;
  transfer_mechanism: TransferMechanism;
  data_types_processed: string[];
  processing_purposes: string[];
  sub_processors: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  notes: string | null;
  created_at: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-vendors', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createVendor = (input: Record<string, unknown>) =>
  call<{ ok: boolean; vendor?: DbVendor; error?: { code: string; message: string } }>({ op: 'create', ...input });
export const updateVendor = (id: string, patch: Record<string, unknown>) =>
  call<{ ok: boolean; vendor?: DbVendor; error?: { code: string; message: string } }>({ op: 'update', id, ...patch });
export const deleteVendor = (id: string) =>
  call<{ ok: boolean; error?: { code: string; message: string } }>({ op: 'delete', id });

export async function fetchTenantVendors(tenantId: string): Promise<DbVendor[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('vendors').select('*')
    .eq('tenant_id', tenantId).order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbVendor[];
}

export async function countVendorsNoDpa(tenantId: string): Promise<number> {
  const sb = getSupabase();
  const { count } = await sb.from('vendors').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).in('dpa_status', ['none', 'requested', 'expired']);
  return count ?? 0;
}
