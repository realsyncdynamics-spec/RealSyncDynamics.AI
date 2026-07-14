import { getSupabase } from '../../lib/supabase';
import type { ModelUsageRow, ModelConfig, RoutingPolicy } from './types';

export async function fetchModelUsage(tenantId: string, months = 3): Promise<ModelUsageRow[]> {
  const sb = getSupabase();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const { data, error } = await sb
    .from('ai_tool_runs_by_model')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('month', cutoff.toISOString())
    .order('month', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ModelUsageRow[];
}

export async function fetchModelConfigs(): Promise<ModelConfig[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_model_configs')
    .select('*')
    .eq('enabled', true)
    .order('provider')
    .order('model_id');
  if (error) throw new Error(error.message);
  return (data ?? []) as ModelConfig[];
}

export async function fetchRoutingPolicies(tenantId: string): Promise<RoutingPolicy[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ai_routing_policies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('priority');
  if (error) throw new Error(error.message);
  return (data ?? []) as RoutingPolicy[];
}

export async function saveRoutingPolicy(
  policy: Omit<RoutingPolicy, 'id'> & { id?: string },
): Promise<RoutingPolicy> {
  const sb = getSupabase();
  if (policy.id) {
    const { data, error } = await sb
      .from('ai_routing_policies')
      .update({ ...policy, updated_at: new Date().toISOString() })
      .eq('id', policy.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as RoutingPolicy;
  }
  const { data, error } = await sb
    .from('ai_routing_policies')
    .insert(policy)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RoutingPolicy;
}

export async function deleteRoutingPolicy(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('ai_routing_policies').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
