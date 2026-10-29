// Routine starten / pausieren — gemeinsam genutzt von Agentensteuerung,
// Skill-Bibliothek und Routinen. Jede Aktion: Bestätigungsdialog →
// `confirmed:true` → Server prüft Rolle, AAL2, Agent-Positivliste und
// protokolliert vor der Ausführung (ai_os_action_log).

import React, { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { RoutineDefinition } from '../../../packages/ai-os-core/src/index';
import { callAiOs, DENY_HINT, type Resource } from './aiOsApi';
import { ConfirmDialog, fmtDate, Note, Pill, conclusionTone, useActionState } from './ui';
import type { AiOsSession } from './AiOsCommandCenter';

export interface RoutineRun {
  id: number;
  event: string;
  status: string | null;
  conclusion: string | null;
  createdAt: string;
  url: string;
}

export interface RoutineLive {
  id: string;
  state: string;
  url?: string;
  error?: string;
  runs: RoutineRun[];
}

export interface RoutinesResponse {
  configured?: boolean;
  message?: string;
  /** Fehlt, wenn die Quelle nicht verbunden ist — dann wie leer behandeln. */
  routines?: RoutineLive[];
  cronJobs?: Array<{ name: string; schedule: string; active: boolean }> | null;
  apiCalls?: number;
}

const STATE_LABEL: Record<string, { tone: 'ok' | 'warn' | 'fail' | 'neutral'; label: string }> = {
  active: { tone: 'ok', label: 'aktiv' },
  disabled_manually: { tone: 'warn', label: 'pausiert' },
  disabled_inactivity: { tone: 'warn', label: 'pausiert (Inaktivität)' },
  not_found: { tone: 'fail', label: 'Workflow fehlt auf main' },
};

export function RoutineStatePill({ live }: { live?: RoutineLive }) {
  if (!live) return <Pill tone="neutral">Status unbekannt</Pill>;
  const s = STATE_LABEL[live.state] ?? { tone: 'neutral' as const, label: live.state };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function LastRun({ live }: { live?: RoutineLive }) {
  const run = live?.runs[0];
  if (!run) return <span className="text-xs aios-muted">noch kein Lauf</span>;
  return (
    <a href={run.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs aios-link">
      <Pill tone={conclusionTone(run.conclusion, run.status)}>{run.conclusion ?? run.status ?? '—'}</Pill>
      {fmtDate(run.createdAt)}
    </a>
  );
}

type Pending = { kind: 'dispatch' } | { kind: 'toggle'; enabled: boolean };

export function RoutineControls({ routine, live, session, routinesResource }: {
  routine: RoutineDefinition;
  live?: RoutineLive;
  session: AiOsSession;
  routinesResource?: Resource<RoutinesResponse>;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const { busy, setBusy, feedback, setFeedback } = useActionState();
  const paused = live?.state?.startsWith('disabled');
  const writeBlocked = !session.githubConfigured
    ? 'GitHub nicht verbunden'
    : session.aal !== 'aal2'
      ? 'Schreibaktionen erfordern 2FA (AAL2)'
      : null;

  async function run() {
    if (!pending) return;
    setBusy(true);
    const r = pending.kind === 'dispatch'
      ? await callAiOs<{ message?: string }>('routine_dispatch', { routineId: routine.id, confirmed: true })
      : await callAiOs<{ enabled: boolean }>('routine_toggle', { routineId: routine.id, enabled: pending.enabled, confirmed: true });
    setBusy(false);
    setPending(null);
    if (r.ok) {
      setFeedback({
        tone: 'ok',
        text: pending.kind === 'dispatch'
          ? 'Lauf angefordert. Ergebnis erscheint nach dem Neuladen unter „Letzter Lauf".'
          : pending.enabled ? 'Routine fortgesetzt.' : 'Routine pausiert.',
      });
      routinesResource?.reload();
    } else {
      setFeedback({ tone: 'fail', text: DENY_HINT[r.code] ?? `${r.code}: ${r.message}` });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="aios-btn"
          disabled={!!writeBlocked || busy || paused}
          title={writeBlocked ?? (paused ? 'Pausierte Routinen erst fortsetzen' : undefined)}
          onClick={() => setPending({ kind: 'dispatch' })}
        >
          <Play className="h-4 w-4" aria-hidden="true" /> Jetzt starten
        </button>
        <button
          type="button"
          className="aios-btn"
          disabled={!!writeBlocked || busy || !live || live.state === 'not_found'}
          title={writeBlocked ?? undefined}
          onClick={() => setPending({ kind: 'toggle', enabled: !!paused })}
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          {paused ? 'Fortsetzen' : 'Pausieren'}
        </button>
      </div>
      {writeBlocked && <p className="text-xs aios-muted">{writeBlocked}.</p>}
      {feedback && <Note tone={feedback.tone}>{feedback.text}</Note>}
      {pending && (
        <ConfirmDialog
          title={pending.kind === 'dispatch' ? `${routine.name} starten?` : `${routine.name} ${pending.enabled ? 'fortsetzen' : 'pausieren'}?`}
          body={
            <>
              <p>
                {pending.kind === 'dispatch'
                  ? <>Startet den Workflow <span className="aios-mono">{routine.workflowFile}</span> auf <span className="aios-mono">main</span>. Die Routine liest nur (keine Änderungen am Repository, keine Modellkosten).</>
                  : <>Setzt den Workflow <span className="aios-mono">{routine.workflowFile}</span> in GitHub auf {pending.enabled ? 'aktiv' : 'deaktiviert'}. Zeitplan und Ereignis-Auslöser {pending.enabled ? 'greifen wieder' : 'ruhen bis zum Fortsetzen'}.</>}
              </p>
              <p className="mt-2 text-xs aios-muted">Die Aktion wird mit Ihrer Kennung im Prüfpfad protokolliert.</p>
            </>
          }
          confirmLabel={pending.kind === 'dispatch' ? 'Starten' : pending.enabled ? 'Fortsetzen' : 'Pausieren'}
          onConfirm={run}
          onCancel={() => setPending(null)}
          busy={busy}
        />
      )}
    </div>
  );
}
