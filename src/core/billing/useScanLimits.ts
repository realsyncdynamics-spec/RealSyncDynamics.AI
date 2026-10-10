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
  const { getLimit } = useEntitlements();
  const { activeTenantId } = useTenant();
  const [status, setStatus] = useState<ScanLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScanStatus = useCallback(async () => {
    if (!activeTenantId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Hier stand bis 2026-09-28 `if (tier !== 'free') return` — ein
    // Plan-Name-Vergleich vor der eigentlichen Pruefung. Er war seit dem
    // 2026-08-24 folgenlos, weil jeder Plan -1 traegt, haette unter
    // BASE + MODULE + SCALE aber jedem bezahlten Plan still ein unbegrenztes
    // Kontingent gegeben, egal was der Katalog sagt. Allein der Wert
    // entscheidet (Zielarchitektur §10, `check:plan-gates`).
    //
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
      // Exklusive Obergrenze am Ersten des Folgemonats — derselbe Zeitpunkt wie
      // `resetDate` unten. Vorher `.lte(letzter Tag 00:00)`: Scans vom letzten
      // Tag des Monats fielen aus der Zaehlung.
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const { data, error } = await sb
        .from('scans')
        .select('id', { count: 'exact' })
        .eq('tenant_id', activeTenantId)
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', nextMonthStart.toISOString());

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
  }, [activeTenantId, getLimit]);

  useEffect(() => {
    void fetchScanStatus();
  }, [fetchScanStatus]);

  return status;
}
