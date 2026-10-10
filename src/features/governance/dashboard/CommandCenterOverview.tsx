// CommandCenterOverview — Kopf des /app/dashboard im Look der Landing-v4-
// Sektion „Compliance Command Center“ (LandingV4Sections.tsx → V4Workspace).
//
// JSX-Struktur und Klassen (`.app`, `.tiles`, `.tile`, `.split`, `.panel`,
// `.panel-head`, `.fw`, `.bar`, `.finding`, `.sev-*`, `.row`, `.intent`,
// `.intent-chips`) sind 1:1 übernommen; die Optik kommt aus derselben
// `.gv4`-Kaskade in styles/landing-v4-classical.css (nur gelesen, nicht
// geändert). Unterschied zur Landing: KEINE Demo-Zahlen. Jeder Wert stammt
// aus den bereits geladenen CockpitData; fehlt eine Quelle, zeigen wir einen
// ehrlichen Zustand („Noch nicht bewertbar“, „Noch keine Daten“, „—“) plus
// CTA auf eine bestehende Route.

import { Link } from 'react-router-dom';
import '../../../styles/landing-v4-classical.css';
import {
  ACTION_SOURCES, SIGNAL_SOURCES, sourcesOk,
  type CockpitData,
} from '../cockpit/cockpitData';
import { collectCriticalFindings } from './ComplianceStatusDashboard';
import { GOVERNANCE_AI_PATH, isGovernanceAiEnabled } from '../../../config/featureFlags';

/** Rahmenwerke wie auf der Landing. Kein Mandanten-Reifegrad pro Rahmenwerk
 *  in den Dashboard-Quellen → Balken bleiben leer, Label ehrlich. */
export const OVERVIEW_FRAMEWORKS: Array<{ name: string; status: 'data-missing' | 'roadmap' }> = [
  { name: 'DSGVO', status: 'data-missing' },
  { name: 'EU AI ACT', status: 'data-missing' },
  { name: 'ISO 27001', status: 'data-missing' },
  { name: 'NIS2', status: 'data-missing' },
  { name: 'TISAX', status: 'roadmap' },
  { name: 'DORA', status: 'roadmap' },
];

const SEVERITY_RANK = { critical: 0, high: 1 } as const;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '—';
  const m = Math.max(0, Math.round(diff / 60_000));
  if (m < 60) return `VOR ${m} MIN`;
  const h = Math.round(m / 60);
  if (h < 48) return `VOR ${h} H`;
  return `VOR ${Math.round(h / 24)} T`;
}

