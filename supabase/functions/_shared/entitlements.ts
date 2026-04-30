// Server-side entitlement guard for edge functions.
//
// Usage:
//   const ent = await loadEntitlementsForTenant(supabaseAdmin, tenantId);
//   requireFeature(ent, 'api.access');
//
// Logic mirrors src/core/billing/entitlements.ts but is duplicated here so the
// Deno runtime doesn't have to reach into the Vite/React tree.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type PlanKey = 'free' | 'bronze' | 'silver' | 'gold' | 'enterprise_public';

export type FeatureKey =
  | 'asset.register' | 'asset.verify' | 'watermark.apply' | 'barcode.issue'
  | 'provenance.basic' | 'provenance.advanced' | 'c2pa.export'
  | 'team.members' | 'api.access' | 'bulk.jobs' | 'compliance.export'
  | 'org.governance' | 'sso.enabled' | 'public-sector.mode';

export interface Entitlements {
  planKey: PlanKey;
  isActive: boolean;
  features: Partial<Record<FeatureKey, boolean>>;
}

const PLAN_FEATURES: Record<PlanKey, FeatureKey[]> = {
  free: ['asset.verify'],
  bronze: ['asset.verify', 'asset.register', 'provenance.basic'],
  silver: ['asset.verify', 'asset.register', 'provenance.basic', 'watermark.apply', 'barcode.issue', 'c2pa.export', 'team.members'],
  gold: ['asset.verify', 'asset.register', 'provenance.basic', 'provenance.advanced', 'watermark.apply', 'barcode.issue', 'c2pa.export', 'team.members', 'api.access', 'bulk.jobs', 'compliance.export'],
  enterprise_public: ['asset.verify', 'asset.register', 'provenance.basic', 'provenance.advanced', 'watermark.apply', 'barcode.issue', 'c2pa.export', 'team.members', 'api.access', 'bulk.jobs', 'compliance.export', 'org.governance', 'sso.enabled', 'public-sector.mode'],
};

export class EntitlementError extends Error {
  code: 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL' = 'FORBIDDEN';
  constructor(message: string, code: EntitlementError['code'] = 'FORBIDDEN') {
    super(message); this.code = code;
  }
}

export async function loadEntitlementsForTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Entitlements> {
  const [tenantResp, subResp] = await Promise.all([
    admin.from('tenants').select('id,is_public_sector').eq('id', tenantId).maybeSingle(),
    admin.from('subscriptions').select('plan_key,status')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tenantResp.error) throw new EntitlementError(tenantResp.error.message, 'INTERNAL');
  if (!tenantResp.data) throw new EntitlementError('tenant not found', 'NOT_FOUND');

  const planKey = (subResp.data?.plan_key as PlanKey) ?? 'free';
  const status = subResp.data?.status as string | undefined;
  const isActive = planKey === 'free' || status === 'active' || status === 'trialing';

  const allowed = new Set<FeatureKey>(PLAN_FEATURES[planKey] ?? []);
  const isPublic = !!tenantResp.data.is_public_sector;

  const features: Partial<Record<FeatureKey, boolean>> = {};
  for (const f of allowed) {
    if (!isActive && f !== 'asset.verify') continue;
    if (f === 'public-sector.mode' && !isPublic && planKey !== 'enterprise_public') continue;
    features[f] = true;
  }
  return { planKey, isActive, features };
}

export function hasFeature(ent: Entitlements, feature: FeatureKey): boolean {
  if (!ent.isActive && feature !== 'asset.verify') return false;
  return !!ent.features[feature];
}

export function requireFeature(ent: Entitlements, feature: FeatureKey): void {
  if (!hasFeature(ent, feature)) {
    throw new EntitlementError(`feature ${feature} is not available on plan ${ent.planKey}`);
  }
}

/**
 * Convenience: load + require in one call. Returns the entitlements object
 * if the gate is open, throws EntitlementError otherwise.
 */
export async function gateFeature(
  admin: SupabaseClient,
  tenantId: string,
  feature: FeatureKey,
): Promise<Entitlements> {
  const ent = await loadEntitlementsForTenant(admin, tenantId);
  requireFeature(ent, feature);
  return ent;
}
