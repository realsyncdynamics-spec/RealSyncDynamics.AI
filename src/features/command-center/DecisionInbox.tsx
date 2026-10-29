import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { EVENT_LABEL, groupOpenQuestions, PRIORITY_LABEL, type Priority, type QuestionEventRow } from './decisionInbox';
import { useDecisionInbox } from './useDecisionInbox';

const PRIO_CLASS: Record<Priority, string> = {
  P0: 'bg-red-500/15 text-red-300',
  P1: 'bg-orange-500/15 text-orange-300',
  P2: 'bg-sky-500/15 text-sky-300',
  P3: 'bg-zinc-600/30 text-zinc-300',
};

export function DecisionInbox() {
  const { questions, events, loading, sourceError } = useDecisionInbox();
  const groups = useMemo(() => groupOpenQuestions(questions), [questions]);
  const eventsByQ = useMemo(() => {
    const m = new Map<string, QuestionEventRow[]>();
    for (const e of events) m.set(e.question_id, [...(m.get(e.question_id) ?? []), e]);
    return m;
  }, [events]);

  return (
    <aside aria-label="Decision Inbox" className="w-full shrink-0 border-t border-zinc-800 p-4 lg:w-80 lg:border-l lg:border-t-0">
      <h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" aria-hidden />Offene Entscheidungen</h2>
      <p className="mt-1 text-xs text-zinc-400">Eine Empfehlung ist nie eine Freigabe. Antworten und Freigaben folgen in M3/M4.</p>
      {loading && <p className="mt-3 text-sm text-zinc-400">Lade …</p>}
      {!loading && sourceError && (
        <p role="status" className="mt-3 rounded-md border border-amber-700/50 bg-amber-900/20 p-2 text-sm text-amber-200">
          Datenquelle nicht verfügbar: {sourceError}
        </p>
      )}
      {!loading && !sourceError && groups.length === 0 && (
        <p data-testid="inbox-empty" className="mt-3 text-sm text-zinc-400">Keine offenen Fragen.</p>
      )}
      <ol className="mt-3 space-y-2">
        {groups.map((g) => (
          <li key={g.dedupeKey} data-testid="inbox-item" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span data-testid="inbox-priority" className={`rounded px-1.5 py-0.5 font-medium ${PRIO_CLASS[g.priority]}`} title={PRIORITY_LABEL[g.priority]}>
                {g.priority}
              </span>
              {g.isDemo && <span className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 font-medium text-fuchsia-200">DEMO</span>}
              {g.members.length > 1 && (
                <span data-testid="inbox-dup" className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-zinc-200">{g.members.length}× gefragt</span>
              )}
              {g.primary.milestone && <span className="text-zinc-400">{g.primary.milestone}</span>}
            </div>
            <p className="mt-1.5 text-sm text-zinc-100">{g.primary.question}</p>
            <p className="mt-1 text-xs text-zinc-400">
              Von: {g.agents.join(', ')}{g.primary.project ? ` · ${g.primary.project}` : ''}{g.primary.task_ref ? ` · Aufgabe ${g.primary.task_ref}` : ''}
            </p>
            {g.primary.context && <p className="mt-1 text-xs text-zinc-400">{g.primary.context}</p>}
            <details className="mt-2 text-xs text-zinc-400">
              <summary className="cursor-pointer">Historie</summary>
              <ul className="mt-1 space-y-0.5">
                {g.members.flatMap((m) => eventsByQ.get(m.id) ?? []).map((e, i) => (
                  <li key={`${e.question_id}-${i}`}>
                    {new Date(e.created_at).toLocaleString('de-DE')} · {EVENT_LABEL[e.event_type]}
                    {e.from_value ? ` ${e.from_value} →` : ''} {e.to_value ?? ''}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </aside>
  );
}
