// Deadline-Sentinel — reine, deterministische Fristen-Bewertung (kein LLM).
//
// Erkennt überfällige und fristnahe Governance-Pflichten (Incidents mit
// 72-h-Meldefrist, DSFA-Reviews, Betroffenenanfragen) und liefert stabile
// Funde mit dedupeKey. Keine externen Imports → in Deno (Edge-Function) und
// in Vitest gleichermassen ausführbar.

export type SentinelStage = 'overdue' | 'due_soon';
export type SentinelSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type SentinelSubject = 'incident' | 'dpia' | 'dsr';

export interface SentinelFinding {
  subjectType: SentinelSubject;
  subjectId: string;
  title: string;
  detail: string;
  severity: SentinelSeverity;
  stage: SentinelStage;
  deadline: string | null;
  hoursRemaining: number | null; // < 0 = überfällig
  dedupeKey: string; // `${subjectType}:${subjectId}:${stage}` — stabil pro Stage
}

// Strukturelle Teilmengen der Db-Typen — DbIncident[]/DbDpia[]/DbDsrRequest[]
// können direkt übergeben werden.
export interface IncidentRow {
  id: string;
  title: string | null;
  severity: string;
  status: string;
  notification_deadline_at: string | null;
}
export interface DpiaRow {
  id: string;
  title: string | null;
  status: string;
  review_due_at: string | null;
}
export interface DsrRow {
  id: string;
  request_type: string;
  status: string;
  deadline_at: string | null;
  completed_at: string | null;
}

export interface SentinelInput {
  incidents?: IncidentRow[];
  dpias?: DpiaRow[];
  dsrs?: DsrRow[];
  now?: Date;
  incidentDueSoonHours?: number; // Default 72 (GDPR-Meldefrist)
  dpiaDueSoonDays?: number; // Default 30
  dsrDueSoonHours?: number; // Default 72
}

const INCIDENT_CLOSED = new Set(['resolved', 'reported_to_authority']);
const DPIA_OPEN = new Set(['draft', 'in_review']);
const DSR_CLOSED = new Set(['completed']);

function hoursUntil(deadline: string | null, now: Date): number | null {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / 3_600_000;
}

function fristText(hours: number | null): string {
  if (hours === null) return 'ohne Frist';
  if (hours < 0) return `${Math.ceil(-hours)} h überfällig`;
  if (hours < 48) return `noch ${Math.floor(hours)} h`;
  return `noch ${Math.floor(hours / 24)} Tage`;
}

function makeFinding(
  subjectType: SentinelSubject,
  subjectId: string,
  title: string,
  detailPrefix: string,
  severity: SentinelSeverity,
  stage: SentinelStage,
  deadline: string | null,
  hours: number | null,
): SentinelFinding {
  return {
    subjectType,
    subjectId,
    title,
    detail: `${detailPrefix}: ${fristText(hours)}`,
    severity,
    stage,
    deadline,
    hoursRemaining: hours,
    dedupeKey: `${subjectType}:${subjectId}:${stage}`,
  };
}

/**
 * Bewertet offene Pflichten und liefert Funde für überfällige bzw. fristnahe
 * Posten. Fristferne oder abgeschlossene Posten erzeugen keinen Fund.
 */
export function evaluateDeadlines(input: SentinelInput): SentinelFinding[] {
  const now = input.now ?? new Date();
  const incidentWindow = input.incidentDueSoonHours ?? 72;
  const dpiaWindowH = (input.dpiaDueSoonDays ?? 30) * 24;
  const dsrWindow = input.dsrDueSoonHours ?? 72;
  const findings: SentinelFinding[] = [];

  for (const inc of input.incidents ?? []) {
    if (INCIDENT_CLOSED.has(inc.status)) continue;
    const hours = hoursUntil(inc.notification_deadline_at, now);
    if (hours === null) continue;
    const title = inc.title || 'Vorfall';
    if (hours < 0) {
      findings.push(makeFinding('incident', inc.id, title, 'Meldefrist (72 h)', 'critical', 'overdue', inc.notification_deadline_at, hours));
    } else if (hours <= incidentWindow) {
      const severity: SentinelSeverity = hours <= 24 ? 'high' : 'medium';
      findings.push(makeFinding('incident', inc.id, title, 'Meldefrist (72 h)', severity, 'due_soon', inc.notification_deadline_at, hours));
    }
  }

  for (const dpia of input.dpias ?? []) {
    if (!DPIA_OPEN.has(dpia.status)) continue;
    const hours = hoursUntil(dpia.review_due_at, now);
    if (hours === null) continue;
    const title = dpia.title || 'Datenschutz-Folgenabschätzung';
    if (hours < 0) {
      findings.push(makeFinding('dpia', dpia.id, title, 'DSFA-Review', 'high', 'overdue', dpia.review_due_at, hours));
    } else if (hours <= dpiaWindowH) {
      findings.push(makeFinding('dpia', dpia.id, title, 'DSFA-Review', 'medium', 'due_soon', dpia.review_due_at, hours));
    }
  }

  for (const dsr of input.dsrs ?? []) {
    if (dsr.completed_at || DSR_CLOSED.has(dsr.status)) continue;
    const hours = hoursUntil(dsr.deadline_at, now);
    if (hours === null) continue;
    const title = `Betroffenenanfrage (${dsr.request_type})`;
    if (hours < 0) {
      findings.push(makeFinding('dsr', dsr.id, title, 'Antwortfrist', 'high', 'overdue', dsr.deadline_at, hours));
    } else if (hours <= dsrWindow) {
      findings.push(makeFinding('dsr', dsr.id, title, 'Antwortfrist', 'medium', 'due_soon', dsr.deadline_at, hours));
    }
  }

  return findings;
}

/** Schweregrade, die zusätzlich als governance_alerts sichtbar gemacht werden. */
export function isAlertWorthy(severity: SentinelSeverity): boolean {
  return severity === 'high' || severity === 'critical';
}
