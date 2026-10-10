// CommandCenterOverview — Kopf des /app/dashboard im Look der Landing-v4-
// Sektion „Compliance Command Center“ (LandingV4Sections.tsx → V4Workspace).
//
// JSX-Struktur und Klassen (`.app`, `.tiles`, `.tile`, `.split`, `.panel`,
// `.panel-head`, `.fw`, `.bar`, `.finding`, `.sev-*`, `.row`, `.intent`,
// `.intent-chips`) sind 1:1 übernommen; die Optik kommt aus derselben
// `.gv4`-Kaskade in styles/landing-v4-classical.css (nur gelesen, nicht
// geändert). Unterschied zur Landing: KEINE Demo-Zahlen. Jeder Wert stammt
// aus den bereits geladenen CockpitData; fehlt eine Quelle, zeigen wir einen
// echten Backend-Status bzw. einen expliziten Fehlerzustand. Keine
// Platzhalter, keine Beispielzeilen.

import { Link } from 'react-router-dom';
import '../../../styles/landing-v4-classical.css';
import {
  ACTION_SOURCES, SIGNAL_SOURCES, sourcesOk,
  type CockpitData,
} from '../cockpit/cockpitData';
import { collectCriticalFindings } from './ComplianceStatusDashboard';
import { GOVERNANCE_AI_PATH, isGovernanceAiEnabled } from '../../../config/featureFlags';

const SEVERITY_RANK = { critical: 0, high: 1 } as const;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
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

  type Tile = {
    key: string;
    label: string;
    value?: string;
    suffix?: string;
    /** Echter Backend-Status ohne Zahl (z. B. scoreStatus insufficient_data). */
    state?: string;
    /** Ladefehler der Quelle — expliziter Fehlerzustand statt Platzhalter. */
    error?: string;
    cta?: { to: string; label: string };
  };
  const tiles: Tile[] = [];
  if (scoreOk) {
    tiles.push({ key: 'score', label: 'GOVERNANCE SCORE', value: String(data.score), suffix: '/100' });
  } else if (data.scoreStatus === 'insufficient_data') {
    tiles.push({
      key: 'score',
      label: 'GOVERNANCE SCORE',
      state: 'Noch nicht bewertbar',
      cta: { to: '/app/ai-systems', label: 'KI-Systeme & Controls erfassen →' },
    });
  } else {
    tiles.push({ key: 'score', label: 'GOVERNANCE SCORE', error: 'Score nicht verlässlich — Datenquellen unvollständig geladen.' });
  }
  tiles.push(findingCount === null
    ? { key: 'findings', label: 'OFFENE FINDINGS', error: 'Findings-Quellen konnten nicht vollständig geladen werden.' }
    : { key: 'findings', label: 'OFFENE FINDINGS', value: String(findingCount) });
  tiles.push(evidenceCount === null
    ? { key: 'evidence', label: 'EVIDENCE-EINTRÄGE', error: 'Evidence konnte nicht geladen werden.' }
    : {
        key: 'evidence', label: 'EVIDENCE-EINTRÄGE', value: String(evidenceCount),
        cta: evidenceCount === 0 ? { to: '/app/audit', label: 'Audit starten →' } : undefined,
      });
  tiles.push(aiSystems === null
    ? { key: 'ai', label: 'KI-SYSTEME', error: 'KI-Systeme konnten nicht geladen werden.' }
    : {
        key: 'ai', label: 'KI-SYSTEME', value: String(aiSystems),
        cta: aiSystems === 0 ? { to: '/app/ai-systems', label: 'KI-System erfassen →' } : undefined,
      });

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
              <div
                key={t.key}
                className="tile"
                data-testid={`overview-tile-${t.key}`}
                data-state={t.error ? 'error' : t.state ? 'status' : 'value'}
              >
                {t.value !== undefined ? (
                  <b>
                    {t.value}
                    {t.suffix ? <i>{t.suffix}</i> : null}
                  </b>
                ) : t.state ? (
                  <b style={{ fontSize: 20 }}>{t.state}</b>
                ) : (
                  <b role="alert" style={{ fontSize: 14, color: '#ffd7c2' }}>{t.error}</b>
                )}
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
            {/* Rahmenwerk-Reifegrad: erst rendern, wenn es echte Reifegrade pro
                Rahmenwerk je Mandant gibt. Heute existiert keine solche Quelle →
                Sektion bewusst ausgeblendet (keine leeren Balken, keine Labels). */}
            <div className="panel" data-testid="overview-findings">
              <div className="panel-head">
                OFFENE FINDINGS<b>PRIORISIERT</b>
              </div>
              <div>
                {!findingsComplete && sorted.length === 0 ? (
                  <div className="intent" role="alert" data-testid="overview-findings-error">
                    <div className="field">Findings-Quellen konnten nicht vollständig geladen werden.</div>
                  </div>
                ) : sorted.length === 0 && mediumHints.length === 0 ? (
                  <div className="intent" data-testid="overview-findings-empty">
                    <div className="field">Keine offenen Findings.</div>
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
                EVIDENCE-CHAIN{chain.length > 0 ? <b>NEUESTE EVENTS</b> : null}
              </div>
              <div>
                {eventsFailed ? (
                  <div className="intent" role="alert" data-testid="overview-chain-error">
                    <div className="field">Governance-Events konnten nicht geladen werden.</div>
                  </div>
                ) : chain.length === 0 ? (
                  <div className="intent">
                    <div className="field">Noch keine Governance-Events.</div>
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