export function CommandCenterOverview({
  data,
  tenantName,
  planLabel,
}: {
  data: CockpitData;
  tenantName: string | null;
  planLabel: string | null;
}) {
  const findingsComplete = sourcesOk(data, [...ACTION_SOURCES, ...SIGNAL_SOURCES]);
  const { items, mediumHints } = collectCriticalFindings(data.actions, data.signals);
  const sorted = [...items].sort((a, b) => SEVERITY_RANK[a.level] - SEVERITY_RANK[b.level]);
  const findingCount = findingsComplete ? items.length + mediumHints.length : null;

  const scoreOk = data.scoreStatus === 'ok' && data.score !== null;
  const evidenceFailed = data.partialFailures.some((f) => f.startsWith('evidence'));
  const evidenceCount = evidenceFailed ? null : data.evidenceHealth.totalCount;
  const aiSystems = data.scoreBasis.aiSystems;
  const eventsFailed = data.partialFailures.some((f) => f.startsWith('events:'));
  const chain = data.recentEvents.slice(0, 4);
  const agentPath = isGovernanceAiEnabled() ? GOVERNANCE_AI_PATH : '/app/agents';

  const tiles: Array<{ key: string; value: string; suffix?: string; label: string; cta?: { to: string; label: string } }> = [
    {
      key: 'score',
      value: scoreOk ? String(data.score) : '—',
      suffix: scoreOk ? '/100' : undefined,
      label: scoreOk ? 'GOVERNANCE SCORE' : 'GOVERNANCE SCORE · NOCH NICHT BEWERTBAR',
      cta: scoreOk ? undefined : { to: '/app/ai-systems', label: 'KI-Systeme & Controls erfassen →' },
    },
    {
      key: 'findings',
      value: findingCount === null ? '—' : String(findingCount),
      label: findingCount === null ? 'OFFENE FINDINGS · NICHT VOLLSTÄNDIG GELADEN' : 'OFFENE FINDINGS',
    },
    {
      key: 'evidence',
      value: evidenceCount === null ? '—' : String(evidenceCount),
      label: 'EVIDENCE-EINTRÄGE',
      cta: evidenceCount === 0 ? { to: '/app/audit', label: 'Audit starten →' } : undefined,
    },
    {
      key: 'ai',
      value: aiSystems === null ? '—' : String(aiSystems),
      label: 'KI-SYSTEME',
      cta: aiSystems === 0 ? { to: '/app/ai-systems', label: 'KI-System erfassen →' } : undefined,
    },
  ];

  return (
    <div className="gv4" data-testid="command-center-overview" style={{ background: 'transparent' }}>
      <div className="app" role="region" aria-label="Compliance Command Center" style={{ marginTop: 0 }}>
        <div className="app-main">
          <div className="app-head">
            <h3>Compliance Command Center</h3>
            <span>
              {[planLabel ? `PLAN ${planLabel.toUpperCase()}` : null, tenantName?.toUpperCase() ?? null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>

          <div className="tiles">
            {tiles.map((t) => (
              <div key={t.key} className="tile" data-testid={`overview-tile-${t.key}`}>
                <b>
                  {t.value}
                  {t.suffix ? <i>{t.suffix}</i> : null}
                </b>
                <span>{t.label}</span>
                {t.cta && (
                  <div style={{ marginTop: 8 }}>
                    <Link to={t.cta.to} style={{ fontSize: 12 }}>{t.cta.label}</Link>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="split">
            <div className="panel" data-testid="overview-frameworks">
              <div className="panel-head">
                RAHMENWERK-REIFEGRAD<b>{OVERVIEW_FRAMEWORKS.length} RAHMENWERKE</b>
              </div>
              <div>
                {OVERVIEW_FRAMEWORKS.map((fw) => (
                  <div key={fw.name} className="fw">
                    <s>{fw.name}</s>
                    <div className="bar" aria-hidden="true">
                      <u style={{ width: '0%' }} />
                    </div>
                    <em>{fw.status === 'roadmap' ? 'ROADMAP' : 'NOCH KEINE DATEN'}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" data-testid="overview-findings">
              <div className="panel-head">
                OFFENE FINDINGS<b>PRIORISIERT</b>
              </div>
              <div>
                {!findingsComplete && sorted.length === 0 ? (
                  <div className="finding" role="status">
                    <span className="sev sev-mid">—</span>
                    <em>Befunde nicht vollständig geladen.</em>
                    <u />
                  </div>
                ) : sorted.length === 0 && mediumHints.length === 0 ? (
                  <div className="intent" data-testid="overview-findings-empty">
                    <div className="field">Keine offenen Findings. Ein Audit liefert die erste Befundliste.</div>
                    <Link className="go" to="/app/audit">Audit starten</Link>
                  </div>
                ) : (
                  <>
                    {sorted.slice(0, 5).map((f) => (
                      <Link key={f.id} to={f.href} className="finding" style={{ color: 'inherit' }}>
                        <span className="sev sev-high">{f.level === 'critical' ? 'KRITISCH' : 'HOCH'}</span>
                        <em>{f.title}</em>
                        <u>{f.detail}</u>
                      </Link>
                    ))}
                    {mediumHints.slice(0, Math.max(0, 5 - sorted.length)).map((h) => (
                      <div key={h} className="finding">
                        <span className="sev sev-mid">MITTEL</span>
                        <em>{h}</em>
                        <u />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="split">
            <div className="panel" data-testid="overview-evidence-chain">
              <div className="panel-head">
                EVIDENCE-CHAIN<b>{chain.length > 0 ? 'NEUESTE EVENTS' : 'LEER'}</b>
              </div>
              <div>
                {eventsFailed ? (
                  <div className="row"><s>—</s><em>Event-Quelle vorübergehend nicht verfügbar.</em><u /></div>
                ) : chain.length === 0 ? (
                  <div className="intent">
                    <div className="field">Noch keine Governance-Events. Website hinterlegen und scannen.</div>
                    <Link className="go" to="/app/websites">Website hinzufügen</Link>
                  </div>
                ) : (
                  chain.map((e) => (
                    <div key={e.id} className="row" data-testid={`overview-chain-${e.id}`}>
                      <s>{e.eventType.toUpperCase()}</s>
                      <em>{e.title}</em>
                      <u>{relTime(e.createdAt)}</u>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel" data-testid="overview-agent-intent">
              <div className="panel-head">
                AGENT OS · INTENT<b>REVIEW-PFLICHTIG</b>
              </div>
              <div className="intent">
                <Link className="field" to={agentPath}>Was möchtest du erledigen?</Link>
                <Link className="go" to={agentPath}>Session starten</Link>
              </div>
              <div className="intent-chips">
                <Link to="/app/websites"><span>Website scannen</span></Link>
                <Link to="/app/ai-systems"><span>KI-System erfassen</span></Link>
                <Link to="/app/audit"><span>Audit starten</span></Link>
                <Link to="/app/evidence"><span>Evidence ansehen</span></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
