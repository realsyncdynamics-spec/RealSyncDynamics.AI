// Frontend wrapper around the `governance-analytics-export` Edge Function.
//
// Die Function liefert die Datei (CSV/PDF) direkt im Response-Body mit
// Content-Disposition zurück (kein JSON). Wir normalisieren das Ergebnis zu
// einem Blob und lösen den Download clientseitig aus.

import { getSupabase } from '../../../lib/supabase';

export type ExportFormat = 'csv' | 'pdf';

export interface DateRange {
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
}

/** ISO-Datum (yyyy-mm-dd) für „vor n Tagen". */
export function isoDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Standard-Zeitraum: letzte 90 Tage bis heute. */
export function defaultRange(): DateRange {
  return { start: isoDaysAgo(90), end: isoDaysAgo(0) };
}

/** Sicherer Dateiname für einen Export. */
export function buildExportFilename(prefix: string, format: ExportFormat, range: DateRange): string {
  const safe = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe}_${range.start}_${range.end}.${format}`;
}

/** Löst einen Download für einen Blob aus. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Ruft `governance-analytics-export` (user JWT) auf und liefert die Datei als
 * Blob. supabase-js parst CSV als Text und PDF als Blob — wir normalisieren
 * beides zu einem Blob mit passendem MIME-Type.
 */
export async function exportAnalytics(input: {
  tenantId: string;
  format: ExportFormat;
  range: DateRange;
  includeCharts?: boolean;
}): Promise<{ ok: boolean; error?: string; blob?: Blob }> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-analytics-export', {
    body: {
      format: input.format,
      tenant_id: input.tenantId,
      date_range: input.range,
      include_charts: input.includeCharts ?? false,
    },
  });
  if (error) return { ok: false, error: error.message };

  const mime = input.format === 'csv' ? 'text/csv' : 'application/pdf';
  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else if (typeof data === 'string') {
    blob = new Blob([data], { type: mime });
  } else if (data instanceof ArrayBuffer) {
    blob = new Blob([data], { type: mime });
  } else {
    // Fallback: JSON-Objekt → als Text serialisieren
    blob = new Blob([JSON.stringify(data)], { type: mime });
  }
  return { ok: true, blob };
}
