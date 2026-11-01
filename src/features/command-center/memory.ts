/**
 * M7 — Zweites Gedächtnis & Entscheidungsarchiv (lesend).
 * Quellen: search_agent_knowledge (agent_decisions/agent_questions/agent_memory, RLS),
 * agent_decision_archive_v, agent_routine_status_v. integration_memory ist Plattform-Gedächtnis
 * (nur service_role) und wird hier bewusst nicht angezeigt.
 */
export type KnowledgeKind = 'decision' | 'question' | 'memory';
export const KIND_LABEL: Record<KnowledgeKind, string> = { decision: 'Entscheidung', question: 'Frage', memory: 'Gedächtnis' };

export interface KnowledgeHit {
  kind: KnowledgeKind; id: string; title: string | null; snippet: string | null; status: string | null;
  agent: string | null; created_at: string; decision_id: string | null;
}

export interface RoutineStatusRow {
  source: 'routine' | 'scan_schedule'; id: string; key: string; label: string; agent_ref: string | null;
  schedule: string | null; enabled: boolean; expected_interval_minutes: number | null;
  last_run_at: string | null; last_status: 'success' | 'failure' | 'skipped' | null; last_error: string | null;
  last_summary: string | null; failures_7d: number | string | null; next_run_at: string | null;
}

export type RoutineHealth = 'ok' | 'failing' | 'overdue' | 'never' | 'disabled' | 'unknown';
export const HEALTH_LABEL: Record<RoutineHealth, string> = {
  ok: 'OK', failing: 'Fehlgeschlagen', overdue: 'Überfällig', never: 'Noch nie gelaufen', disabled: 'Deaktiviert', unknown: 'Ergebnis UNBEKANNT',
};

/** Nachweisbarer Zustand einer Routine — nur aus belegten Läufen abgeleitet. */
export function routineHealth(r: RoutineStatusRow, now = Date.now()): RoutineHealth {
  if (!r.enabled) return 'disabled';
  if (!r.last_run_at) return 'never';
  if (r.last_status === 'failure') return 'failing';
  if (r.expected_interval_minutes && now - Date.parse(r.last_run_at) > r.expected_interval_minutes * 60_000 * 1.5) return 'overdue';
  if (r.last_status === null) return 'unknown'; // z. B. scan_schedules: Laufzeit bekannt, Ergebnis nicht
  return 'ok';
}

/** Präzedenzfälle: andere (nicht dieselbe) Entscheidungen; ausdrücklich keine Freigabe. */
export function precedentsFor(hits: ReadonlyArray<KnowledgeHit>, currentDecisionId: string): KnowledgeHit[] {
  return hits.filter((h) => h.kind === 'decision' && h.id !== currentDecisionId);
}

export const PRECEDENT_NOTICE = 'Frühere Entscheidungen sind nur Hinweise. Sie gelten nicht als Freigabe für diese Aktion.';
