/**
 * Auditor-Console API — thin typed wrappers around the RFC-004 RPCs
 * and views. Used by the read-only `/governance/auditor` surface.
 *
 * See docs/runbooks/governance-runtime-pilot-runbook.md §3.4 for the
 * scope of this console (4 panels: Tenant Quadrant, RACPO per Flow,
 * Hash-Chain Verify, DSR Export).
 */
import { getSupabase } from '../../lib/supabase';

export type Quadrant =
  | 'reserved_capacity'
  | 'investigate'
  | 'premium_review'
  | 'red_alert';

export interface TenantQuadrant {
  risk_score: number;
  spend_90d: number;
  median_spend: number;
  quadrant: Quadrant;
  computed_at: string;
}

export async function fetchTenantQuadrant(tenantId: string): Promise<TenantQuadrant> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('compute_tenant_quadrant', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('no quadrant row returned');
  return data[0] as TenantQuadrant;
}

export interface FeatureCost {
  flow_ref: string;
  cost_kind: string;
  units_30d: number;
  amount_usd_30d: number;
  distinct_traces_30d: number;
}

export async function fetchFlowList(tenantId: string): Promise<string[]> {
  const sb = getSupabase();
  // Distinct flow_refs from the per-feature view (RLS-isolated wrapper).
  const { data, error } = await sb
    .from('v_cost_per_feature')
    .select('flow_ref')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const seen = new Set<string>();
  for (const r of data ?? []) {
    if (r.flow_ref) seen.add(r.flow_ref as string);
  }
  return [...seen].sort();
}

export interface Racpo {
  raw_cost_per_completed: number | null;
  tenant_risk_score: number;
  incident_pressure: number;
  racpo: number | null;
  feature_hash: string;
  model_ref: string;
  computed_at: string;
}

export async function fetchRacpo(tenantId: string, flowRef: string): Promise<Racpo> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('compute_racpo', {
    p_tenant_id: tenantId,
    p_flow_ref:  flowRef,
  });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error('no racpo row returned');
  return data[0] as Racpo;
}

export interface ChainVerifyRow {
  tenant_seq: number;
  valid: boolean;
  expected_hash: string;
  actual_hash: string;
  chain_ok: boolean;
}

export interface ChainVerifyResult {
  total: number;
  invalid: number;
  chainBreaks: number;
  firstIssue: ChainVerifyRow | null;
}

export async function verifyHashChain(tenantId: string): Promise<ChainVerifyResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('runtime_events_verify_chain', {
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ChainVerifyRow[];
  const invalid = rows.filter((r) => !r.valid).length;
  const chainBreaks = rows.filter((r) => !r.chain_ok).length;
  const firstIssue = rows.find((r) => !r.valid || !r.chain_ok) ?? null;
  return { total: rows.length, invalid, chainBreaks, firstIssue };
}

export interface DsrExportRow {
  global_seq: number;
  tenant_seq: number;
  ts: string;
  type: string;
  severity: string;
  payload: Record<string, unknown>;
  evidence_refs: unknown[];
  prev_hash: string | null;
  event_hash: string;
}

export async function fetchSubjectExport(
  tenantId: string,
  subjectRef: string,
): Promise<DsrExportRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('incident_correlation_export', {
    p_tenant_id:   tenantId,
    p_subject_ref: subjectRef,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DsrExportRow[];
}

/**
 * Build a DSGVO-Art-20 export bundle from the raw event list. The
 * Ed25519 proof signature is NOT generated client-side — that step
 * runs in the dsr-export Edge Function. Here we only assemble the
 * payload and let the operator download the JSON for inspection.
 */
export function buildExportBundle(
  subjectRef: string,
  rows: DsrExportRow[],
): unknown {
  return {
    '@context':   'https://schema.realsync.eu/v1/subject-export.jsonld',
    '@type':      'SubjectDataExport',
    subject_ref:  subjectRef,
    exported_at:  new Date().toISOString(),
    events:       rows,
    proof: {
      chain_algorithm: 'sha256',
      verifier_signature: null, // populated server-side by dsr-export
    },
  };
}
