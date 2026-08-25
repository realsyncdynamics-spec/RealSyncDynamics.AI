import { getSupabase } from '../../lib/supabase';

/**
 * Client für die PDP-Freigabe-Gates (P1-4) und das Zugriffsmodell (P1-1).
 *
 * Gates entstehen, wenn der Policy Decision Point `require_approval`
 * entscheidet. Ohne diese Oberfläche wären sie nur per API erreichbar —
 * ein Freigabeprozess, den niemand bedienen kann, ist keiner
 * (CLAUDE.md §14).
 */

export type GateStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/** Redaktionsarme Zusammenfassung — die Edge Function legt hier bewusst
 *  keine Inhalte ab, nur Kanal, Verb, Ziel und Datenklasse. */
export interface GateRequestSummary {
  channel?: string;
  verb?: string;
  vendor?: string | null;
  model?: string | null;
  classification?: string | null;
}

export interface ApprovalGate {
  id: string;
  tenant_id: string;
  fingerprint: string;
  policy_id: string | null;
  approver_role: string;
  status: GateStatus;
  request_summary: GateRequestSummary;
  requested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_reason: string | null;
  expires_at: string;
  created_at: string;
}

export interface GatesListResult {
  ok: boolean;
  gates?: ApprovalGate[];
  error?: { code: string; message: string };
}

export interface GateResolveResult {
  ok: boolean;
  status?: GateStatus;
  resolved_at?: string;
  error?: { code: string; message: string };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-approvals', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } } as T;
  return data as T;
}

export const listGates = (tenant_id: string, status: GateStatus = 'pending') =>
  call<GatesListResult>({ op: 'gates_list', tenant_id, status });

export const approveGate = (gate_id: string, reason?: string) =>
  call<GateResolveResult>({ op: 'gate_approve', gate_id, reason });

export const rejectGate = (gate_id: string, reason: string) =>
  call<GateResolveResult>({ op: 'gate_reject', gate_id, reason });

/** Zähler für das Badge — direkter Lesezugriff über RLS. */
export async function countPendingGates(tenant_id: string): Promise<number> {
  const sb = getSupabase();
  const { count, error } = await sb
    .from('pdp_approval_gates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

// ─── Zugriffsmodell (P1-1), lesend über RLS ─────────────────────────────────

export interface OrgUnit {
  id: string;
  parent_id: string | null;
  name: string;
  kind: 'location' | 'department' | 'team' | 'unit';
  org_path: string;
}

export interface Principal {
  id: string;
  type: 'user' | 'service' | 'agent' | 'device';
  display_name: string;
  org_unit_id: string | null;
  status: 'active' | 'disabled';
}

export interface RoleBinding {
  id: string;
  principal_id: string;
  role: string;
  scope_type: 'tenant' | 'org_unit';
  org_unit_id: string | null;
}

export interface AccessModel {
  units: OrgUnit[];
  principals: Principal[];
  bindings: RoleBinding[];
  error?: string;
}

export async function loadAccessModel(tenant_id: string): Promise<AccessModel> {
  const sb = getSupabase();
  const [u, p, b] = await Promise.all([
    sb.from('org_units').select('id, parent_id, name, kind, org_path')
      .eq('tenant_id', tenant_id).order('org_path'),
    sb.from('principals').select('id, type, display_name, org_unit_id, status')
      .eq('tenant_id', tenant_id).order('display_name'),
    sb.from('role_bindings').select('id, principal_id, role, scope_type, org_unit_id')
      .eq('tenant_id', tenant_id),
  ]);
  const err = u.error?.message ?? p.error?.message ?? b.error?.message;
  return {
    units: (u.data ?? []) as OrgUnit[],
    principals: (p.data ?? []) as Principal[],
    bindings: (b.data ?? []) as RoleBinding[],
    ...(err ? { error: err } : {}),
  };
}
