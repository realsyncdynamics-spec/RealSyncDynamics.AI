// CommandCenterOverview — Kopf des /app/dashboard im Look der Landing-v4-
// Sektion „Compliance Command Center“ (LandingV4Sections.tsx → V4Workspace).
//
// Struktur wie die Landing-Vorschau, Optik über die App-Klassen `cc-*`
// (src/styles/command-center.css, --brand-*-Tokens) und SeverityBadge.
// Kein Import der Landing-Kaskade. Unterschied zur Landing: KEINE Demo-Zahlen. Jeder Wert stammt
// aus den bereits geladenen CockpitData; fehlt eine Quelle, zeigen wir einen
// echten Backend-Status bzw. einen expliziten Fehlerzustand. Keine
// Platzhalter, keine Beispielzeilen.

import { Link } from 'react-router-dom';
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
  const notice = 'text-sm text-[var(--brand-muted)]';
  const errorText = 'text-sm text-[#ffd7c2]';

  return (
    <section
      data-testid="command-center-overview"
      aria-label="Compliance Command Center"
      className="flex flex-col gap-[var(--brand-space-4)]"
    >
      <div className="flex flex-wrap items-baseline gap-[var(--brand-space-3)]">
        <h2 className="m-0 font-[family-name:var(--brand-serif)] text-[22px] font-semibold tracking-tight text-[var(--brand-paper)]">
          Compliance Command Center
        </h2>
        {meta && <span className="cc-tile__label">{meta}</span>}
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
              <b className="cc-tile__value text-[20px]">{t.state}</b>
            ) : (
              <p role="alert" className={`m-0 ${errorText}`}>{t.error}</p>
            )}
            <span className="cc-tile__label">{t.label}</span>
            {t.cta && (
              <div className="mt-2">
                <Link to={t.cta.to} className="text-xs text-[var(--brand-champ)] hover:text-[var(--brand-champ-hi)]">
                  {t.cta.label}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rahmenwerk-Reifegrad (.cc-framework-bar): erst rendern, wenn es echte
          Reifegrade pro Rahmenwerk je Mandant gibt. Heute existiert keine
          solche Quelle → Sektion bewusst ausgeblendet. */}

      <div className="grid grid-cols-1 gap-[var(--brand-space-3)] lg:grid-cols-2">
        <div className="cc-panel" data-testid="overview-findings">
          <div className="cc-panel__head">
            Offene Findings{sorted.length + mediumHints.length > 0 ? <span className="cc-panel__meta">Priorisiert</span> : null}
          </div>
          {!findingsComplete && sorted.length === 0 ? (
            <div className="cc-panel__body" role="alert" data-testid="overview-findings-error">
              <p className={`m-0 ${errorText}`}>Findings-Quellen konnten nicht vollständig geladen werden.</p>
            </div>
          ) : sorted.length === 0 && mediumHints.length === 0 ? (
            <div className="cc-panel__body flex flex-wrap items-center gap-[var(--brand-space-3)]" data-testid="overview-findings-empty">
              <p className={`m-0 flex-1 ${notice}`}>Keine offenen Findings.</p>
              <ButtonLink to="/app/audit" size="sm">Audit starten</ButtonLink>
            </div>
          ) : (
            <div>
              {sorted.slice(0, 5).map((f) => (
                <Link key={f.id} to={f.href} className="cc-finding no-underline">
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
            <div className="cc-panel__body" role="alert" data-testid="overview-chain-error">
              <p className={`m-0 ${errorText}`}>Governance-Events konnten nicht geladen werden.</p>
            </div>
          ) : chain.length === 0 ? (
            <div className="cc-panel__body flex flex-wrap items-center gap-[var(--brand-space-3)]">
              <p className={`m-0 flex-1 ${notice}`}>Noch keine Governance-Events.</p>
              <ButtonLink to="/app/websites" size="sm">Website hinzufügen</ButtonLink>
            </div>
          ) : (
            <div>
              {chain.map((e) => (
                <div key={e.id} className="cc-finding" data-testid={`overview-chain-${e.id}`}>
                  <span className="cc-finding__meta truncate">{e.eventType}</span>
                  <span className="cc-finding__title">{e.title}</span>
                  <span className="cc-finding__meta text-[var(--brand-titan)]">{relTime(e.createdAt)}</span>
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
        <div className="cc-panel__body flex flex-col gap-[var(--brand-space-3)]">
          <div className="flex flex-wrap items-center gap-[var(--brand-space-3)]">
            <p className={`m-0 flex-1 ${notice}`}>Was möchtest du erledigen?</p>
            <ButtonLink to={agentPath} size="sm">Session starten</ButtonLink>
          </div>
          <nav className="cc-intent-chips" aria-label="Schnellaktionen">
            <Link className="cc-intent-chip no-underline" to="/app/websites">Website scannen</Link>
            <Link className="cc-intent-chip no-underline" to="/app/ai-systems">KI-System erfassen</Link>
            <Link className="cc-intent-chip no-underline" to="/app/audit">Audit starten</Link>
            <Link className="cc-intent-chip no-underline" to="/app/evidence">Evidence ansehen</Link>
          </nav>
        </div>
      </div>
    </section>
  );
}
