import { useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import {
  claimState, COLUMN_LABEL, COLUMNS, EMPTY_TASK_FILTER, filterTasks, groupByColumn, openDependencies, PRIORITY_LABEL, shortId,
  type AgentTaskRow, type BoardColumn, type TaskFilter,
} from './taskBoard';
import { useAgentTasks } from './useAgentTasks';

function TaskCard({ t, byId, onMove, busy }: {
  t: AgentTaskRow; byId: ReadonlyMap<string, AgentTaskRow>; busy: boolean;
  onMove: (t: AgentTaskRow, to: BoardColumn, evidence: string) => void;
}) {
  const [to, setTo] = useState<BoardColumn | ''>('');
  const [ev, setEv] = useState('');
  const deps = openDependencies(t, byId);
  const claim = claimState(t);
  const evidenceCount = (t.evidence ?? []).length;
  return (
    <li data-testid="task-card" className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs">
      <p className="font-mono text-zinc-500">{shortId(t.id)}</p>
      <p className="mt-0.5 text-sm text-zinc-100">{t.task}</p>
      <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-2 text-zinc-400">
        <dt>Agent</dt><dd className="text-zinc-200">{t.agent}</dd>
        <dt>Projekt</dt><dd className="text-zinc-200">{t.project ?? 'nicht gesetzt'}</dd>
        <dt>Priorität</dt><dd className="text-zinc-200">{PRIORITY_LABEL[t.priority] ?? t.priority}</dd>
        <dt>Abhängigkeiten</dt><dd className="text-zinc-200">{(t.depends_on ?? []).length === 0 ? 'keine' : `${deps.length} offen von ${(t.depends_on ?? []).length}`}</dd>
        <dt>Prüfnachweise</dt><dd className="text-zinc-200">{evidenceCount}</dd>
        <dt>Bearbeitung</dt><dd className="text-zinc-200">{claim === 'free' ? 'frei' : claim === 'held' ? `gesperrt durch ${t.claimed_by}` : `Lease abgelaufen (${t.claimed_by})`}</dd>
        {t.correlation_id && (<><dt>Korrelation</dt><dd className="font-mono text-zinc-300">{t.correlation_id.slice(0, 8)}</dd></>)}
      </dl>
      {t.blocker_reason && <p className="mt-1 text-amber-300">Blocker: {t.blocker_reason}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <select aria-label={`Verschieben ${shortId(t.id)}`} value={to} onChange={(e) => setTo(e.target.value as BoardColumn)}
          className="rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200">
          <option value="">Verschieben …</option>
          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {to === 'done' && (
          <input aria-label={`Prüfnachweis ${shortId(t.id)}`} placeholder="Nachweis (PR, Testlauf …)" value={ev}
            onChange={(e) => setEv(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-zinc-200" />
        )}
        <button type="button" disabled={busy || !to || (to === 'done' && !ev.trim() && evidenceCount === 0)}
          onClick={() => { if (to) onMove(t, to, ev.trim()); }}
          className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-200 disabled:opacity-40">Übernehmen</button>
      </div>
    </li>
  );
}

/** M6: Kanban + Liste der Agentenaufgaben (agent_tasks). Schreiben nur per RPC move_agent_task. */
export function TaskBoard() {
  const { rows, loading, sourceError, reload } = useAgentTasks();
  const [f, setF] = useState<TaskFilter>(EMPTY_TASK_FILTER);
  const [mode, setMode] = useState<'board' | 'list'>('board');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const shown = useMemo(() => filterTasks(rows, f), [rows, f]);
  const groups = useMemo(() => groupByColumn(shown), [shown]);
  const agents = useMemo(() => [...new Set(rows.map((r) => r.agent))].sort(), [rows]);
  const projects = useMemo(() => [...new Set(rows.map((r) => r.project).filter((p): p is string => Boolean(p)))].sort(), [rows]);
  const set = (p: Partial<TaskFilter>) => setF((x) => ({ ...x, ...p }));

  async function move(t: AgentTaskRow, to: BoardColumn, evidence: string) {
    setBusy(true); setErr(null);
    const { error } = await getSupabase().rpc('move_agent_task', {
      p_task_id: t.id, p_board_status: to,
      p_evidence: evidence ? [{ kind: 'manual', ref: evidence, at: new Date().toISOString() }] : null,
      p_note: null,
    });
    setBusy(false);
    if (error) { setErr(`Abgelehnt: ${error.message}`); return; }
    reload();
  }

  const sel = (label: string, value: string, opts: string[], key: keyof TaskFilter, unset = false, fmt: (o: string) => string = (o) => o) => (
    <label className="flex flex-col text-xs text-zinc-400">
      {label}
      <select aria-label={label} value={value} onChange={(e) => set({ [key]: e.target.value } as Partial<TaskFilter>)}
        className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100">
        <option value="all">Alle</option>
        {unset && <option value="__unset__">Nicht gesetzt</option>}
        {opts.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
      </select>
    </label>
  );

  return (
    <section aria-label="Aufgaben" data-testid="task-board">
      <h1 className="text-xl font-semibold">Aufgaben</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Quelle: agent_tasks. Doppelbearbeitung und zirkuläre Delegation werden serverseitig abgewiesen; ERLEDIGT erfordert einen Prüfnachweis.
      </p>
      {sourceError && <p role="status" className="mt-3 text-sm text-amber-200">{sourceError}</p>}
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col text-xs text-zinc-400">
          Suche
          <input aria-label="Aufgaben suchen" value={f.query} onChange={(e) => set({ query: e.target.value })}
            className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100" />
        </label>
        {sel('Agent', f.agent, agents, 'agent')}
        {sel('Projekt', f.project, projects, 'project', true)}
        {sel('Priorität', f.priority, ['low', 'normal', 'high', 'critical'], 'priority', false, (o) => PRIORITY_LABEL[o as AgentTaskRow['priority']])}
        <div role="group" aria-label="Ansicht" className="flex gap-1">
          {(['board', 'list'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
              className={`rounded px-2 py-1 text-xs ${mode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>
              {m === 'board' ? 'Kanban' : 'Liste'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{loading ? 'Lade …' : `${shown.length} von ${rows.length} Aufgaben`}</p>
      {!loading && rows.length === 0 && !sourceError && <p data-testid="tasks-empty" className="mt-2 text-sm text-zinc-400">Keine Aufgaben vorhanden.</p>}

      {mode === 'board' ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {COLUMNS.map((c) => (
            <section key={c.key} aria-label={c.label} data-testid={`col-${c.key}`} className="w-64 shrink-0 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-300">{c.label} <span className="text-zinc-500">({groups[c.key].length})</span></h2>
              <ul className="space-y-2">
                {groups[c.key].map((t) => <TaskCard key={t.id} t={t} byId={byId} onMove={move} busy={busy} />)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-zinc-400"><tr><th className="py-1">ID</th><th>Aufgabe</th><th>Agent</th><th>Projekt</th><th>Priorität</th><th>Status</th><th>Nachweise</th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} data-testid="task-row" className="border-t border-zinc-800 text-zinc-200">
                <td className="py-1 font-mono">{shortId(t.id)}</td><td>{t.task}</td><td>{t.agent}</td><td>{t.project ?? 'nicht gesetzt'}</td>
                <td>{PRIORITY_LABEL[t.priority] ?? t.priority}</td>
                <td>{(() => { const c = groupByColumn([t]); const k = COLUMNS.find((x) => c[x.key].length)?.key; return k ? COLUMN_LABEL[k] : t.status; })()}</td>
                <td>{(t.evidence ?? []).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
