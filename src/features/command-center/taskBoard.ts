/**
 * M6 — Aufgaben-Kanban auf Basis von public.agent_tasks.
 * board_status ist neu (M6); ältere Zeilen ohne board_status werden aus status abgeleitet.
 */
export type BoardColumn = 'backlog' | 'planned' | 'in_progress' | 'awaiting_decision' | 'blocked' | 'in_review' | 'done';
export const COLUMNS: ReadonlyArray<{ key: BoardColumn; label: string }> = [
  { key: 'backlog', label: 'BACKLOG' },
  { key: 'planned', label: 'GEPLANT' },
  { key: 'in_progress', label: 'IN ARBEIT' },
  { key: 'awaiting_decision', label: 'WARTET AUF ENTSCHEIDUNG' },
  { key: 'blocked', label: 'BLOCKIERT' },
  { key: 'in_review', label: 'IN PRÜFUNG' },
  { key: 'done', label: 'ERLEDIGT' },
];
export const COLUMN_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<BoardColumn, string>;

export interface AgentTaskRow {
  id: string;
  agent: string;
  task: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'blocked' | 'done' | 'failed' | 'cancelled';
  board_status: BoardColumn | null;
  project: string | null;
  correlation_id: string | null;
  parent_task_id: string | null;
  depends_on: string[] | null;
  evidence: unknown[] | null;
  claimed_by: string | null;
  claim_expires_at: string | null;
  blocker_reason: string | null;
  created_at: string;
}

/** Spalte einer Aufgabe; failed/cancelled erscheinen nicht auf dem Board (null). */
export function columnOf(t: Pick<AgentTaskRow, 'board_status' | 'status'>): BoardColumn | null {
  if (t.board_status) return t.board_status;
  switch (t.status) {
    case 'open': return 'backlog';
    case 'in_progress': return 'in_progress';
    case 'blocked': return 'blocked';
    case 'done': return 'done';
    default: return null;
  }
}

export const PRIORITY_LABEL: Record<AgentTaskRow['priority'], string> = { low: 'niedrig', normal: 'normal', high: 'hoch', critical: 'kritisch' };

export function shortId(id: string): string { return `T-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`; }

export interface TaskFilter { query: string; agent: string; project: string; priority: string }
export const EMPTY_TASK_FILTER: TaskFilter = { query: '', agent: 'all', project: 'all', priority: 'all' };

export function filterTasks(rows: ReadonlyArray<AgentTaskRow>, f: TaskFilter): AgentTaskRow[] {
  const q = f.query.trim().toLowerCase();
  return rows.filter((t) =>
    (f.agent === 'all' || t.agent === f.agent) &&
    (f.project === 'all' || (f.project === '__unset__' ? !t.project : t.project === f.project)) &&
    (f.priority === 'all' || t.priority === f.priority) &&
    (!q || t.task.toLowerCase().includes(q) || shortId(t.id).toLowerCase().includes(q) || t.id.includes(q)));
}

export function groupByColumn(rows: ReadonlyArray<AgentTaskRow>): Record<BoardColumn, AgentTaskRow[]> {
  const g = Object.fromEntries(COLUMNS.map((c) => [c.key, [] as AgentTaskRow[]])) as Record<BoardColumn, AgentTaskRow[]>;
  for (const t of rows) { const c = columnOf(t); if (c) g[c].push(t); }
  return g;
}

/** Offene Abhängigkeiten (nicht ERLEDIGT oder unbekannt). */
export function openDependencies(t: AgentTaskRow, byId: ReadonlyMap<string, AgentTaskRow>): string[] {
  return (t.depends_on ?? []).filter((d) => { const x = byId.get(d); return !x || columnOf(x) !== 'done'; });
}

export function claimState(t: AgentTaskRow, now = Date.now()): 'free' | 'held' | 'expired' {
  if (!t.claimed_by) return 'free';
  return t.claim_expires_at && Date.parse(t.claim_expires_at) < now ? 'expired' : 'held';
}

/**
 * Clientseitige Vorprüfung (Server prüft verbindlich per Trigger): würde agent als Kind von parentId
 * eine zirkuläre Delegation erzeugen?
 */
export function wouldCreateDelegationCycle(agent: string, parentId: string, byId: ReadonlyMap<string, AgentTaskRow>): boolean {
  const seen = new Set<string>();
  let cur = byId.get(parentId); let depth = 1;
  while (cur && !seen.has(cur.id)) {
    if (depth > 1 && cur.agent === agent) return true;
    seen.add(cur.id);
    cur = cur.parent_task_id ? byId.get(cur.parent_task_id) : undefined; depth++;
  }
  return Boolean(cur); // Wiederholung in der Kette = Zyklus
}
