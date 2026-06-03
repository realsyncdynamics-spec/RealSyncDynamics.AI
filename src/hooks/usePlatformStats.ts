/**
 * usePlatformStats — lädt nicht-personenbezogene Plattform-Aggregate für das
 * öffentliche Landing-Hero-Widget über die SECURITY-DEFINER-RPC
 * `public.platform_stats()` (siehe Migration 20260623000000).
 *
 * Quelle sind ausschließlich Aggregate aus dem öffentlichen Free-Scan-Funnel —
 * keine Tenant-Daten, keine PII. Ist Supabase nicht konfiguriert oder die RPC
 * nicht erreichbar, bleibt `data` null und der Aufrufer zeigt Fallback-Werte.
 */
import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export interface PlatformStats {
  domainsScanned: number;
  auditsTotal: number;
  openRisks: number;
  evidencePct: number;
  lastScanAt: string | null;
}

interface PlatformStatsState {
  data: PlatformStats | null;
  loading: boolean;
}

export function usePlatformStats(): PlatformStatsState {
  const [state, setState] = useState<PlatformStatsState>({
    data: null,
    loading: isSupabaseConfigured(),
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    (async () => {
      try {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('platform_stats').single();
        if (!active) return;
        if (error || !data) {
          setState({ data: null, loading: false });
          return;
        }
        const row = data as {
          domains_scanned: number;
          audits_total: number;
          open_risks: number;
          evidence_pct: number;
          last_scan_at: string | null;
        };
        setState({
          data: {
            domainsScanned: row.domains_scanned,
            auditsTotal: row.audits_total,
            openRisks: row.open_risks,
            evidencePct: row.evidence_pct,
            lastScanAt: row.last_scan_at,
          },
          loading: false,
        });
      } catch {
        if (active) setState({ data: null, loading: false });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return state;
}

/** Formatiert einen ISO-Zeitstempel als grobe relative Angabe (de-DE). */
export function relativeTimeDe(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}
