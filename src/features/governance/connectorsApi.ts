import { getSupabase } from '../../lib/supabase';

export type ConnectorType = 'jira' | 'github' | 'linear' | 'servicenow' | 'slack' | 'teams';

export interface DbConnector {
  id: string;
  tenant_id: string | null;
  connector_type: ConnectorType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  trigger_on_risk_level: string[];
  trigger_on_policy_action: string[];
  created_at: string;
}

export interface DbRemediationAction {
  id: string;
  event_id: string | null;
  connector_id: string | null;
  action_type: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  external_id: string | null;
  external_url: string | null;
  error_message: string | null;
  executed_at: string | null;
  created_at: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-connectors', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createConnector = (input: Record<string, unknown>) =>
  call<{ ok: boolean; connector?: DbConnector; error?: { code: string; message: string } }>({ op: 'create', ...input });
export const updateConnector = (id: string, patch: Record<string, unknown>) =>
  call<{ ok: boolean; connector?: DbConnector; error?: { code: string; message: string } }>({ op: 'update', id, ...patch });
export const deleteConnector = (id: string) =>
  call<{ ok: boolean; error?: { code: string; message: string } }>({ op: 'delete', id });

export async function fetchTenantConnectors(tenantId: string): Promise<DbConnector[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('integration_connectors').select('*')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbConnector[];
}

export async function fetchTenantRemediations(tenantId: string, limit = 100): Promise<DbRemediationAction[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('remediation_actions').select('*')
    .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbRemediationAction[];
}
