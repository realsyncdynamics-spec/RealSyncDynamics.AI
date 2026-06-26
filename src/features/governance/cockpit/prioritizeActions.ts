// CEO-Cockpit — Priorisierung offener Pflichten (rein, testbar).
//
// Rangfolge = Schweregrad + Dringlichkeit (Fristnähe). Liefert die Top-N
// Handlungen in CEO-Sprache, inkl. Deep-Link in die bestehende Detail-View.
// Keine Netzwerk-Aufrufe — Eingaben werden vom Cockpit-View geladen.

export type ActionLevel = 'critical' | 'high' | 'medium' | 'low';
export type ActionKind = 'incident' | 'dsr' | 'dpia';

export interface PriorityAction {
  id: string;
  kind: ActionKind;
  title: string;
  detail: string;
  level: ActionLevel;
  deadline: string | null; // ISO
  hoursRemaining: number | null; // < 0 = überfällig
  href: string;
  weight: number;
}

// Strukturelle Teilmengen der Db-Typen — DbIncident[]/DbDsrRequest[]/DbDpia[]
// können direkt übergeben werden.
export interface IncidentInput {
  id: string;
  title: string;
  severity: string;
  status: string;
  notification_deadline_at: string | null;
}
export interface DsrInput {
  id: string;
  request_type: string;
  status: string;
  deadline_at: string | null;
  completed_at: string | null;
}
export interface DpiaInput {
  id: string;
  title: string;
  status: string;
  review_due_at: string | null;
}

export interface PrioritizeInput {
  incidents?: IncidentInput[];
  dsrs?: DsrInput[];
  dpias?: DpiaInput[];
  now?: Date;
}

const SEVERITY_WEIGHT: Record<ActionLevel, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 20,
};

const INCIDENT_CLOSED = new Set(['resolved', 'reported_to_authority']);

function hoursUntil(deadline: string | null, now: Date): number | null {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now.getTime()) / 3_600_000;
}

// Dringlichkeits-Bonus aus Fristnähe.
function urgencyBonus(hours: number | null): number {
  if (hours === null) return 0;
  if (hours < 0) return 60; // überfällig
  if (hours < 24) return 40;
  if (hours < 72) return 20;
  return 0;
}

function severityToLevel(sev: string): ActionLevel {
  const s = sev.toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  return 'low';
}

function fristText(hours: number | null): string {
  if (hours === null) return 'ohne Frist';
  if (hours < 0) return `${Math.ceil(-hours)} h überfällig`;
  if (hours < 48) return `noch ${Math.floor(hours)} h`;
  return `noch ${Math.floor(hours / 24)} Tage`;
}

/**
 * Rangiert offene Incidents, DSRs und DPIA-Reviews und liefert die Top-N.
 * Sortierung: Gewicht absteigend, bei Gleichstand frühere Frist zuerst.
 */
export function prioritizeActions(input: PrioritizeInput, limit = 3): PriorityAction[] {
  const now = input.now ?? new Date();
  const actions: PriorityAction[] = [];

  for (const inc of input.incidents ?? []) {
    if (INCIDENT_CLOSED.has(inc.status)) continue;
    const hours = hoursUntil(inc.notification_deadline_at, now);
    const level = severityToLevel(inc.severity);
    actions.push({
      id: inc.id,
      kind: 'incident',
      title: inc.title || 'Vorfall',
      detail: `Meldefrist (72 h): ${fristText(hours)}`,
      level,
      deadline: inc.notification_deadline_at,
      hoursRemaining: hours,
      href: '/app/incidents',
      weight: SEVERITY_WEIGHT[level] + urgencyBonus(hours),
    });
  }

  for (const dsr of input.dsrs ?? []) {
    if (dsr.completed_at || dsr.status === 'completed') continue;
    const hours = hoursUntil(dsr.deadline_at, now);
    const overdue = hours !== null && hours < 0;
    const level: ActionLevel = overdue ? 'high' : 'medium';
    actions.push({
      id: dsr.id,
      kind: 'dsr',
      title: `Betroffenenanfrage (${dsr.request_type})`,
      detail: `Antwortfrist: ${fristText(hours)}`,
      level,
      deadline: dsr.deadline_at,
      hoursRemaining: hours,
      href: '/app/dsr',
      weight: SEVERITY_WEIGHT[level] + urgencyBonus(hours),
    });
  }

  for (const dpia of input.dpias ?? []) {
    if (dpia.status === 'approved') continue;
    const hours = hoursUntil(dpia.review_due_at, now);
    actions.push({
      id: dpia.id,
      kind: 'dpia',
      title: dpia.title || 'Datenschutz-Folgenabschätzung',
      detail: dpia.review_due_at ? `Review fällig: ${fristText(hours)}` : 'Review offen',
      level: 'medium',
      deadline: dpia.review_due_at,
      hoursRemaining: hours,
      href: '/app/dpia',
      weight: SEVERITY_WEIGHT.medium + urgencyBonus(hours),
    });
  }

  actions.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ha = a.hoursRemaining ?? Number.POSITIVE_INFINITY;
    const hb = b.hoursRemaining ?? Number.POSITIVE_INFINITY;
    return ha - hb;
  });

  return actions.slice(0, limit);
}
