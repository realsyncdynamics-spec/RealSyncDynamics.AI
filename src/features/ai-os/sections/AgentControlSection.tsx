// Agentensteuerung — Agent wählen, seine Routinen starten oder pausieren,
// Ergebnisse (Läufe) prüfen. LLM-gestützte Aufgaben laufen als Claude-Code-
// Sitzung mit den Skills; das UI zeigt den genauen Aufruf, statt eine
// Ausführung vorzutäuschen.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AGENTS, ROUTINES, SKILLS, getToolAction, type AgentId } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import { LastRun, RoutineControls, RoutineStatePill, type RoutinesResponse } from '../routineControls';
import { ErrorNote, NotConfigured, Note, Panel, Pill, ReloadButton, StatusPill } from '../ui';

const CHANNEL_LABEL: Record<string, string> = {
  'claude-session': 'Claude-Code-Sitzung',
  'github-actions': 'GitHub Actions (Routinen)',
  'edge-gateway': 'Server-Gateway (ai-os-control)',
  manual: 'manuell',
};

export function AgentControlSection({ session }: { session: AiOsSession }) {
  const [selected, setSelected] = useState<AgentId>('development');
  const routines = useAiOsResource<RoutinesResponse>('routines');
  const agent = AGENTS.find((a) => a.id === selected)!;
  const agentRoutines = ROUTINES.filter((r) => r.agent === agent.id);
  const live = routines.result?.ok ? (routines.result.data.routines ?? []) : [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Agentensteuerung</h1>
          <p className="aios-lead">
            Fünf Betriebsagenten mit festen Positivlisten. Routinen laufen serverseitig in GitHub Actions; Aufgaben mit
            Sprachmodell laufen in einer Claude-Code-Sitzung (lokal oder in der Cloud) mit den Skills dieses Registers.
          </p>
        </div>
        <ReloadButton onClick={routines.reload} loading={routines.loading} />
      </div>

      <div role="tablist" aria-label="Agent auswählen" className="flex flex-wrap gap-2">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={a.id === selected}
            className="aios-btn"
            data-variant={a.id === selected ? 'primary' : undefined}
            onClick={() => setSelected(a.id)}
          >
            {a.name}
          </button>
        ))}
      </div>

      <Panel title={agent.name} actions={<StatusPill status={agent.status} />} source="packages/ai-os-core/src/agents.ts">
        <p className="text-sm aios-fg2">{agent.purpose}</p>
        <div className="aios-grid-wide">
          <div>
            <h3 className="text-sm font-semibold mb-1">Aufgaben</h3>
            <ul className="text-sm aios-fg2 list-disc pl-5 space-y-1">{agent.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Ausführung</h3>
            <ul className="text-sm aios-fg2 list-disc pl-5 space-y-1">{agent.executors.map((e) => <li key={e}>{CHANNEL_LABEL[e] ?? e}</li>)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Skills</h3>
            <ul className="text-sm space-y-1">
              {agent.skills.map((id) => (
                <li key={id}>
                  <Link className="aios-link" to={`/admin/ai-os/skills#${id}`}>{SKILLS.find((s) => s.id === id)?.name ?? id}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1">Erlaubte Aktionen (Positivliste)</h3>
          <div className="flex flex-wrap gap-2">
            {agent.allowedActions.map((id) => {
              const a = getToolAction(id);
              return (
                <span key={id} className="inline-flex items-center gap-1 text-xs">
                  <span className="aios-mono">{id}</span>
                  <Pill tone={a?.class === 'write' ? 'warn' : 'neutral'}>{a?.class === 'write' ? 'schreibt' : 'liest'}</Pill>
                </span>
              );
            })}
          </div>
        </div>
        {agent.blockers && agent.blockers.length > 0 && (
          <Note tone="warn">
            <strong>Offene Voraussetzungen:</strong>
            <ul className="list-disc pl-5 mt-1">{agent.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          </Note>
        )}
      </Panel>

      <Panel title={`Routinen von ${agent.name}`} source="GitHub Actions API (Workflow-Zustand und letzte Läufe)">
        {agentRoutines.length === 0 && <p className="text-sm aios-muted">Dieser Agent hat keine serverseitige Routine; er arbeitet nur in Claude-Code-Sitzungen.</p>}
        {routines.result && !routines.result.ok && <ErrorNote result={routines.result} />}
        {routines.result?.ok && routines.result.data.configured === false && <NotConfigured message={routines.result.data.message} />}
        {agentRoutines.map((r) => {
          const l = live.find((x) => x.id === r.id);
          return (
            <div key={r.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--aios-border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="text-xs aios-muted">{r.triggers.map((t) => t.description).join(' · ')}</div>
                </div>
                <div className="flex items-center gap-3"><RoutineStatePill live={l} /><LastRun live={l} /></div>
              </div>
              <div className="mt-2"><RoutineControls routine={r} live={l} session={session} routinesResource={routines} /></div>
            </div>
          );
        })}
      </Panel>
    </>
  );
}
