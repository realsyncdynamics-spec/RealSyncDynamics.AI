/**
 * Direct Supabase reads of governance_* tables for the authenticated
 * tenant. RLS (added in `20260512200000_governance_tenant_read_rls`)
 * limits visibility to rows where the row's `tenant_id` is in the
 * caller's memberships set.
 *
 * Writes are NOT done here — they go through the Edge Functions
 * `governance-ingest` (events + evidence) and `governance-keys`
 * (ingest keys). Asset / policy CRUD UIs will follow in a separate
 * PR once we have a real customer signal for the shape.
 */
import { getSupabase } from '../../lib/supabase';
import type {
  GovernanceAssetType,
  GovernanceRiskLevel,
  GovernanceEventSource,
  GovernancePolicyAction,
  AiActClass,
  GovernanceAssetStatus,
  GovernancePolicyType,
  GovernanceEvidenceType,
  GovernanceFramework,
} from './types';

export interface DbGovernanceAsset {
  id: string;
  tenant_id: string;
  asset_type: GovernanceAssetType;
  name: string;
  description: string | null;
  owner_email: string | null;
  vendor: string | null;
  system_url: string | null;
  data_types: string[];
  risk_score: number;
  ai_act_class: AiActClass;
  status: GovernanceAssetStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DbGovernancePolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  policy_type: GovernancePolicyType;
  severity: GovernanceRiskLevel;
  action: GovernancePolicyAction;
  condition: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbGovernanceEvent {
  id: string;
  tenant_id: string;
  asset_id: string | null;
  policy_id: string | null;
  event_type: string;
  event_source: GovernanceEventSource;
  title: string;
  summary: string | null;
  risk_level: GovernanceRiskLevel;
  actor_email: string | null;
  vendor: string | null;
  model_name: string | null;
  data_types: string[];
  policy_action: GovernancePolicyAction | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface DbGovernanceEvidence {
  id: string;
  tenant_id: string;
  event_id: string | null;
  asset_id: string | null;
  evidence_type: GovernanceEvidenceType;
  title: string;
  storage_path: string | null;
  content_hash: string | null;
  previous_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbFrameworkControl {
  id: string;
  framework: GovernanceFramework;
  control_code: string;
  title: string;
  description: string | null;
}

export async function fetchTenantEvents(tenantId: string, limit = 50): Promise<DbGovernanceEvent[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernanceEvent[];
}

export async function fetchTenantAssets(tenantId: string): Promise<DbGovernanceAsset[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernanceAsset[];
}

export async function fetchTenantPolicies(tenantId: string): Promise<DbGovernancePolicy[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_policies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernancePolicy[];
}

export async function fetchTenantEvidence(tenantId: string, limit = 50): Promise<DbGovernanceEvidence[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_evidence')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernanceEvidence[];
}

export interface DbAssetControlMapping {
  id: string;
  asset_id: string;
  control_id: string;
  status: 'not_started' | 'in_progress' | 'implemented' | 'gap' | 'not_applicable';
  evidence_id: string | null;
  notes: string | null;
  updated_at: string;
}

export async function fetchEventById(eventId: string): Promise<DbGovernanceEvent | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DbGovernanceEvent | null;
}

export async function fetchEvidenceForEvent(eventId: string): Promise<DbGovernanceEvidence[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_evidence')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernanceEvidence[];
}

export async function fetchEventsForAsset(assetId: string, limit = 100): Promise<DbGovernanceEvent[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_events')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbGovernanceEvent[];
}

export async function fetchMappingsForAsset(assetId: string): Promise<DbAssetControlMapping[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('asset_control_mappings')
    .select('*')
    .eq('asset_id', assetId);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbAssetControlMapping[];
}

export async function fetchAssetById(assetId: string): Promise<DbGovernanceAsset | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_assets')
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DbGovernanceAsset | null;
}

export async function fetchPolicyById(policyId: string): Promise<DbGovernancePolicy | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_policies')
    .select('*')
    .eq('id', policyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DbGovernancePolicy | null;
}

export async function fetchTenantMappings(tenantId: string): Promise<DbAssetControlMapping[]> {
  const sb = getSupabase();
  // RLS scopes via asset → tenant. We additionally filter via asset_id
  // join (Supabase doesn't let us simply eq('tenant_id', …) here since
  // the column lives on the parent asset).
  const { data: assets, error: aErr } = await sb
    .from('governance_assets')
    .select('id')
    .eq('tenant_id', tenantId);
  if (aErr) throw new Error(aErr.message);
  const ids = (assets ?? []).map((a) => a.id);
  if (ids.length === 0) return [];
  const { data, error } = await sb
    .from('asset_control_mappings')
    .select('*')
    .in('asset_id', ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbAssetControlMapping[];
}

export interface DbAssetRiskHistory {
  id: string;
  asset_id: string;
  tenant_id: string | null;
  risk_score: number;
  previous_score: number | null;
  score_delta: number | null;
  reason: string | null;
  contributing_events: string[];
  calculated_at: string;
}

export async function fetchAssetRiskHistory(assetId: string, limit = 30): Promise<DbAssetRiskHistory[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('asset_risk_history')
    .select('*')
    .eq('asset_id', assetId)
    .order('calculated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DbAssetRiskHistory[];
}

export interface RiskScoreResult {
  ok: boolean;
  score?: number;
  previous?: number;
  delta?: number;
  reason?: string;
  error?: { code: string; message: string };
}

export async function recalculateRiskScore(assetId: string): Promise<RiskScoreResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-risk-score', {
    body: { asset_id: assetId },
  });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as RiskScoreResult;
}

export async function fetchFrameworkControls(): Promise<DbFrameworkControl[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('framework_controls')
    .select('id, framework, control_code, title, description')
    .order('framework', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DbFrameworkControl[];
}
