// Monitoring-Kopfzeile — reine Ableitung aus echten Mandantenquellen (Gate 1).
// Ohne React/Supabase, damit sie ohne Umgebung testbar ist.
//
// Quelle der Wahrheit ist `monitoring_sources`: Der Scheduler
// (governance-monitoring-scheduler) setzt dort status, last_scan_at und
// next_scan_at. `scan_runs` kommt vom separaten Website-Audit (tenant-audit)
// und zählt nur beim „letzten Scan“ mit.

/** Schlanke Zeile aus `monitoring_sources`. */
export interface MonitoringSourceRow {
  status: 'pending' | 'active' | 'paused' | 'error' | string;
  last_scan_at: string | null;
  next_scan_at: string | null;
}

export type MonitoringStatus = 'active' | 'no_sources' | 'unknown';

export interface MonitoringHeader {
  status: MonitoringStatus;
  /** „aktiv/gesamt“ der Monitoring-Quellen. */
  sources: string;
  failingSources: string;
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

function latest(values: ReadonlyArray<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (best === null || new Date(v).getTime() > new Date(best).getTime())) best = v;
  }
  return best;
}

function earliest(values: ReadonlyArray<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (v && (best === null || new Date(v).getTime() < new Date(best).getTime())) best = v;
  }
  return best;
}

/**
 * Kopfzeile aus echten Quellen. `null` = Quelle nicht ladbar ⇒ „—“ (nie eine
 * Ersatzzahl). „AKTIV“ nur mit mindestens einer aktiven Monitoring-Quelle.
 */
export function buildMonitoringHeader(input: {
  sources: ReadonlyArray<MonitoringSourceRow> | null;
  openIncidents: number | null;
  /** Neuester Website-Audit-Lauf (scan_runs); `null` = nicht ladbar. */
  latestAuditRuns: ReadonlyArray<{ created_at: string }> | null;
  now?: number;
}): MonitoringHeader {
  const now = input.now ?? Date.now();
  const sources = input.sources;
  const active = sources?.filter((s) => s.status === 'active') ?? null;

  const status: MonitoringStatus = sources === null ? 'unknown' : active!.length > 0 ? 'active' : 'no_sources';

  let lastScan = '—';
  if (sources !== null && input.latestAuditRuns !== null) {
    const last = latest([...sources.map((s) => s.last_scan_at), input.latestAuditRuns[0]?.created_at]);
    lastScan = last ? relativeDe(last, now) : 'Noch kein Scan';
  }

  let nextScan = '—';
  if (active !== null) {
    const next = earliest(active.map((s) => s.next_scan_at));
    nextScan = active.length === 0 ? 'Keine aktive Quelle' : next ? clockDe(next, now) : 'Nicht geplant';
  }

  return {
    status,
    sources: sources === null ? '—' : `${active!.length}/${sources.length}`,
    failingSources: sources === null ? '—' : String(sources.filter((s) => s.status === 'error').length),
    openIncidents: input.openIncidents === null ? '—' : String(input.openIncidents),
    lastScan,
    nextScan,
  };
}
