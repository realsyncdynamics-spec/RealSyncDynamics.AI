// Monitoring-Kopfzeile — reine Ableitung aus echten Mandantenquellen (Gate 1).
// Ohne React/Supabase, damit sie ohne Umgebung testbar ist.
import type { Summary24h } from '../dashboard/complianceStatus';

/** Scan-Läufe, die für „Scans (24 h)“ höchstens geladen werden. */
export const SCAN_WINDOW_LIMIT = 200;

export type MonitoringStatus = 'active' | 'no_sources' | 'unknown';

export interface MonitoringHeader {
  status: MonitoringStatus;
  assets: string;
  scans24h: string;
  openIncidents: string;
  lastScan: string;
  nextScan: string;
}

function relativeDe(iso: string, now: number): string {
  const diffMin = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffMin < 1440) return `vor ${Math.floor(diffMin / 60)} Std.`;
  const days = Math.floor(diffMin / 1440);
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`;
}

function clockDe(iso: string, now: number): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const sameDay = at.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })
    === new Date(now).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  return sameDay ? time : `${at.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })} ${time}`;
}

/**
 * Kopfzeile aus echten Quellen. `null` = Quelle nicht ladbar ⇒ „—“ (nie eine
 * Ersatzzahl). Status „aktiv“ nur mit aktiver Monitoring-Quelle laut
 * governance_24h_summary.
 */
export function buildMonitoringHeader(input: {
  assets: number | null;
  openIncidents: number | null;
  scanRuns: ReadonlyArray<{ created_at: string }> | null;
  summary: Summary24h | null;
  summaryFailed: boolean;
  now?: number;
}): MonitoringHeader {
  const now = input.now ?? Date.now();
  const runs = input.scanRuns;
  let scans24h = '—';
  if (runs) {
    const recent = runs.filter((r) => now - new Date(r.created_at).getTime() <= 86_400_000).length;
    scans24h = runs.length >= SCAN_WINDOW_LIMIT && recent === runs.length ? `${recent}+` : String(recent);
  }
  const status: MonitoringStatus = input.summaryFailed || input.summary === null
    ? 'unknown'
    : input.summary.active_sources > 0 ? 'active' : 'no_sources';
  return {
    status,
    assets: input.assets === null ? '—' : String(input.assets),
    scans24h,
    openIncidents: input.openIncidents === null ? '—' : String(input.openIncidents),
    lastScan: runs === null ? '—' : runs.length === 0 ? 'Noch kein Scan' : relativeDe(runs[0].created_at, now),
    nextScan: input.summaryFailed || input.summary === null
      ? '—'
      : input.summary.next_scan_at ? clockDe(input.summary.next_scan_at, now) : 'Nicht geplant',
  };
}
