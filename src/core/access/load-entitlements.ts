// Client-side entitlement loader.
//
// Backed by the products / entitlements / product_entitlements tables and the
// `tenant_entitlements(uuid)` SQL function. Hardcoded plan→features tables are
// intentionally not consulted any more — the DB is the single source of truth.

import { getSupabase } from '../../lib/supabase';
import type { TenantRole } from '../billing/types';

export type EntitlementKind = 'boolean' | 'limit';

export interface EntitlementValue {
  key: string;
  kind: EntitlementKind;
  /** -1 = unlimited / always-on; 0 = off / no quota; >0 = numeric limit. */
  value: number;
}

export interface EntitlementSet {
  byKey: Record<string, EntitlementValue>;
}

export interface TenantSummary {
  tenantId: string;
  name: string;
  isPublicSector: boolean;
  role: TenantRole;
}

/** Returns all tenants the current user is a member of, with their role. */
export async function listMyTenants(): Promise<TenantSummary[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('memberships')
    .select('role,tenant:tenants(id,name,is_public_sector)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((row: any) => ({
      tenantId: row.tenant?.id,
      name: row.tenant?.name ?? '(unbenannt)',
      isPublicSector: !!row.tenant?.is_public_sector,
      role: row.role as TenantRole,
    }))
    .filter((t) => t.tenantId);
}

/** Resolves the active entitlement set for the given tenant via the DB function. */
export async function loadEntitlements(tenantId: string): Promise<EntitlementSet> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('tenant_entitlements', { p_tenant_id: tenantId });
  if (error) throw error;
  const byKey: Record<string, EntitlementValue> = {};
  for (const row of (data ?? []) as EntitlementValue[]) {
    byKey[row.key] = { key: row.key, kind: row.kind, value: row.value };
  }
  return { byKey };
}

/** Boolean check (value === -1 or > 0). */
export function hasFeature(ent: EntitlementSet | null, key: string): boolean {
  if (!ent) return false;
  const v = ent.byKey[key];
  if (!v) return false;
  return v.value === -1 || v.value > 0;
}

/** Returns the numeric limit for a key (-1 = unlimited, 0 = none, >0 = limit), or null if unknown. */
export function getLimit(ent: EntitlementSet | null, key: string): number | null {
  if (!ent) return null;
  return ent.byKey[key]?.value ?? null;
}
