// Übersicht — Gesamtstatus aus echten Quellen. Jede Kachel zeigt ihre Quelle;
// fehlt eine Quelle, steht dort „nicht verbunden" statt einer Zahl.

import React from 'react';
import { Link } from 'react-router-dom';
import { AGENTS, ROUTINES, SKILLS, type RoutineReport } from '../../../../packages/ai-os-core/src/index';
import { useAiOsResource, type AiOsResult } from '../aiOsApi';
import type { AiOsSession } from '../AiOsCommandCenter';
import type { RoutinesResponse } from '../routineControls';
import { HealthPill, Kpi, Note, Panel, ReloadButton } from '../ui';
import type { PullRow, WorkflowLatest } from '../../../../packages/ai-os-core/src/index';
import type { CostsResponse } from './CostsSection';

interface DevopsResponse { configured?: boolean; message?: string; report: RoutineReport & { data: { pulls: PullRow[]; mainLatest: WorkflowLatest[] } } }
interface SecurityResponse { configured?: boolean; message?: string; report: RoutineReport }

function value<T extends { configured?: boolean }>(r: AiOsResult<T> | null, pick: (d: T) => React.ReactNode, loading: boolean): React.ReactNode {
  if (loading && !r) return '…';
  if (!r) return '—';
  if (!r.ok) return 'Fehler';
  if (r.data.configured === false) return 'nicht verbunden';
  return pick(r.data);
}

export function OverviewSection({ session }: { session: AiOsSession }) {
  const devops = useAiOsResource<DevopsResponse>('devops');
  const security = useAiOsResource<SecurityResponse>('security');
  const routines = useAiOsResource<RoutinesResponse>('routines');
  const costs = useAiOsResource<CostsResponse>('costs');
  const reloadAll = () => { devops.reload(); security.reload(); routines.reload(); costs.reload(); };
  const anyLoading = devops.loading || security.loading || routines.loading || costs.loading;

  const pulls = devops.result?.ok ? devops.result.data.report?.data.pulls ?? [] : [];
  const mainRed = devops.result?.ok ? (devops.result.data.report?.data.mainLatest ?? []).filter((w) => w.health === 'fail') : [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aios-h1">Übersicht</h1>
          <p className="aios-lead">
            Gesamtstatus von Agenten, Routinen, Entwicklung, Infrastruktur und KI-Kosten. Alle Werte stammen aus
            GitHub, Supabase und dem AI-OS-Register — nichts ist geschätzt.
          </p>
        </div>
        <ReloadButton onClick={reloadAll} loading={anyLoading} />
      </div>

      {!session.githubConfigured && (
        <Note tone="warn">
          GitHub ist nicht verbunden (Function-Secret <span className="aios-mono">AI_OS_GITHUB_TOKEN</span> fehlt).
          Entwicklungs-, Routinen- und Sicherheitswerte bleiben leer, bis das Secret gesetzt ist.
        </Note>
      )}

      <div className="aios-grid">
        <Kpi label="Agenten im Register" value={AGENTS.length} sub={`${SKILLS.length} Skills · ${ROUTINES.length} AI-OS-Routinen`} />
        <Kpi
          label="Offene Pull Requests"
          value={value(devops.result, () => pulls.length, devops.loading)}
          sub={pulls.length ? `${pulls.filter((p) => p.checks?.health === 'fail' && !p.draft).length} mit roten Checks · ${pulls.filter((p) => p.draft).length} Entwürfe` : undefined}
        />
        <Kpi
          label="main: rote Workflows (24 h)"
          value={value(devops.result, () => mainRed.length, devops.loading)}
          sub={mainRed.length ? mainRed.map((w) => w.workflow).join(', ') : undefined}
        />
        <Kpi
          label="Routinen aktiv"
          value={value(routines.result, (d) => `${d.routines.filter((r) => r.state === 'active').length}/${ROUTINES.length}`, routines.loading)}
          sub="GitHub-Workflow-Zustand"
        />
        <Kpi
          label="KI-Kosten 30 Tage (USD)"
          value={value(costs.result, (d) => (d.ledger.available ? d.ledger.totalUsd.toFixed(2) : 'Quelle nicht lesbar'), costs.loading)}
          sub="tenant_cost_ledger, ohne Simulationen"
        />
        <Kpi
          label="Sicherheit & Infrastruktur"
          value={value(security.result, (d) => <HealthPill health={d.report.health} />, security.loading)}
          sub="CodeQL, Drift-Guards, Deploys"
        />
      </div>

      <Panel title="Nächste Schritte" source="abgeleitet aus den Kacheln oben">
        <ul className="text-sm space-y-1 aios-fg2 list-disc pl-5">
          {mainRed.length > 0 && <li>Rote Workflows auf main zuerst: <Link className="aios-link" to="/admin/ai-os/entwicklung">Entwicklung & CI</Link>.</li>}
          {session.aal !== 'aal2' && <li>Für Starten/Pausieren und Wissens-PRs mit zweitem Faktor anmelden (<Link className="aios-link" to="/settings/security">Sicherheit</Link>).</li>}
          {!session.githubConfigured && <li>GitHub-Token als Function-Secret hinterlegen (siehe docs/ai-os/README.md).</li>}
          {routines.result?.ok && routines.result.data.routines.some((r) => r.state === 'not_found') && (
            <li>AI-OS-Workflows sind noch nicht auf main — sie erscheinen nach dem Merge dieses Pakets.</li>
          )}
          <li>Skills in einer Claude-Code-Sitzung ausführen: <Link className="aios-link" to="/admin/ai-os/skills">Skill-Bibliothek</Link>.</li>
        </ul>
      </Panel>
    </>
  );
}
