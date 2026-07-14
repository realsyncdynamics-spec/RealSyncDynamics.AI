/**
 * Tenant Profile Service — Syncs company profile to tenant record
 *
 * Transfers data from localStorage (Phase 0 client-only storage) to
 * the tenants table in Supabase when onboarding completes or tenant updates.
 */

import { getSupabase } from '../../lib/supabase';
import { loadCompanyProfile } from './companyProfileLocal';

export async function syncTenantProfile(tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = loadCompanyProfile(tenantId);
    const sb = getSupabase();

    // Update only non-null fields to avoid clearing other tenant data
    const updates: Record<string, unknown> = {};
    if (profile.industry) {
      updates.industry = profile.industry;
    }
    if (profile.companySize) {
      updates.company_size = profile.companySize;
    }

    if (Object.keys(updates).length === 0) {
      return { success: true }; // Nothing to sync
    }

    const { error } = await sb
      .from('tenants')
      .update(updates)
      .eq('id', tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
