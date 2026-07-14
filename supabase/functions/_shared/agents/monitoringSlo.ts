// Monitoring-SLO-Agent — reine Logik (Meta-Monitoring der monitoring_sources).
//
// Überschneidungsfrei zum governance-monitoring-scheduler (der die Scans
// AUSFÜHRT): dieser Agent prüft, ob die Überwachung selbst ihr SLO hält —
// laufen aktive Quellen im Frequenzfenster und sind sie fehlerfrei? Verletzungen
// (überfällige oder fehlerhafte Quellen) werden als Funde gemeldet.
// Keine Netzwerk-/Deno-Abhängigkeit → in Vitest direkt testbar.

export type SloSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SloStage = 'error' | 'overdue';

export interface MonitoringSourceLike {
  id: string;
  name: string;
  status: string; // 'pending' | 'active' | 'paused' | 'error'
  next_scan_at: string | null;
  scan_frequency: string; // 'hourly' | 'daily' | 'weekly' | 'monthly'
  last_error: string | null;
}

export interface SloFinding {
  sourceId: string;
  title: string;
  detail: string;
  severity: SloSeverity;
  stage: SloStage;
  dedupeKey: string;
}

export interface SloInput {
  sources: MonitoringSourceLike[];
  now?: Date;
}

export interface SloResult {
  evaluated: number;
  findings: SloFinding[];
}

const FREQ_HOURS: Record<string, number> = { hourly: 1, daily: 24, weekly: 168, monthly: 720 };

// Quellen, die laufen SOLLEN (paused/pending sind bewusst pausiert → kein SLO).
const UNDER_SLO = new Set(['active', 'error']);

function windowHours(freq: string): number {
  return FREQ_HOURS[freq] ?? 24;
}

function graceHours(freq: string): number {
  return Math.max(1, windowHours(freq) * 0.25);
}

export function isSloAlertWorthy(sev: SloSeverity): boolean {
  return sev === 'critical' || sev === 'high';
}

/** Bewertet das Monitoring-SLO je Quelle und liefert die Verletzungen. */
export function evaluateMonitoringSlos(input: SloInput): SloResult {
  const now = input.now ?? new Date();
  const findings: SloFinding[] = [];
  let evaluated = 0;

  for (const s of input.sources) {
    if (!UNDER_SLO.has(s.status)) continue;
    evaluated += 1;

    if (s.status === 'error') {
      findings.push({
        sourceId: s.id,
        title: `Überwachung fehlerhaft: ${s.name}`,
        detail: s.last_error ? `Letzter Fehler: ${s.last_error}` : 'Quelle im Fehlerzustand.',
        severity: 'high',
        stage: 'error',
        dedupeKey: `monitoring:${s.id}:error`,
      });
      continue;
    }

    // status === 'active': überfällig, wenn next_scan_at jenseits der Toleranz liegt.
    const due = s.next_scan_at ? new Date(s.next_scan_at).getTime() : NaN;
    if (Number.isNaN(due)) continue;
    const hoursOverdue = (now.getTime() - due) / 3_600_000;
    const grace = graceHours(s.scan_frequency);
    if (hoursOverdue <= grace) continue;

    const window = windowHours(s.scan_frequency);
    const severity: SloSeverity = hoursOverdue > 2 * window ? 'high' : 'medium';
    findings.push({
      sourceId: s.id,
      title: `Scan überfällig: ${s.name}`,
      detail: `Fälliger Scan (${s.scan_frequency}) ist ${Math.floor(hoursOverdue)} h überfällig.`,
      severity,
      stage: 'overdue',
      dedupeKey: `monitoring:${s.id}:overdue`,
    });
  }

  return { evaluated, findings };
}
