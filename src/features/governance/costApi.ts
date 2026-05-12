import { getSupabase } from '../../lib/supabase';

export interface DbTokenUsage {
  id: string;
  asset_id: string | null;
  event_id: string | null;
  environment: string;
  vendor: string;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  cost_eur: number | null;
  request_type: string;
  recorded_at: string;
}

export interface DbTokenUsageMonthly {
  tenant_id: string;
  asset_id: string | null;
  vendor: string;
  model_name: string;
  environment: string;
  month: string;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number | null;
  total_cost_eur: number | null;
  request_count: number;
}

export async function fetchTenantTokenMonthly(tenantId: string, months = 3): Promise<DbTokenUsageMonthly[]> {
  const sb = getSupabase();
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
  const { data, error } = await sb.from('token_usage_monthly').select('*')
    .eq('tenant_id', tenantId).gte('month', cutoff.toISOString())
    .order('month', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbTokenUsageMonthly[];
}

export async function fetchTenantTokenTotal(tenantId: string): Promise<{ totalTokens: number; totalCostUsd: number; topVendor: string; topAsset: string }> {
  const rows = await fetchTenantTokenMonthly(tenantId, 1);
  const totalTokens = rows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const totalCostUsd = rows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const byVendor = new Map<string, number>();
  const byAsset = new Map<string, number>();
  for (const r of rows) {
    byVendor.set(r.vendor, (byVendor.get(r.vendor) ?? 0) + (r.total_cost_usd ?? 0));
    if (r.asset_id) byAsset.set(r.asset_id, (byAsset.get(r.asset_id) ?? 0) + (r.total_cost_usd ?? 0));
  }
  const topVendor = [...byVendor.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const topAsset = [...byAsset.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  return { totalTokens, totalCostUsd, topVendor, topAsset };
}
