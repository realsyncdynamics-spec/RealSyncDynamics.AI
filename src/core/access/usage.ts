// Client-side usage helpers + hook.
//
// Conventions:
//   - Counters are scoped to (tenant_id, entitlement_key, current month UTC).
//   - Read paths (`getUsage`, `useUsage`) hit the `usage_totals` table directly
//     under RLS — fast, no edge function round-trip.
//   - Write paths (`incrementUsage`) go through the `usage-increment` edge
//     function so the hard-limit check + audit log run server-side.

import { useEffect, useState, useCallback } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from './TenantProvider';

const periodMonth = (d = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

export interface UsageReadResult {
  total: number;
  periodMonth: string;
  updatedAt: string | null;
}

export async function getUsage(tenantId: string, entitlementKey: string): Promise<UsageReadResult> {
  const sb = getSupabase();
  const period = periodMonth();
  const { data, error } = await sb
    .from('usage_totals')
    .select('total,updated_at')
    .eq('tenant_id', tenantId)
    .eq('entitlement_key', entitlementKey)
    .eq('period_month', period)
    .maybeSingle();
  if (error) throw error;
  return {
    total: data?.total ?? 0,
    periodMonth: period,
    updatedAt: data?.updated_at ?? null,
  };
}

export interface IncrementResult {
  ok: boolean;
  total?: number;
  hardLimit?: number | null;
  softLimit?: number | null;
  billingMode?: 'included' | 'metered' | 'overage' | 'none';
  warning?: boolean;
  error?: { code: string; message: string; details?: unknown };
}

export async function incrementUsage(
  tenantId: string,
  entitlementKey: string,
  delta = 1,
  metadata: Record<string, unknown> = {},
): Promise<IncrementResult> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('usage-increment', {
    body: { tenant_id: tenantId, entitlement_key: entitlementKey, delta, metadata },
  });
  if (error) {
    return { ok: false, error: { code: 'NETWORK', message: error.message } };
  }
  // Edge function returns snake_case; normalize to camelCase here.
  return {
    ok: !!data?.ok,
    total: data?.total,
    hardLimit: data?.hard_limit ?? null,
    softLimit: data?.soft_limit ?? null,
    billingMode: data?.billing_mode,
    warning: !!data?.warning,
    error: data?.error,
  };
}

/**
 * React hook that reads (and refreshes) the current-month usage for a key
 * against the active tenant. Returns null while loading or if no tenant.
 */
export function useUsage(entitlementKey: string): {
  loading: boolean;
  total: number | null;
  limit: number | null;
  refresh: () => Promise<void>;
} {
  const { activeTenantId, getLimit } = useTenant();
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!activeTenantId) { setTotal(null); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await getUsage(activeTenantId, entitlementKey);
      setTotal(r.total);
    } catch {
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [activeTenantId, entitlementKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    loading,
    total,
    limit: getLimit(entitlementKey),
    refresh,
  };
}
