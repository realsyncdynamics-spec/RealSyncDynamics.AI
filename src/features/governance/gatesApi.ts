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

// ─── Pflege des Zugriffsmodells (P1-3) ──────────────────────────────────────
//
// Läuft über die Edge Function `governance-access`, nicht direkt über RLS:
// Wer welche Rolle hält, ist die Autorisierungsgrundlage der Plattform —
// jede Änderung gehört in den Prüfpfad (governance_admin_log).

export interface AccessMutationResult {
  ok: boolean;
  unit?: OrgUnit;
  principal?: Principal;
  binding?: RoleBinding;
  error?: { code: string; message: string };
}

async function accessCall(body: Record<string, unknown>): Promise<AccessMutationResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-access', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as AccessMutationResult;
}

export const createUnit = (
  tenant_id: string, name: string, kind: OrgUnit['kind'], parent_id?: string | null,
) => accessCall({ op: 'unit_create', tenant_id, name, kind, parent_id: parent_id ?? null });

export const renameUnit = (unit_id: string, name: string) =>
  accessCall({ op: 'unit_rename', unit_id, name });

export const deleteUnit = (unit_id: string) =>
  accessCall({ op: 'unit_delete', unit_id });

export const createPrincipal = (
  tenant_id: string, type: Principal['type'], display_name: string,
  opts: { org_unit_id?: string | null; external_ref?: string | null } = {},
) => accessCall({ op: 'principal_create', tenant_id, type, display_name, ...opts });

export const updatePrincipal = (
  principal_id: string,
  patch: { display_name?: string; org_unit_id?: string | null; status?: Principal['status'] },
) => accessCall({ op: 'principal_update', principal_id, ...patch });

export const grantRole = (
  principal_id: string, role: string,
  scope_type: RoleBinding['scope_type'] = 'tenant', org_unit_id?: string | null,
) => accessCall({ op: 'role_grant', principal_id, role, scope_type, org_unit_id: org_unit_id ?? null });

export const revokeRole = (binding_id: string) =>
  accessCall({ op: 'role_revoke', binding_id });

/** Die Governance-Rollen, die über role_bindings vergeben werden können. */
export const GOVERNANCE_ROLES = [
  'dpo', 'it_admin', 'compliance_officer', 'approver', 'employee',
] as const;

export const ROLE_LABEL: Record<string, string> = {
  owner: 'Eigentümer',
  admin: 'Administrator',
  member: 'Mitglied',
  viewer: 'Betrachter',
  dpo: 'Datenschutzbeauftragte:r',
  it_admin: 'IT-Administration',
  compliance_officer: 'Compliance',
  approver: 'Freigeber:in',
  employee: 'Mitarbeitende:r',
};

/** Rollen der angemeldeten Person in diesem Tenant — Grundlage der Startseite. */
export async function myGovernanceRoles(tenant_id: string): Promise<string[]> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data: principal } = await sb
    .from('principals')
    .select('id, status')
    .eq('tenant_id', tenant_id)
    .eq('user_id', uid)
    .maybeSingle();
  if (!principal || principal.status !== 'active') return [];
  const { data: bindings } = await sb
    .from('role_bindings')
    .select('role')
    .eq('tenant_id', tenant_id)
    .eq('principal_id', principal.id);
  return [...new Set((bindings ?? []).map((b) => b.role as string))];
}
