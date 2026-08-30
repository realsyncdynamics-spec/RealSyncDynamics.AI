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
 * Kontingentprüfung für Website-Scans.
 *
 * `null` bedeutet: kein Kontingent, unbegrenzt scannen.
 *
 * Seit der Entscheidung vom 2026-08-24 ist das der Normalfall — Scans sind
 * für jeden Plan kostenlos und unbegrenzt, weil der Scan der Einstieg in den
 * Trichter ist und nicht die verkaufte Ware. Verkauft wird die dauerhafte
 * Überwachung (`monitoring.*`), die mit dem ersten gebuchten Paket beginnt.
 *
 * Die Mechanik bleibt trotzdem stehen: Sie hängt allein am Wert von
 * `website.scan_monthly_limit`. Wird dort je wieder eine endliche Zahl
 * hinterlegt, greift die Zählung ohne Codeänderung.
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

    // Kontingente gab es nur im Free-Plan.
    if (tier !== 'free') {
      setStatus(null);
      setLoading(false);
      return;
    }

    // Unbegrenzt (`-1`) oder gar kein Wert → nicht zählen und nicht abfragen.
    //
    // Vorher stand hier `getLimit(...) || 3`. Dieser Rückfall hätte das
    // abgeschaffte Kontingent stillschweigend wieder eingeführt, sobald der
    // Wert fehlt — und `0` wäre ebenfalls zu `3` geworden. Ein Kontingent
    // gilt jetzt nur noch, wenn es ausdrücklich als positive Zahl hinterlegt
    // ist.
    const limit = getLimit('website.scan_monthly_limit');
    if (limit === null || limit < 0) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sb = getSupabase();

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
