// Entwicklung & CI — offene PRs mit Check-Status, letzte Läufe auf main,
// fehlgeschlagene CI-Läufe und Releases. Quelle: GitHub REST-API über
// ai-os-control; dieselbe Logik wie die Routinen (packages/ai-os-core/collect.ts).

import React, { useState } from 'react';
import type { FailedRun, PullRow, RoutineReport, WorkflowLatest } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource } from '../aiOsApi';
import { conclusionTone, Empty, fmtDate, HealthPill, Panel, Pill, ReloadButton, ResourceView } from '../ui';

interface DevopsResponse {
  configured?: boolean;
  message?: string;
  report: RoutineReport & { data: { pulls: PullRow[]; mainLatest: WorkflowLatest[]; uncheckedPulls: number } };
  releases: Array<{ tag: string; name: string | null; publishedAt: string; url: string; draft: boolean }>;
}
interface CiResponse {
  configured?: boolean;
  message?: string;
  report: RoutineReport & { data: { failed: FailedRun[]; stillRed: WorkflowLatest[] } };
}

export function DevOpsSection() {
  const devops = useAiOsResource<DevopsResponse>('devops');
  const ci = useAiOsResource<CiResponse>('ci_failures');
  const [filter, setFilter] = useState<'alle' | 'rot' | 'sicherheit' | 'bereit'>('alle');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Entwicklung & CI</h1>
          <p className="aios-lead">Pull Requests, Checks, fehlgeschlagene Läufe und Releases. Mergen und Deployen bleiben menschliche Schritte.</p>
        </div>
        <ReloadButton onClick={() => { devops.reload(); ci.reload(); }} loading={devops.loading || ci.loading} />
      </div>

      <ResourceView resource={devops}>
        {(d) => {
          const pulls = d.report.data.pulls.filter((p) =>
            filter === 'alle' ? true
              : filter === 'rot' ? p.checks?.health === 'fail'
                : filter === 'sicherheit' ? p.security
                  : !p.draft && p.checks?.health === 'ok');
          return (
            <>
              <Panel title="main — letzter Lauf je Workflow (24 h)" actions={<HealthPill health={d.report.health} />} source="GET /actions/runs?branch=main">
                {d.report.data.mainLatest.length === 0 ? <Empty>Keine Läufe auf main in den letzten 24 Stunden.</Empty> : (
                  <div className="aios-table-wrap">
                    <table className="aios-table">
                      <thead><tr><th>Workflow</th><th>Ergebnis</th><th>Zeit</th></tr></thead>
                      <tbody>
                        {d.report.data.mainLatest.map((w) => (
                          <tr key={w.workflow + w.createdAt}>
                            <td><a className="aios-link" href={w.url} target="_blank" rel="noreferrer">{w.workflow}</a></td>
                            <td><Pill tone={conclusionTone(w.conclusion, w.status)}>{w.conclusion ?? w.status ?? '—'}</Pill></td>
                            <td>{fmtDate(w.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel
                title={`Offene Pull Requests (${d.report.data.pulls.length})`}
                actions={
                  <label className="text-sm flex items-center gap-2">Filter
                    <select className="aios-select" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                      <option value="alle">alle</option>
                      <option value="rot">rote Checks</option>
                      <option value="sicherheit">Sicherheit</option>
                      <option value="bereit">bereit (kein Entwurf, grün)</option>
                    </select>
                  </label>
                }
                source="GET /pulls · GET /commits/{sha}/check-runs"
              >
                {d.report.data.uncheckedPulls > 0 && <p className="text-xs aios-muted">{d.report.data.uncheckedPulls} ältere PRs ohne Check-Abfrage (API-Budget).</p>}
                {pulls.length === 0 ? <Empty>Keine Pull Requests in diesem Filter.</Empty> : (
                  <div className="aios-table-wrap">
                    <table className="aios-table">
                      <thead><tr><th>PR</th><th>Titel</th><th>Checks</th><th>Alter</th></tr></thead>
                      <tbody>
                        {pulls.map((p) => (
                          <tr key={p.number}>
                            <td className="aios-mono"><a className="aios-link" href={p.url} target="_blank" rel="noreferrer">#{p.number}</a></td>
                            <td>
                              {p.title}{' '}
                              {p.draft && <Pill tone="neutral">Entwurf</Pill>}{' '}
                              {p.security && <Pill tone="warn">Sicherheit</Pill>}
                            </td>
                            <td>
                              {!p.checks ? <span className="text-xs aios-muted">nicht geprüft</span> : (
                                <span title={p.checks.failed.join(', ')}>
                                  <Pill tone={p.checks.health === 'ok' ? 'ok' : p.checks.health === 'fail' ? 'fail' : p.checks.health === 'warn' ? 'info' : 'neutral'}>
                                    {p.checks.passed}/{p.checks.total} grün{p.checks.pending ? `, ${p.checks.pending} laufen` : ''}
                                  </Pill>
                                  {p.checks.failed.length > 0 && <div className="text-xs aios-muted mt-1">rot: {p.checks.failed.join(', ')}</div>}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap">{p.ageDays} Tage{p.idleDays > 7 ? ` · ${p.idleDays} ohne Änderung` : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Releases" source="GET /releases">
                {d.releases.length === 0 ? <Empty>Keine GitHub-Releases. Ausgeliefert wird über den Merge auf main (Cloudflare Pages, deploy.yml).</Empty> : (
                  <ul className="text-sm space-y-1">
                    {d.releases.map((r) => <li key={r.tag}><a className="aios-link" href={r.url} target="_blank" rel="noreferrer">{r.name ?? r.tag}</a> · {fmtDate(r.publishedAt)}{r.draft ? ' · Entwurf' : ''}</li>)}
                  </ul>
                )}
              </Panel>
            </>
          );
        }}
      </ResourceView>

      <ResourceView resource={ci}>
        {(d) => (
          <Panel title="Fehlgeschlagene CI-Läufe auf main (72 h)" actions={<HealthPill health={d.report.health} />} source="GET /actions/runs?status=failure · GET /actions/runs/{id}/jobs">
            {d.report.data.stillRed.length > 0 && (
              <p className="text-sm" style={{ color: 'var(--aios-fail)' }}>Aktuell rot: {d.report.data.stillRed.map((w) => w.workflow).join(', ')}</p>
            )}
            {d.report.data.failed.length === 0 ? <Empty>Keine fehlgeschlagenen Läufe auf main in den letzten 72 Stunden.</Empty> : (
              <div className="aios-table-wrap">
                <table className="aios-table">
                  <thead><tr><th>Workflow</th><th>Zeit</th><th>Job › Schritt</th></tr></thead>
                  <tbody>
                    {d.report.data.failed.map((f) => (
                      <tr key={f.id}>
                        <td><a className="aios-link" href={f.url} target="_blank" rel="noreferrer">{f.workflow}</a></td>
                        <td>{fmtDate(f.createdAt)}</td>
                        <td className="text-xs">{f.failedJobs.length === 0 ? '—' : f.failedJobs.map((j) => `${j.job}${j.steps.length ? ` › ${j.steps.join(', ')}` : ''}`).join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs aios-muted">Ursachenanalyse: Skill <span className="aios-mono">/aios-ci-failure-analysis</span> in Claude Code.</p>
          </Panel>
        )}
      </ResourceView>
    </>
  );
}
