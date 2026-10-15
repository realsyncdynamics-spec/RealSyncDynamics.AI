/**
 * Kunden-Startansicht oben auf /app/dashboard — fünf Zonen in fester
 * Rangfolge (statt gleichgewichteter Banner, Null-Kacheln und Statuslabels):
 *
 *   1. Hero: Workspace, Reifestatus, EINE Hauptbotschaft, EINE Hauptaktion
 *   2. Einrichtungsfortschritt (Checkliste + Balken) inkl. Testphase-Zeile
 *   3. Drei Kernbereiche: Websites & Scans · KI-Systeme · Risiken & Maßnahmen
 *   4. Ergebnisse & Nachweise — kompakt; leer = ein Satz + eine Aktion
 *   5. Weitere Module (nachgelagert)
 *
 * Entscheidungen leben in startPanelModel.ts (testbar, ohne React).
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Circle, Loader2 } from 'lucide-react';
import { BETA } from '../../../config/beta';
import type { CockpitData } from '../cockpit/cockpitData';
import type { TrialStatus } from '../../../core/billing/trial';
import { HIGH_RISK_SYSTEMS_ROUTE } from '../handoff/enforcementModel';
import { daysSince, formatAgeDe, riskAttentionSignals } from './dashboardSignals';
import { computeAccountNotice, type StartPanelInput, type StartPanelModel } from './startPanelModel';
import './customer-start.css';

const SECONDARY_MODULES: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Berichte', href: '/app/reports' },
  { label: 'Policies', href: '/app/policy-packs' },
  { label: 'Voice', href: '/app/voice' },
  { label: 'Abrechnung', href: '/app/billing' },
  { label: 'Alle Module', href: '/app/modules' },
];

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function CustomerStartPanel({
  tenantName,
  facts,
  model,
  lastScanRunAt,
  trial,
  data,
}: {
  tenantName: string | null;
  facts: StartPanelInput;
  model: StartPanelModel;
  lastScanRunAt: string | null;
  trial: TrialStatus | null;
  data: CockpitData | null;
}) {
  const account = computeAccountNotice(trial, BETA);
  const { primary, secondary } = model;
  const percent = Math.round((model.doneCount / model.totalCount) * 100);

  return (
    <section className="rs-apppage rs-start" data-testid="customer-start" aria-labelledby="start-headline">
      {/* Zone 1 — Hero: genau eine Botschaft, genau eine Hauptaktion. */}
      <div className="rs-start__hero" data-testid="start-hero">
        <div className="rs-start__meta">
          <span className="rs-overline">{tenantName ?? 'Ihr Workspace'}</span>
          <span
            className={`rs-start__chip ${model.complete ? 'rs-start__chip--ok' : ''}`}
            data-testid="start-maturity"
          >
            {model.maturity}
          </span>
        </div>
        <h1 id="start-headline" className="rs-start__headline">
          {primary?.headline ?? 'Ihr Workspace wird geladen …'}
        </h1>
        <p className="rs-start__lead">
          {primary?.detail ?? 'Wir prüfen gerade, was in Ihrem Workspace schon eingerichtet ist.'}
        </p>
        {primary && (
          <div className="rs-start__actions">
            <Link to={primary.href} className="rs-start__cta" data-testid="start-primary-cta">
              {primary.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {secondary && (
              <Link to={secondary.href} className="rs-start__link" data-testid="start-secondary-cta">
                oder {secondary.label}
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="rs-start__grid">
        {/* Zone 2 — Fortschritt statt verstreuter Null-Kacheln. */}
        <section className="rs-panel rs-start__progress" aria-labelledby="start-progress-title" data-testid="start-progress">
          <div className="rs-start__progress-head">
            <h2 id="start-progress-title" className="rs-h3">Einrichtung</h2>
            <span className="rs-note rs-mono">
              {model.doneCount} von {model.totalCount} erledigt
            </span>
          </div>
          <div
            className="rs-start__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={model.totalCount}
            aria-valuenow={model.doneCount}
            aria-label="Einrichtungsfortschritt"
          >
            <div className="rs-start__bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <ol className="rs-start__steps">
            {model.steps.map((step) => {
              const isNext = primary?.stepId === step.id;
              return (
                <li
                  key={step.id}
                  className={`rs-start__step rs-start__step--${step.state} ${isNext ? 'rs-start__step--next' : ''}`}
                  data-testid={`start-step-${step.id}`}
                  data-state={step.state}
                >
                  <span className="rs-start__step-icon" aria-hidden="true">
                    {step.state === 'done' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : step.state === 'unknown' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="rs-start__step-label">
                      {step.label}
                      <span className="sr-only">
                        {step.state === 'done' ? ' – erledigt' : step.state === 'open' ? ' – offen' : ' – wird geprüft'}
                      </span>
                    </span>
                    {step.state === 'open' && <span className="rs-start__step-benefit">{step.benefit}</span>}
                  </span>
                  {isNext ? (
                    <span className="rs-start__badge">Nächster Schritt</span>
                  ) : step.state === 'open' ? (
                    <Link to={step.href} className="rs-start__step-link">
                      {step.cta}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {account && (
            <p
              className={`rs-start__account ${account.tone === 'attention' ? 'rs-start__account--attention' : ''}`}
              data-testid="start-account"
            >
              <span>{account.text}</span>
              {account.link && (
                <Link to={account.link.href} className="rs-start__step-link">
                  {account.link.label} →
                </Link>
              )}
            </p>
          )}
        </section>

        {/* Zone 3 — drei Kernbereiche: Zustand · Nutzen · nächste Aktion. */}
        <div className="rs-start__core" data-testid="start-core">
          <CoreTile
            testId="core-websites"
            title="Websites & Scans"
            benefit="Findet Tracking-, Cookie- und Datenschutz-Lücken Ihrer Website."
            {...websitesTile(facts, lastScanRunAt)}
          />
          <CoreTile
            testId="core-ai-systems"
            title="KI-Systeme"
            benefit="Ordnet jedes System einer Risikoklasse nach EU AI Act zu."
            {...aiSystemsTile(facts)}
          />
          <CoreTile
            testId="core-risks"
            title="Risiken & Maßnahmen"
            benefit="Zeigt, was Sie als Nächstes beheben sollten – mit Frist."
            {...risksTile(facts, data, primary?.href ?? '/app/websites')}
          />
        </div>
      </div>

      {/* Zone 4 — Ergebnisse & Nachweise. */}
      <ResultsZone facts={facts} data={data} fallback={primary} />

      {/* Zone 5 — nachgelagerte Module. */}
      <nav className="rs-start__more" aria-label="Weitere Module" data-testid="start-more">
        <span className="rs-overline">Weitere Module</span>
        <ul>
          {SECONDARY_MODULES.map((m) => (
            <li key={m.href}>
              <Link to={m.href}>{m.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

interface TileState {
  state: string;
  cta: { label: string; href: string } | null;
}

function websitesTile(facts: StartPanelInput, lastScanRunAt: string | null): TileState {
  const { websiteCount: sites, scanCount: scans } = facts;
  if (sites === null) return { state: 'Wird geladen …', cta: null };
  if (sites === 0) {
    return { state: 'Noch keine Website hinterlegt.', cta: { label: 'Website hinterlegen', href: '/app/websites' } };
  }
  const label = plural(sites, 'Website', 'Websites');
  if (scans === null) return { state: `${label} hinterlegt.`, cta: { label: 'Websites ansehen', href: '/app/websites' } };
  if (scans === 0) {
    return { state: `${label} hinterlegt, noch nicht gescannt.`, cta: { label: 'Scan starten', href: '/app/websites' } };
  }
  const age = daysSince(lastScanRunAt);
  return {
    state: age === null ? `${label} · gescannt.` : `${label} · letzter Scan ${formatAgeDe(age)}.`,
    cta: { label: 'Scan-Ergebnisse ansehen', href: '/app/scans' },
  };
}

function aiSystemsTile(facts: StartPanelInput): TileState {
  const n = facts.aiSystemCount;
  if (n === null) return { state: 'Wird geladen …', cta: null };
  if (n === 0) {
    return { state: 'Noch kein KI-System erfasst.', cta: { label: 'Erstes KI-System erfassen', href: '/app/onboarding' } };
  }
  return { state: `${plural(n, 'KI-System', 'KI-Systeme')} erfasst.`, cta: { label: 'KI-Systeme verwalten', href: '/app/ai-systems' } };
}

function risksTile(facts: StartPanelInput, data: CockpitData | null, firstStepHref: string): TileState {
  if (!data) return { state: 'Wird geladen …', cta: null };
  const open = data.actions.length + riskAttentionSignals(data.signals).length;
  if (open > 0) {
    return { state: `${plural(open, 'offener Punkt', 'offene Punkte')}.`, cta: { label: 'Jetzt prüfen', href: '/app/risks' } };
  }
  const nothingToAssess = (facts.scanCount ?? 0) === 0 && (facts.aiSystemCount ?? 0) === 0;
  if (nothingToAssess) {
    return {
      state: 'Risiken erscheinen nach Ihrem ersten Scan oder KI-System.',
      cta: { label: 'Zuerst einrichten', href: firstStepHref },
    };
  }
  return { state: 'Aktuell keine offenen Punkte.', cta: { label: 'Risikoübersicht', href: '/app/risks' } };
}

function CoreTile({ title, benefit, state, cta, testId }: TileState & { title: string; benefit: string; testId: string }) {
  return (
    <section className="rs-panel rs-start__tile" data-testid={testId}>
      <h2 className="rs-h3">{title}</h2>
      <p className="rs-start__tile-state">{state}</p>
      <p className="rs-note">{benefit}</p>
      {cta && (
        <Link to={cta.href} className="rs-start__step-link rs-start__tile-cta">
          {cta.label} →
        </Link>
      )}
    </section>
  );
}

function ResultsZone({
  facts,
  data,
  fallback,
}: {
  facts: StartPanelInput;
  data: CockpitData | null;
  fallback: { cta: string; href: string } | null;
}) {
  const score = data?.scoreStatus === 'ok' ? data.score : null;
  const evidence =
    data && !data.partialFailures.some((f) => f.startsWith('evidence-total:')) ? data.evidenceHealth.totalCount : null;
  const empty = score === null && !evidence && !facts.aiSystemCount;

  return (
    <section className="rs-start__results" aria-labelledby="start-results-title" data-testid="start-results">
      <h2 id="start-results-title" className="rs-overline">Ergebnisse & Nachweise</h2>
      {empty ? (
        <p className="rs-panel rs-start__results-empty" data-testid="start-results-empty">
          <span>
            Governance-Score, Nachweise und Risikoeinstufung erscheinen hier automatisch, sobald Ihr erster Scan und
            Ihr erstes KI-System vorliegen.
          </span>
          {fallback && (
            <Link to={fallback.href} className="rs-start__step-link">
              {fallback.cta} →
            </Link>
          )}
        </p>
      ) : (
        <ul className="rs-start__results-list">
          <ResultItem label="Governance-Score" value={score === null ? 'Noch keine Bewertung' : `${score} / 100`} href="/app/risks" />
          <ResultItem label="Nachweise" value={evidence === null ? '—' : plural(evidence, 'Eintrag', 'Einträge')} href="/app/evidence" />
          <ResultItem label="Hochrisiko-Systeme" value="Einstufung prüfen" href={HIGH_RISK_SYSTEMS_ROUTE} />
          <ResultItem label="Policies" value="Regeln verwalten" href="/app/policy-packs" />
        </ul>
      )}
    </section>
  );
}

function ResultItem({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <li>
      <Link to={href} className="rs-panel rs-start__result">
        <span className="rs-note">{label}</span>
        <span className="rs-start__result-value">{value}</span>
      </Link>
    </li>
  );
}
