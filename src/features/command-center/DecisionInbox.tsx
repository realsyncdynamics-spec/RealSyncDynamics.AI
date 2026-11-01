import { useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { PRECEDENT_NOTICE, precedentsFor, type KnowledgeHit } from './memory';
import { Inbox } from 'lucide-react';
import { EVENT_LABEL, groupOpenQuestions, PRIORITY_LABEL, type Priority, type QuestionEventRow } from './decisionInbox';
import { useDecisionInbox } from './useDecisionInbox';
import { APPROVAL_LABEL, requiredApprovalLevel, type Reversibility } from '../../../supabase/functions/_shared/decision-proposal';

const PRIO_CLASS: Record<Priority, string> = {
  P0: 'bg-red-500/15 text-red-300',
  P1: 'bg-orange-500/15 text-orange-300',
  P2: 'bg-sky-500/15 text-sky-300',
  P3: 'bg-zinc-600/30 text-zinc-300',
};

export function DecisionInbox() {
  const { questions, events, decisions, loading, sourceError, reload } = useDecisionInbox();
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [precedents, setPrecedents] = useState<Record<string, KnowledgeHit[] | string>>({});

  async function loadPrecedents(decisionId: string, text: string) {
    const { data, error } = await getSupabase().rpc('search_agent_knowledge', { p_query: text, p_kinds: ['decision'], p_limit: 10, p_match_any: true });
    setPrecedents((p) => ({ ...p, [decisionId]: error ? `nicht verfügbar: ${error.message}` : precedentsFor((data ?? []) as KnowledgeHit[], decisionId) }));
  }

  async function resolve(decisionId: string, action: 'approve' | 'reject' | 'defer', level: string, optionIndex: number | null) {
    setBusy(decisionId);
    setActionError(null);
    const { error } = await getSupabase().rpc('resolve_agent_decision', {
      p_decision_id: decisionId,
      p_action: action,
      p_option_index: optionIndex,
      p_approval_level: level,
      p_confirm: action === 'approve' ? confirmed[decisionId] === true : false,
      p_note: null,
    });
    setBusy(null);
    if (error) { setActionError(error.message); return; }
    reload();
  }
  const groups = useMemo(() => groupOpenQuestions(questions), [questions]);
  const eventsByQ = useMemo(() => {
    const m = new Map<string, QuestionEventRow[]>();
    for (const e of events) m.set(e.question_id, [...(m.get(e.question_id) ?? []), e]);
    return m;
  }, [events]);

  return (
    <aside aria-label="Decision Inbox" className="w-full shrink-0 border-t border-zinc-800 p-4 lg:w-80 lg:border-l lg:border-t-0">
      <h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" aria-hidden />Offene Entscheidungen</h2>
      <p className="mt-1 text-xs text-zinc-400">Eine Empfehlung ist nie eine Freigabe. Freigaben nur nach ausdrücklicher Bestätigung; jede wird protokolliert.</p>
      {loading && <p className="mt-3 text-sm text-zinc-400">Lade …</p>}
      {actionError && <p role="alert" className="mt-3 text-sm text-red-300">Aktion abgelehnt: {actionError}</p>}
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
            {(() => {
              const d = g.primary.decision_id ? decisions[g.primary.decision_id] : undefined;
              if (!d) return <p className="mt-2 text-xs text-zinc-500">Noch kein Antwortvorschlag.</p>;
              const level = requiredApprovalLevel(`${g.primary.question} ${g.primary.context ?? ''}`, d.reversibility as Reversibility);
              return (
                <div data-testid="inbox-proposal" className="mt-2 rounded-md border border-zinc-800 p-2">
                  <p className="text-xs font-medium text-zinc-300">KI-Antwortvorschlag · {d.proposed_by}</p>
                  <ol className="mt-1 space-y-1">
                    {d.options.slice(0, 3).map((o, i) => (
                      <li key={i} data-testid="proposal-option" className="text-xs text-zinc-300">
                        <span className="font-medium">{String.fromCharCode(65 + i)}{o.recommended ? ' · Empfohlen' : ''}:</span> {o.label}
                        <span className="block text-zinc-400">{o.rationale}</span>
                      </li>
                    ))}
                  </ol>
                  <p data-testid="proposal-level" className="mt-1 text-xs text-amber-200">Erforderlich: {APPROVAL_LABEL[level]}</p>
                  <p className="text-xs text-zinc-400">Empfehlung ≠ Freigabe. Status: {d.status}.</p>
                  <div className="mt-1">
                    {precedents[d.id] === undefined ? (
                      <button type="button" onClick={() => void loadPrecedents(d.id, `${g.primary.question} ${d.recommendation}`)}
                        className="text-xs text-sky-300 underline">Frühere Entscheidungen anzeigen</button>
                    ) : (
                      <div data-testid="precedents" className="rounded border border-zinc-800 p-1.5 text-xs">
                        <p className="text-amber-200">{PRECEDENT_NOTICE}</p>
                        {typeof precedents[d.id] === 'string' ? <p className="text-zinc-400">Präzedenzfälle {precedents[d.id] as string}</p>
                          : (precedents[d.id] as KnowledgeHit[]).length === 0 ? <p className="text-zinc-400">Keine früheren Entscheidungen gefunden.</p>
                          : (
                            <ul className="mt-0.5 space-y-0.5 text-zinc-300">
                              {(precedents[d.id] as KnowledgeHit[]).map((h) => (
                                <li key={h.id}>{h.title} <span className="text-zinc-500">· {h.status} · {new Date(h.created_at).toLocaleDateString('de-DE')}</span></li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}
                  </div>
                  {d.status === 'proposed' && (
                    <div className="mt-2 space-y-1.5">
                      <label className="flex items-start gap-1.5 text-xs text-zinc-300">
                        <input type="checkbox" checked={confirmed[d.id] === true}
                          onChange={(e) => setConfirmed((c) => ({ ...c, [d.id]: e.target.checked }))} />
                        Ich gebe diese Aktion ausdrücklich frei ({level}).
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {d.options.slice(0, 3).map((o, i) => (
                          <button key={i} type="button" disabled={busy === d.id || confirmed[d.id] !== true}
                            onClick={() => void resolve(d.id, 'approve', level, i)}
                            className="rounded border border-emerald-700 px-2 py-0.5 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">
                            {o.recommended ? 'Vorschlag übernehmen' : `Alternative ${String.fromCharCode(65 + i)} wählen`}
                          </button>
                        ))}
                        <button type="button" disabled={busy === d.id} onClick={() => void resolve(d.id, 'defer', level, null)}
                          className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300">Zurückstellen</button>
                        <button type="button" disabled={busy === d.id} onClick={() => void resolve(d.id, 'reject', level, null)}
                          className="rounded border border-red-800 px-2 py-0.5 text-xs text-red-300">Ablehnen</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
