// Sicherheit & Prüfpfad — Berechtigungsmodell (Gateway-Katalog), Freigabewege,
// Aktionsprotokoll der Operatoren und die Lage der Sicherheits-Guards.
// Fehler werden angezeigt, nicht weichgezeichnet.

import React from 'react';
import { TOOL_ACTIONS, type ActionClass } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import { Empty, ErrorNote, fmtDate, HealthPill, Kpi, Note, Panel, Pill, ReloadButton, ResourceView, type Tone } from '../ui';
import type { RoutineReport } from '../../../../packages/ai-os-core/src/index';

interface AuditEntry {
  id: string;
  created_at: string;
  request_id: string;
  action_id: string;
  agent_id: string | null;
  action_class: 'read' | 'write';
  phase: 'requested' | 'succeeded' | 'failed' | 'denied';
  target: string | null;
  detail: Record<string, unknown>;
  actor_user_id: string;
}
interface AuditResponse { log: AuditEntry[] | null; logAvailable: boolean; logError: string | null; activeOperators: number | null }
interface GuardRow { label: string; file: string; health: 'ok' | 'warn' | 'fail' | 'unknown'; conclusion: string; createdAt: string; url: string }
interface SecurityResponse {
  configured?: boolean;
  message?: string;
  report: RoutineReport & { data: { guards: GuardRow[]; securityPulls: Array<{ number: number; title: string; url: string; ageDays: number; draft: boolean }> } };
}

const CLASS_TONE: Record<ActionClass, Tone> = { read: 'neutral', write: 'warn', critical: 'fail' };
const CLASS_LABEL: Record<ActionClass, string> = { read: 'lesend', write: 'schreibend', critical: 'kritisch' };
const PHASE_TONE: Record<AuditEntry['phase'], Tone> = { requested: 'info', succeeded: 'ok', failed: 'fail', denied: 'warn' };
const PHASE_LABEL: Record<AuditEntry['phase'], string> = { requested: 'angefordert', succeeded: 'ausgeführt', failed: 'fehlgeschlagen', denied: 'abgelehnt' };
const APPROVAL_LABEL = { none: '—', confirm: 'Bestätigung + 2FA', 'separate-release': 'separate Freigabe' } as const;
const CHANNEL_LABEL = { 'edge-gateway': 'Server-Gateway', 'github-actions': 'Routine', 'claude-session': 'Claude-Sitzung', manual: 'nur manuell' } as const;

export function SecurityAuditSection({ session }: { session: AiOsSession }) {
  const audit = useAiOsResource<AuditResponse>('audit');
  const security = useAiOsResource<SecurityResponse>('security');

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Sicherheit & Prüfpfad</h1>
          <p className="aios-lead">
            Wer darf was, über welchen Weg — und was wurde tatsächlich ausgelöst. Kritische Aktionen (Merge, Deploy,
            Migration, Stripe, Außenkommunikation) sind im AI-OS nicht ausführbar.
          </p>
        </div>
        <ReloadButton onClick={() => { audit.reload(); security.reload(); }} loading={audit.loading || security.loading} />
      </div>

      <div className="aios-grid">
        <Kpi label="Ihre Sitzung" value={session.aal === 'aal2' ? '2FA' : 'ohne 2FA'} sub={session.aal === 'aal2' ? 'Schreibaktionen möglich' : 'nur lesend'} />
        <Kpi label="Aktive Plattform-Operatoren" value={audit.result?.ok ? (audit.result.data.activeOperators ?? '—') : '…'} sub="platform_operators (nur Anzahl)" />
        <Kpi label="GitHub-Anbindung" value={session.githubConfigured ? 'verbunden' : 'fehlt'} sub={<span className="aios-mono">{session.repo}</span>} />
      </div>

      <Panel title="Aktionsprotokoll" source="ai_os_action_log (append-only, lesbar nur für Operatoren)">
        {audit.result && !audit.result.ok && <ErrorNote result={audit.result} />}
        {audit.result?.ok && !audit.result.data.logAvailable && (
          <Note tone="fail">{audit.result.data.logError} Ohne Protokoll führt der Server keine Schreibaktion aus.</Note>
        )}
        {audit.result?.ok && audit.result.data.log && (audit.result.data.log.length === 0 ? <Empty>Noch keine protokollierten Aktionen.</Empty> : (
          <div className="aios-table-wrap">
            <table className="aios-table">
              <thead><tr><th>Zeit</th><th>Aktion</th><th>Agent</th><th>Phase</th><th>Ziel</th><th>Anfrage</th></tr></thead>
              <tbody>
                {audit.result.data.log.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{fmtDate(e.created_at)}</td>
                    <td className="aios-mono">{e.action_id}</td>
                    <td>{e.agent_id ?? '—'}</td>
                    <td><Pill tone={PHASE_TONE[e.phase]}>{PHASE_LABEL[e.phase]}</Pill>{e.phase === 'denied' && typeof e.detail.reason === 'string' && <div className="text-xs aios-muted">{e.detail.reason}</div>}</td>
                    <td className="aios-mono text-xs">{e.target ?? '—'}</td>
                    <td className="aios-mono text-xs" title={e.request_id}>{e.request_id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Panel>

      <ResourceView resource={security}>
        {(d) => (
          <Panel title="Sicherheits-Guards und Deploys" actions={<HealthPill health={d.report.health} />} source="GitHub Actions: letzter Lauf auf main je Workflow">
            <div className="aios-table-wrap">
              <table className="aios-table">
                <thead><tr><th>Prüfung</th><th>Ergebnis</th><th>Zeit</th></tr></thead>
                <tbody>
                  {d.report.data.guards.map((g) => (
                    <tr key={g.file}>
                      <td>{g.url ? <a className="aios-link" href={g.url} target="_blank" rel="noreferrer">{g.label}</a> : g.label}</td>
                      <td><HealthPill health={g.health} /> <span className="text-xs aios-muted">{g.conclusion}</span></td>
                      <td>{g.createdAt === '—' ? '—' : fmtDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="text-sm font-semibold">Offene Sicherheits-PRs ({d.report.data.securityPulls.length})</h3>
            {d.report.data.securityPulls.length === 0 ? <Empty>Keine.</Empty> : (
              <ul className="text-sm space-y-1">
                {d.report.data.securityPulls.map((p) => (
                  <li key={p.number}><a className="aios-link" href={p.url} target="_blank" rel="noreferrer">#{p.number}</a> {p.title} · {p.ageDays} Tage{p.draft ? ' · Entwurf' : ''}</li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </ResourceView>

      <Panel title="Berechtigungen und Freigabewege" source="packages/ai-os-core/src/tools.ts (Default-Deny)">
        <div className="aios-table-wrap">
          <table className="aios-table">
            <thead><tr><th>Aktion</th><th>Klasse</th><th>Weg</th><th>Freigabe</th><th>Secret (Name)</th></tr></thead>
            <tbody>
              {TOOL_ACTIONS.map((a) => (
                <tr key={a.id}>
                  <td><div>{a.label}</div><div className="aios-mono text-xs aios-muted">{a.id}</div></td>
                  <td><Pill tone={CLASS_TONE[a.class]}>{CLASS_LABEL[a.class]}</Pill></td>
                  <td>{CHANNEL_LABEL[a.channel]}</td>
                  <td>{APPROVAL_LABEL[a.approval]}{a.note && <div className="text-xs aios-muted">{a.note}</div>}</td>
                  <td className="aios-mono text-xs">{a.secret ? a.secret.name : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
