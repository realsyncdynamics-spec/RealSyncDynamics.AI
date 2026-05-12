import { getSupabase } from '../../lib/supabase';
import type {
  GovernanceAssetType, AiActClass,
  GovernancePolicyType, GovernancePolicyAction, GovernanceRiskLevel,
} from './types';
import type { DbGovernanceAsset, DbGovernancePolicy } from './governanceApi';

export interface CreateAssetInput {
  tenant_id: string;
  asset_type: GovernanceAssetType;
  name: string;
  description?: string;
  owner_email?: string;
  vendor?: string;
  system_url?: string;
  data_types?: string[];
  risk_score?: number;
  ai_act_class?: AiActClass;
  metadata?: Record<string, unknown>;
}

export interface CreatePolicyInput {
  tenant_id: string;
  name: string;
  description?: string;
  policy_type: GovernancePolicyType;
  severity?: GovernanceRiskLevel;
  action?: GovernancePolicyAction;
  condition?: Record<string, unknown>;
  enabled?: boolean;
}

export interface AssetResult {
  ok: boolean;
  asset?: DbGovernanceAsset;
  error?: { code: string; message: string };
}
export interface PolicyResult {
  ok: boolean;
  policy?: DbGovernancePolicy;
  error?: { code: string; message: string };
}
export interface BareResult {
  ok: boolean;
  enabled?: boolean;
  already_archived?: boolean;
  error?: { code: string; message: string };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-resources', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const createAsset  = (input: CreateAssetInput)  => call<AssetResult>({ op: 'create_asset', ...input });
export const archiveAsset = (asset_id: string)         => call<BareResult>({ op: 'archive_asset', asset_id });
export const createPolicy = (input: CreatePolicyInput) => call<PolicyResult>({ op: 'create_policy', ...input });
export const togglePolicy = (policy_id: string, enabled: boolean) =>
  call<BareResult>({ op: 'toggle_policy', policy_id, enabled });
