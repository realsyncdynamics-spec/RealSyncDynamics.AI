// CommandCenterOverview — Kopf des /app/dashboard im Look der Landing-v4-
// Sektion „Compliance Command Center“ (LandingV4Sections.tsx → V4Workspace).
//
// Struktur wie die Landing-Vorschau, Optik über die App-Klassen `cc-*`
// (src/styles/command-center.css, --brand-*-Tokens) und SeverityBadge.
// Kein Import der Landing-Kaskade. Unterschied zur Landing: KEINE Demo-Zahlen. Jeder Wert stammt
// aus den bereits geladenen CockpitData; fehlt eine Quelle, zeigen wir einen
// echten Backend-Status bzw. einen expliziten Fehlerzustand. Keine
// Platzhalter, keine Beispielzeilen.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ButtonLink, SeverityBadge } from '../../../components/brand';
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
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');
  const startSession = (e: FormEvent) => {
    e.preventDefault();
    const q = intent.trim();
    navigate(q ? `${agentPath}?intent=${encodeURIComponent(q)}` : agentPath);
  };

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

  const meta = [planLabel ? `PLAN ${planLabel.toUpperCase()}` : null, tenantName?.toUpperCase() ?? null]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      data-testid="command-center-overview"
      aria-label="Compliance Command Center"
      className="cc-page"
    >
      <div className="cc-page__head">
        <h2 className="cc-page__title">
          Compliance Command Center
        </h2>
        {meta && <span className="cc-page__meta">{meta}</span>}
      </div>

      <div className="cc-tiles">
        {tiles.map((t) => (
          <div
            key={t.key}
            className="cc-tile"
            data-testid={`overview-tile-${t.key}`}
            data-state={t.error ? 'error' : t.state ? 'status' : 'value'}
          >
            {t.value !== undefined ? (
              <b className="cc-tile__value">
                {t.value}
                {t.suffix ? <span className="cc-tile__unit">{t.suffix}</span> : null}
              </b>
            ) : t.state ? (
              <b className="cc-tile__value">{t.state}</b>
            ) : (
              <p role="alert" className="cc-panel__error">{t.error}</p>
            )}
            <span className="cc-tile__label">{t.label}</span>
            {t.cta && (
              <Link to={t.cta.to} className="cc-intent-chip">
                {t.cta.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Rahmenwerk-Reifegrad (.cc-framework-bar): erst rendern, wenn es echte
          Reifegrade pro Rahmenwerk je Mandant gibt. Heute existiert keine
          solche Quelle → Sektion bewusst ausgeblendet. */}

      <div className="cc-split">
        <div className="cc-panel" data-testid="overview-findings">
          <div className="cc-panel__head">
            Offene Findings{sorted.length + mediumHints.length > 0 ? <span className="cc-panel__meta">Priorisiert</span> : null}
          </div>
          {!findingsComplete && sorted.length === 0 ? (
            <p className="cc-panel__error" role="alert" data-testid="overview-findings-error">Findings-Quellen konnten nicht vollständig geladen werden.</p>
          ) : sorted.length === 0 && mediumHints.length === 0 ? (
            <div className="cc-panel__body" data-testid="overview-findings-empty">
              <p className="cc-panel__empty">Keine offenen Findings.</p>
              <ButtonLink to="/app/audit" size="sm">Audit starten</ButtonLink>
            </div>
          ) : (
            <div>
              {sorted.slice(0, 5).map((f) => (
                <Link key={f.id} to={f.href} className="cc-finding cc-finding--link">
                  <SeverityBadge severity="hoch" label={f.level === 'critical' ? 'Kritisch' : undefined} />
                  <span className="cc-finding__title">{f.title}</span>
                  <span className="cc-finding__meta">{f.detail}</span>
                </Link>
              ))}
              {mediumHints.slice(0, Math.max(0, 5 - sorted.length)).map((h) => (
                <div key={h} className="cc-finding">
                  <SeverityBadge severity="mittel" />
                  <span className="cc-finding__title">{h}</span>
                  <span className="cc-finding__meta" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cc-panel" data-testid="overview-evidence-chain">
          <div className="cc-panel__head">
            Evidence-Chain{chain.length > 0 ? <span className="cc-panel__meta">Neueste Events</span> : null}
          </div>
          {eventsFailed ? (
            <p className="cc-panel__error" role="alert" data-testid="overview-chain-error">Governance-Events konnten nicht geladen werden.</p>
          ) : chain.length === 0 ? (
            <div className="cc-panel__body">
              <p className="cc-panel__empty">Noch keine Governance-Events.</p>
              <ButtonLink to="/app/websites" size="sm">Website hinzufügen</ButtonLink>
            </div>
          ) : (
            <div>
              {chain.map((e) => (
                <div key={e.id} className="cc-chain-row" data-testid={`overview-chain-${e.id}`}>
                  <span className="cc-chain-row__type">{e.eventType}</span>
                  <span className="cc-chain-row__title">{e.title}</span>
                  <span className="cc-chain-row__time">{relTime(e.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cc-panel" data-testid="overview-agent-intent">
        <div className="cc-panel__head">
          Agent OS · Intent<span className="cc-panel__meta">Review-pflichtig</span>
        </div>
        <div className="cc-panel__body">
          <form className="cc-intent" onSubmit={startSession}>
            <input
              className="cc-intent__field"
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Was möchtest du erledigen?"
              aria-label="Was möchtest du erledigen?"
            />
            <button type="submit" className="cc-intent__go">Session starten</button>
          </form>
          <nav className="cc-intent-chips" aria-label="Schnellaktionen">
            <Link className="cc-intent-chip" to="/app/websites">Website scannen</Link>
            <Link className="cc-intent-chip" to="/app/ai-systems">KI-System erfassen</Link>
            <Link className="cc-intent-chip" to="/app/audit">Audit starten</Link>
            <Link className="cc-intent-chip" to="/app/evidence">Evidence ansehen</Link>
          </nav>
        </div>
      </div>
    </section>
  );
}
