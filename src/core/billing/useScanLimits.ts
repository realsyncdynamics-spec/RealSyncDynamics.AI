import { useEffect, useState, useCallback } from 'react';
import { useEntitlements } from './useEntitlements';
import { useTenant } from '../access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export interface ScanLimitStatus {
  limit: number;
  used: number;
  remaining: number;
  resetDate: Date | null;
  isAtLimit: boolean;
  canScan: boolean;
}

/**
 * Hook that manages scan limits for free tier users.
 * Tracks monthly scan quota and prevents scans when limit is reached.
 * Returns null for paid tiers (unlimited scans).
 */
export function useScanLimits(): ScanLimitStatus | null {
  const { tier, getLimit } = useEntitlements();
  const { activeTenantId } = useTenant();
  const [status, setStatus] = useState<ScanLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScanStatus = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Only free tier has limits
    if (tier !== 'free_tier') {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sb = getSupabase();
      const limit = getLimit('website.scan_monthly_limit') || 3;

      // Count scans in current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data, error } = await sb
        .from('scans')
        .select('id', { count: 'exact' })
        .eq('tenant_id', activeTenantId)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (error) {
        console.error('Failed to fetch scan status:', error);
        setStatus(null);
        return;
      }

      const used = data?.length || 0;
      const remaining = Math.max(0, limit - used);

      setStatus({
        limit,
        used,
        remaining,
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        isAtLimit: remaining === 0,
        canScan: remaining > 0,
      });
    } catch (e) {
      console.error('Scan limit check failed:', e);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, tier, getLimit]);

  useEffect(() => {
    void fetchScanStatus();
  }, [fetchScanStatus]);

  return status;
}
