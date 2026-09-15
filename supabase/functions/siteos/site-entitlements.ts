// SiteOS plan gates — Create/Claim + Publish.
//
// Keys only (`siteos.builder`, `siteos.publish`, `limit.sites`). Never
// branch on plan id strings. SSoT: shared/pricing.ts → product_entitlements
// via tenant_entitlements().

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  EntitlementError,
  loadEntitlementsForTenant,
  requireFeature,
  requireQuota,
} from '../_shared/entitlements.ts';
import { jsonError } from '../_shared/gateway.ts';

/** Distinct SiteOS sites for a tenant (identity = slug, not version rows). */
export async function countDistinctSites(
  admin: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('siteos_blueprints')
    .select('slug')
    .eq('tenant_id', tenantId)
    .neq('status', 'archived');

  if (error) {
    throw new EntitlementError(error.message, 'INTERNAL');
  }

  const slugs = new Set<string>();
  for (const row of data ?? []) {
    const slug = (row as { slug?: string | null }).slug;
    if (typeof slug === 'string' && slug.length > 0) slugs.add(slug);
  }
  return slugs.size;
}

async function slugAlreadyExists(
  admin: SupabaseClient,
  tenantId: string,
  slug: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('siteos_blueprints')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', slug)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new EntitlementError(error.message, 'INTERNAL');
  }
  return data != null;
}

/**
 * Create/Claim gate: `siteos.builder` + `limit.sites` for new slugs.
 * Version bumps of an existing slug do not consume another site slot.
 */
export async function gateSiteCreate(
  admin: SupabaseClient,
  tenantId: string,
  slug?: string | null,
): Promise<Response | null> {
  try {
    const ent = await loadEntitlementsForTenant(admin, tenantId);
    requireFeature(ent, 'siteos.builder');

    if (slug && await slugAlreadyExists(admin, tenantId, slug)) {
      return null;
    }

    const current = await countDistinctSites(admin, tenantId);
    requireQuota(ent, 'limit.sites', current);
    return null;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(
        e.code === 'QUOTA_EXCEEDED' ? 402 : e.code === 'INTERNAL' ? 500 : 403,
        e.code,
        e.message,
      );
    }
    throw e;
  }
}

/** Publish-gate / publish-approve: requires `siteos.publish`. */
export async function gateSitePublish(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Response | null> {
  try {
    const ent = await loadEntitlementsForTenant(admin, tenantId);
    requireFeature(ent, 'siteos.publish');
    return null;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(
        e.code === 'INTERNAL' ? 500 : 403,
        e.code,
        e.message,
      );
    }
    throw e;
  }
}
