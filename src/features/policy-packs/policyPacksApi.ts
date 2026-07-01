// Client-Wrapper für Policy Packs.
//
// Schreibpfade (activate/deactivate) über die Edge-Function `policy-packs`.
// Katalog/Aktivierungen/Mappings liest das Frontend RLS-sicher direkt.

import { getSupabase } from '../../lib/supabase';
import type { MappingStatus, PackControlRef } from '../../lib/policy-packs/coverage';

export interface PolicyPack {
  id: string;
  name: string;
  description: string | null;
  industry: string;
  frameworks: string[];
  controls: PackControlRef[];
}

export type PacksError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'error'; message: string };

export type PacksResult<T> = { kind: 'ok'; data: T } | PacksError;

function mapError(error: unknown): PacksError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  return { kind: 'error', message };
}

export async function listCatalog(): Promise<PolicyPack[]> {
  const sb = getSupabase();
  const [{ data: packs, error: e1 }, { data: ctrls, error: e2 }] = await Promise.all([
    sb.from('policy_pack_catalog').select('id, name, description, industry, frameworks').order('name'),
    sb.from('policy_pack_controls').select('pack_id, framework, control_code'),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const byPack = new Map<string, PackControlRef[]>();
  for (const c of (ctrls ?? []) as Array<{ pack_id: string; framework: string; control_code: string }>) {
    const arr = byPack.get(c.pack_id) ?? [];
    arr.push({ framework: c.framework, control_code: c.control_code });
    byPack.set(c.pack_id, arr);
  }
  return ((packs ?? []) as Array<Omit<PolicyPack, 'controls'>>).map((p) => ({ ...p, controls: byPack.get(p.id) ?? [] }));
}

export async function listActivations(tenantId: string): Promise<Set<string>> {
  const sb = getSupabase();
  const { data, error } = await sb.from('policy_pack_activations').select('pack_id').eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as Array<{ pack_id: string }>).map((r) => r.pack_id));
}

/** Best-effort: Umsetzungsstatus je (framework, control_code) über alle Assets. */
export async function listTenantMappings(tenantId: string): Promise<MappingStatus[]> {
  const sb = getSupabase();
  try {
    const { data, error } = await sb
      .from('asset_control_mappings')
      .select('status, framework_controls!inner(framework, control_code), governance_assets!inner(tenant_id)')
      .eq('governance_assets.tenant_id', tenantId);
    if (error || !data) return [];
    type Row = { status: MappingStatus['status']; framework_controls: { framework: string; control_code: string } | { framework: string; control_code: string }[] | null };
    return (data as unknown as Row[])
      .map((r) => {
        const fc = Array.isArray(r.framework_controls) ? r.framework_controls[0] : r.framework_controls;
        return fc ? { framework: fc.framework, control_code: fc.control_code, status: r.status } : null;
      })
      .filter((x): x is MappingStatus => x !== null);
  } catch {
    return [];
  }
}

export async function setPackActive(args: { tenant_id: string; pack_id: string; active: boolean }): Promise<PacksResult<{ ok: true }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('policy-packs', { body: { op: args.active ? 'activate' : 'deactivate', tenant_id: args.tenant_id, pack_id: args.pack_id } });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { ok: true } };
}
