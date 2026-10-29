/**
 * M2 Decision Inbox — Domänenlogik (rein & testbar).
 * Eine Frage ist nie eine Freigabe. Demo-Daten (is_demo) bleiben sichtbar markiert.
 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type QuestionStatus = 'open' | 'answered' | 'deferred' | 'withdrawn';

export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'P0 · Sicherheits-/Produktionsblocker',
  P1: 'P1 · Blockierende Entscheidung',
  P2: 'P2 · Normale Rückfrage',
  P3: 'P3 · Optimierung',
};

export interface AgentQuestionRow {
  id: string;
  agent_ref: string;
  task_ref: string | null;
  milestone: string | null;
  project: string | null;
  question: string;
  context: string | null;
  priority: Priority;
  status: QuestionStatus;
  dedupe_key: string;
  is_demo: boolean;
  created_at: string;
}

export interface QuestionEventRow {
  question_id: string;
  event_type: 'created' | 'status_changed' | 'priority_changed';
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

/** Zusammengefasste Entscheidung: alle offenen Fragen mit gleichem dedupe_key. */
export interface QuestionGroup {
  dedupeKey: string;
  /** Höchste Priorität (P0 < P3) der Gruppe. */
  priority: Priority;
  /** Älteste Frage = Repräsentant. */
  primary: AgentQuestionRow;
  members: AgentQuestionRow[];
  agents: string[];
  isDemo: boolean;
}

const RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function groupOpenQuestions(rows: ReadonlyArray<AgentQuestionRow>): QuestionGroup[] {
  const map = new Map<string, AgentQuestionRow[]>();
  for (const r of rows) {
    if (r.status !== 'open') continue;
    // Demo und echte Daten nie in einer Gruppe zusammenführen.
    const key = `${r.is_demo ? 'demo' : 'live'}:${r.dedupe_key}`;
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  const groups: QuestionGroup[] = [];
  for (const [key, list] of map) {
    const members = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const priority = members.reduce<Priority>((p, m) => (RANK[m.priority] < RANK[p] ? m.priority : p), 'P3');
    groups.push({
      dedupeKey: key,
      priority,
      primary: members[0]!,
      members,
      agents: [...new Set(members.map((m) => m.agent_ref))],
      isDemo: members[0]!.is_demo,
    });
  }
  return groups.sort((a, b) =>
    RANK[a.priority] - RANK[b.priority] || a.primary.created_at.localeCompare(b.primary.created_at));
}

export const EVENT_LABEL: Record<QuestionEventRow['event_type'], string> = {
  created: 'Angelegt',
  status_changed: 'Status geändert',
  priority_changed: 'Priorität geändert',
};
