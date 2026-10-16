// Routinen — Zeitpläne, Grenzen, Rechte, Zustand und Läufe der AI-OS-Routinen
// sowie die bestehenden Automationen (registriert, nicht ersetzt).

import React from 'react';
import { AGENTS, EXISTING_ROUTINES, ROUTINES } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import { RoutineControls, RoutineStatePill, type RoutinesResponse } from '../routineControls';
import { conclusionTone, Empty, ErrorNote, fmtDate, NotConfigured, Panel, Pill, ReloadButton, StatusPill } from '../ui';

const agentName = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;

export function RoutineCenterSection({ session }: { session: AiOsSession }) {
  const res = useAiOsResource<RoutinesResponse>('routines');
  const data = res.result?.ok ? res.result.data : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Routinen</h1>
          <p className="aios-lead">
            Zeit- und ereignisgesteuerte Prüfungen, serverseitig in GitHub Actions — unabhängig von einem eingeschalteten PC
            oder einer offenen Claude-Sitzung. Alle AI-OS-Routinen lesen nur und rufen kein Sprachmodell auf.
          </p>
        </div>
        <ReloadButton onClick={res.reload} loading={res.loading} />
      </div>

      {res.result && !res.result.ok && <ErrorNote result={res.result} />}
      {data?.configured === false && <NotConfigured message={data.message} />}

      {ROUTINES.map((r) => {
        const live = data?.routines.find((x) => x.id === r.id);
        return (
          <section key={r.id} className="aios-panel">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{r.name}</h2>
              <div className="flex items-center gap-2"><StatusPill status={r.status} /><RoutineStatePill live={live} /></div>
            </div>
            <div className="aios-grid-wide text-sm">
              <dl className="space-y-1">
                <div><dt className="inline aios-muted">Agent: </dt><dd className="inline">{agentName(r.agent)}</dd></div>
                <div><dt className="inline aios-muted">Auslöser: </dt><dd className="inline">{r.triggers.map((t) => t.kind === 'schedule' ? `${t.description} (${t.cron})` : t.description).join(' · ')}</dd></div>
                <div><dt className="inline aios-muted">Workflow: </dt><dd className="inline aios-mono">{live?.url ? <a className="aios-link" href={live.url} target="_blank" rel="noreferrer">{r.workflowFile}</a> : r.workflowFile}</dd></div>
                <div><dt className="inline aios-muted">Eingaben: </dt><dd className="inline">{r.inputs.join('; ')}</dd></div>
              </dl>
              <dl className="space-y-1">
                <div><dt className="inline aios-muted">Rechte: </dt><dd className="inline aios-mono">{Object.entries(r.permissions).map(([k, v]) => `${k}:${v}`).join(', ')}</dd></div>
                <div><dt className="inline aios-muted">Grenzen: </dt><dd className="inline">{r.limits.timeoutMinutes} min · max. {r.limits.maxApiCalls} API-Aufrufe · {r.limits.maxAttempts} Versuche je Aufruf · {r.limits.maxLlmCostEur} € Modellkosten</dd></div>
                <div><dt className="inline aios-muted">Protokoll: </dt><dd className="inline">{r.outputs.join(', ')} ({r.limits.artifactRetentionDays} Tage)</dd></div>
                <div><dt className="inline aios-muted">Fehler: </dt><dd className="inline">Lauf rot = Routine selbst gescheitert; Befunde färben nur den Bericht.</dd></div>
              </dl>
            </div>
            <RoutineControls routine={r} live={live} session={session} routinesResource={res} />
            <div>
              <h3 className="text-sm font-semibold mb-1">Letzte Läufe</h3>
              {!live || live.runs.length === 0 ? (
                <Empty>{live?.state === 'not_found' ? 'Workflow existiert noch nicht auf main.' : 'Noch keine Läufe.'}</Empty>
              ) : (
                <div className="aios-table-wrap">
                  <table className="aios-table">
                    <thead><tr><th>Zeit</th><th>Auslöser</th><th>Ergebnis</th><th>Bericht</th></tr></thead>
                    <tbody>
                      {live.runs.map((run) => (
                        <tr key={run.id}>
                          <td>{fmtDate(run.createdAt)}</td>
                          <td className="aios-mono">{run.event}</td>
                          <td><Pill tone={conclusionTone(run.conclusion, run.status)}>{run.conclusion ?? run.status ?? '—'}</Pill></td>
                          <td><a className="aios-link" href={run.url} target="_blank" rel="noreferrer">Job-Summary öffnen</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <Panel title="pg_cron-Jobs (Supabase, live)" source="RPC admin_system_health().cron_jobs">
        {!data ? null : data.cronJobs === null ? (
          <Empty>admin_system_health nicht lesbar.</Empty>
        ) : data.cronJobs.length === 0 ? (
          <Empty>Keine pg_cron-Jobs gemeldet.</Empty>
        ) : (
          <div className="aios-table-wrap">
            <table className="aios-table">
              <thead><tr><th>Job</th><th>Zeitplan</th><th>Aktiv</th></tr></thead>
              <tbody>
                {data.cronJobs.map((j) => (
                  <tr key={j.name}><td className="aios-mono">{j.name}</td><td className="aios-mono">{j.schedule}</td><td><Pill tone={j.active ? 'ok' : 'warn'}>{j.active ? 'ja' : 'nein'}</Pill></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Bestehende Automationen (registriert)" source="packages/ai-os-core/src/routines.ts · EXISTING_ROUTINES">
        <div className="aios-table-wrap">
          <table className="aios-table">
            <thead><tr><th>Name</th><th>Laufzeit</th><th>Zeitplan</th><th>Agent</th><th>Quelle</th></tr></thead>
            <tbody>
              {EXISTING_ROUTINES.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td className="aios-mono">{r.runtime}</td><td className="aios-mono">{r.schedule}</td><td>{agentName(r.agent)}</td><td className="aios-mono">{r.source}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
