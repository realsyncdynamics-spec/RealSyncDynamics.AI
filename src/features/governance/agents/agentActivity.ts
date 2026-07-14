// Reine Helfer für die Anzeige autonomer Agent-Beobachtungen (agent_observations).
// Keine Netzwerk-/React-Abhängigkeit → in Vitest direkt testbar.

export type ObservationSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ObservationLike {
  severity: string;
  created_at: string;
}

export interface ObservationSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  /** Höchste vorkommende Schwere (oder null bei leerer Liste). */
  topSeverity: ObservationSeverity | null;
}

const SEVERITY_ORDER: ObservationSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

function normSeverity(s: string): ObservationSeverity {
  const v = s.toLowerCase();
  return (SEVERITY_ORDER as string[]).includes(v) ? (v as ObservationSeverity) : 'info';
}

/** Zählt Beobachtungen nach Schwere und ermittelt die höchste vorkommende Stufe. */
export function summarizeObservations(rows: ObservationLike[]): ObservationSummary {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of rows) counts[normSeverity(r.severity)] += 1;
  const topSeverity = SEVERITY_ORDER.find((s) => counts[s] > 0) ?? null;
  return { total: rows.length, ...counts, topSeverity };
}

/** Deutsche Relativzeit ("vor 5 min", "vor 3 h", "vor 2 Tagen"). */
export function relativeTimeDe(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffMin = Math.floor((now.getTime() - t) / 60_000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD} ${diffD === 1 ? 'Tag' : 'Tagen'}`;
}
