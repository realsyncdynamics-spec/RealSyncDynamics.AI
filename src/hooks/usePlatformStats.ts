/**
 * usePlatformStats — lädt nicht-personenbezogene Plattform-Aggregate für das
 * öffentliche Landing-Hero-Widget über die Edge Function
 * `public-platform-stats` (Ersatz für das anonyme RPC public.platform_stats,
 * das mit P0-1 entzogen wird). Dieselben nicht-personenbezogenen Aggregate
 * wie Migration 20260623000000.
 *
 * Quelle sind ausschließlich Aggregate aus dem öffentlichen Free-Scan-Funnel —
 * keine Tenant-Daten, keine PII. Ist Supabase nicht konfiguriert oder der
 * Endpunkt nicht erreichbar, bleibt `data` null und der Aufrufer zeigt Fallback-Werte.
 */
import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { getSupabaseUrl, getSupabaseAnonKey } from '../lib/supabaseUrl';

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
        const resp = await fetch(`${getSupabaseUrl()}/functions/v1/public-platform-stats`, {
          headers: {
            apikey: getSupabaseAnonKey(),
            Authorization: `Bearer ${getSupabaseAnonKey()}`,
          },
        });
        if (!active) return;
        if (!resp.ok) {
          setState({ data: null, loading: false });
          return;
        }
        const payload = await resp.json() as {
          ok?: boolean;
          domains_scanned?: number;
          audits_total?: number;
          open_risks?: number;
          evidence_pct?: number;
          last_scan_at?: string | null;
        };
        if (!payload?.ok) {
          setState({ data: null, loading: false });
          return;
        }
        const row = {
          domains_scanned: payload.domains_scanned,
          audits_total: payload.audits_total,
          open_risks: payload.open_risks,
          evidence_pct: payload.evidence_pct,
          last_scan_at: payload.last_scan_at ?? null,
        };
        setState({
          data: {
            domainsScanned: Number(row.domains_scanned ?? 0),
            auditsTotal: Number(row.audits_total ?? 0),
            openRisks: Number(row.open_risks ?? 0),
            evidencePct: Number(row.evidence_pct ?? 0),
            lastScanAt: row.last_scan_at ?? null,
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
