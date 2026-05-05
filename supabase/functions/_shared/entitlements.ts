// Server-side entitlement guard for edge functions.
//
// Backed by the products / entitlements / product_entitlements tables and the
// `public.tenant_entitlements(uuid)` SQL function added in migration 20260430200000.
//
// Usage:
//   const ent = await loadEntitlementsForTenant(supabaseAdmin, tenantId);
//   requireFeature(ent, 'api.access');
//   requireQuota(ent, 'limit.api_calls_monthly', currentApiCalls);

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type EntitlementKind = 'boolean' | 'limit';

export interface EntitlementValue {
  key: string;
  kind: EntitlementKind;
  /** -1 = unlimited / always-on; 0 = off / no quota; >0 = numeric limit. */
  value: number;
}

export interface Entitlements {
  /** Indexed view of the resolved values for fast lookup. */
  byKey: Record<string, EntitlementValue>;
}

export class EntitlementError extends Error {
  code: 'FORBIDDEN' | 'QUOTA_EXCEEDED' | 'NOT_FOUND' | 'INTERNAL' = 'FORBIDDEN';
  constructor(message: string, code: EntitlementError['code'] = 'FORBIDDEN') {
    super(message); this.code = code;
  }
}

export async function loadEntitlementsForTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Entitlements> {
  const { data, error } = await admin.rpc('tenant_entitlements', { p_tenant_id: tenantId });
  if (error) throw new EntitlementError(error.message, 'INTERNAL');

  const byKey: Record<string, EntitlementValue> = {};
  for (const row of (data ?? []) as EntitlementValue[]) {
    byKey[row.key] = { key: row.key, kind: row.kind, value: row.value };
  }
  return { byKey };
}

/** Boolean check. Treats value=1 or value=-1 (unlimited) as enabled. */
export function hasFeature(ent: Entitlements, key: string): boolean {
  const v = ent.byKey[key];
  if (!v) return false;
  return v.value === -1 || v.value > 0;
}

/** Throws FORBIDDEN if the boolean feature is off. */
export function requireFeature(ent: Entitlements, key: string): void {
  if (!hasFeature(ent, key)) {
    throw new EntitlementError(`feature ${key} is not available on this plan`);
  }
}

/**
 * Numeric quota check. `current` is the caller's already-consumed count.
 * Returns the limit (or null for unlimited). Throws QUOTA_EXCEEDED if `current`
 * meets or exceeds the limit.
 */
export function requireQuota(ent: Entitlements, key: string, current: number): number | null {
  const v = ent.byKey[key];
  if (!v) {
    throw new EntitlementError(`quota ${key} is not part of this plan`);
  }
  if (v.value === -1) return null; // unlimited
  if (current >= v.value) {
    throw new EntitlementError(
      `quota ${key} exceeded (${current} / ${v.value})`,
      'QUOTA_EXCEEDED',
    );
  }
  return v.value;
}

/** Convenience: load + boolean require in one call. */
export async function gateFeature(
  admin: SupabaseClient,
  tenantId: string,
  key: string,
): Promise<Entitlements> {
  const ent = await loadEntitlementsForTenant(admin, tenantId);
  requireFeature(ent, key);
  return ent;
}
