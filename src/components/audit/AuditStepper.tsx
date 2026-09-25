/**
 * Free Audit — Stepper aus dem Governance-OS-Handoff v2 (§ 3).
 *
 * Vier Fragen (Unternehmen + Domain, Rahmenwerke, KI-Systeme, Rolle), dann
 * Lauf und Ergebnis. Der Score kommt AUSSCHLIESSLICH aus dem echten
 * `gdpr-audit`-Scan (über `onRun` in AuditLanding) — die Score-Formel und das
 * getaktete Log des Prototyps sind bewusst nicht übernommen. Das Log zeigt
 * nur Ereignisse, die tatsächlich stattfinden (Anfrage gesendet, Antwort da,
 * Fehler).
 *
 * Rahmenwerke, Systeme und Rolle bleiben im Browser: Sie steuern die
 * Plan-Empfehlung, werden aber nicht gespeichert (dafür gibt es noch kein
 * Backend-Feld).
 */
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check } from 'lucide-react';
import '../../styles/governance-os-handoff.css';
import { useLang } from '../../i18n/useLang';
import type { HandoffKey } from '../../i18n/handoff';
import { enforcementClassOf } from '../../../shared/enforcement-classes';
import { formatPriceEur, tierById, type TierId } from '../../config/pricing';

export interface AuditStepperIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  paragraph_ref?: string;
}

export interface AuditStepperReport {
  domain: string;
  score: number;
  issues: AuditStepperIssue[];
}

export interface AuditStepperInput {
  domain: string;
  email: string;
  company: string;
}

type Role = 'self' | 'team' | 'agency' | 'enterprise';

const FRAMEWORKS: ReadonlyArray<{ id: string; label: string; comingSoon?: boolean }> = [
  { id: 'dsgvo', label: 'DSGVO' },
  { id: 'ai_act', label: 'EU AI Act' },
  { id: 'iso27001', label: 'ISO 27001' },
  { id: 'iso42001', label: 'ISO 42001' },
  { id: 'nis2', label: 'NIS2' },
  // Registry: TISAX/DORA sind Coming Soon — wählbar erst, wenn Packs live sind.
  { id: 'tisax_dora', label: 'TISAX / DORA', comingSoon: true },
];

/** Systemtypen aus shared/enforcement-classes.ts — die Klasse wird dort abgeleitet. */
const SYSTEMS: ReadonlyArray<{ id: string; systemType: string; de: string; en: string; highRisk?: boolean }> = [
  { id: 'chatbot', systemType: 'chatbot', de: 'Website-Chatbot', en: 'Website chatbot' },
  { id: 'm365', systemType: 'microsoft365', de: 'Microsoft 365 Copilot', en: 'Microsoft 365 Copilot' },
  { id: 'hr', systemType: 'sdk_preflight', de: 'HR-Screening', en: 'HR screening', highRisk: true },
  { id: 'scoring', systemType: 'custom_api', de: 'Scoring über eigene API', en: 'Scoring via own API', highRisk: true },
  { id: 'code', systemType: 'cicd_gate', de: 'Code-Agent in CI/CD', en: 'Code agent in CI/CD' },
  { id: 'chatgpt', systemType: 'browser_direct', de: 'ChatGPT im Browser', en: 'ChatGPT in the browser' },
];

const ROLES: ReadonlyArray<{ id: Role; key: HandoffKey }> = [
  { id: 'self', key: 'roleSelf' },
  { id: 'team', key: 'roleTeam' },
  { id: 'agency', key: 'roleAgency' },
  { id: 'enterprise', key: 'roleEnterprise' },
];

const STEP_KEYS: readonly HandoffKey[] = ['stepCompany', 'stepFrameworks', 'stepSystems', 'stepRole', 'stepResult'];
const QUESTIONS: ReadonlyArray<[HandoffKey, HandoffKey]> = [
  ['q0', 'q0hint'],
  ['q1', 'q1hint'],
  ['q2', 'q2hint'],
  ['q3', 'q3hint'],
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Plan-Empfehlung aus Rolle, Rahmenwerken und Systemen (Handoff-Regel):
 * Konzern → Enterprise, Agentur → Agency, ISO/NIS2 oder Hochrisiko → Growth,
 * sonst Starter. Unabhängig vom Score.
 */
export function recommendPlan(role: Role | null, frameworks: readonly string[], systems: readonly string[]): TierId {
  if (role === 'enterprise') return 'enterprise';
  if (role === 'agency') return 'agency';
  const needsGrowth =
    frameworks.some((f) => f === 'iso27001' || f === 'iso42001' || f === 'nis2') ||
    systems.some((id) => SYSTEMS.find((s) => s.id === id)?.highRisk);
  return needsGrowth ? 'growth' : 'starter';
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--color-rs-success)';
  if (score >= 50) return 'var(--color-rs-warning)';
  return 'var(--color-rs-danger)';
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <div className="rs-ring" role="img" aria-label={`${label}: ${clamped} / 100`} data-testid="audit-score-ring">
      <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--color-rs-bg-2)" strokeWidth="10" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={scoreColor(clamped)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="rs-ring__value">
        {clamped}
        <small>/ 100</small>
      </div>
    </div>
  );
}

export function AuditStepper({
  initialDomain,
  running,
  error,
  report,
  onRun,
  onReset,
}: {
  initialDomain: string;
  running: boolean;
  error: string | null;
  report: AuditStepperReport | null;
  onRun: (input: AuditStepperInput) => void;
  onReset: () => void;
}) {
  const { t, lang } = useLang();
  const formId = useId();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState(initialDomain);
  const [email, setEmail] = useState('');
  const [frameworks, setFrameworks] = useState<string[]>(['dsgvo', 'ai_act']);
  const [systems, setSystems] = useState<string[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [started, setStarted] = useState(false);

  const stepValid = [
    domain.trim().length > 2 && EMAIL_RE.test(email.trim()),
    frameworks.length > 0,
    true,
    role !== null,
  ];

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const start = () => {
    setStarted(true);
    setStep(4);
    onRun({ domain: domain.trim(), email: email.trim(), company: company.trim() });
  };

  const next = (event?: FormEvent) => {
    event?.preventDefault();
    if (step < 3 && stepValid[step]) setStep(step + 1);
    else if (step === 3 && stepValid[3]) start();
  };

  const back = () => {
    if (step === 4) {
      if (running) return;
      onReset();
      setStarted(false);
      setStep(3);
      return;
    }
    if (step > 0) setStep(step - 1);
  };

  const newScan = () => {
    onReset();
    setStarted(false);
    setStep(0);
  };

  const done = Boolean(report);
  const log: HandoffKey[] = started ? ['runStart', 'runRequest', 'runWaiting'] : [];
  if (started && report) log.push('runDone');
  if (started && error && !running) log.push('runFailed');

  const recommended = tierById(recommendPlan(role, frameworks, systems));
  const topRisks = (report?.issues ?? [])
    .filter((i) => i.severity === 'critical' || i.severity === 'high')
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="rs-audit">
      <aside className="rs-audit__side">
        <p className="rs-overline">{t('auditOverline')}</p>
        <h1 className="rs-audit__title">{t('auditTitle')}</h1>
        <ol className="rs-steps" aria-label={t('auditTitle')}>
          {STEP_KEYS.map((key, i) => {
            const isDone = i < step || (i === 4 && done);
            const isActive = i === step && !(i === 4 && done);
            return (
              <li
                key={key}
                className={`rs-step${isActive ? ' rs-step--active' : ''}${isDone ? ' rs-step--done' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="rs-step__dot" aria-hidden="true">
                  {isDone ? <Check size={13} /> : i + 1}
                </span>
                {t(key)}
              </li>
            );
          })}
        </ol>
        <div className="rs-audit__side-links">
          <Link to="/legal/methodology">Methodik</Link>
          <Link to="/grenzen">Grenzen</Link>
          <Link to="/legal/privacy">Datenschutz</Link>
        </div>
      </aside>

      <section className="rs-audit__main" aria-live="polite">
        <form id={formId} className="rs-audit__body" onSubmit={next} noValidate>
          {step < 4 && (
            <>
              <h2 className="rs-audit__q">{t(QUESTIONS[step][0])}</h2>
              <p className="rs-audit__hint">{t(QUESTIONS[step][1])}</p>
            </>
          )}

          {step === 0 && (
            <div className="rs-audit__fields">
              <div>
                <label htmlFor="audit-company" className="rs-overline rs-label">{t('companyLabel')}</label>
                <input
                  id="audit-company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  className="rs-input rs-input--h48"
                  placeholder={t('companyPlaceholder')}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="audit-domain" className="rs-overline rs-label">{t('domainLabel')}</label>
                <input
                  id="audit-domain"
                  name="domain"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  required
                  className="rs-input rs-input--h48"
                  placeholder={t('domainPlaceholder')}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.slice(0, 255))}
                />
              </div>
              <div>
                <label htmlFor="audit-email" className="rs-overline rs-label">{t('reportEmailLabel')}</label>
                <input
                  id="audit-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="rs-input rs-input--h48"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby="audit-email-hint"
                />
                <p id="audit-email-hint" className="rs-audit__hint" style={{ fontSize: 13, marginTop: 6 }}>
                  {t('reportEmailHint')}
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="rs-audit__options" role="group" aria-label={t('stepFrameworks')}>
              {FRAMEWORKS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="rs-option"
                  aria-pressed={frameworks.includes(f.id)}
                  disabled={f.comingSoon}
                  onClick={() => setFrameworks((list) => toggle(list, f.id))}
                >
                  {f.label}
                  {f.comingSoon && <span className="rs-class-tag">{t('comingSoon')}</span>}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="rs-audit__options rs-audit__options--grid" role="group" aria-label={t('stepSystems')}>
              {SYSTEMS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="rs-option"
                  aria-pressed={systems.includes(s.id)}
                  onClick={() => setSystems((list) => toggle(list, s.id))}
                >
                  <span>{lang === 'de' ? s.de : s.en}</span>
                  <span className="rs-option__meta">
                    <span className="rs-class-tag">
                      {t('classPrefix')} {enforcementClassOf(s.systemType)}
                    </span>
                    {s.highRisk && <span className="rs-risk-tag">{t('highRisk')}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="rs-audit__options rs-audit__options--grid" role="radiogroup" aria-label={t('stepRole')}>
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  className="rs-option"
                  aria-checked={role === r.id}
                  onClick={() => setRole(r.id)}
                >
                  {t(r.key)}
                </button>
              ))}
            </div>
          )}

          {step === 4 && !done && (
            <div data-testid="audit-run">
              <h2 className="rs-audit__q">{running ? t('running') : t('runFailed')}</h2>
              <p className="rs-audit__hint">{domain.trim()}</p>
              <div className="rs-progress" aria-hidden="true">
                <div className={`rs-progress__bar${running ? ' rs-progress__bar--indeterminate' : ''}`} style={running ? undefined : { width: '100%', opacity: 0.35 }} />
              </div>
              <ul className="rs-log" aria-label={t('running')}>
                {log.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
              {error && !running && (
                <div className="rs-alert" role="alert" style={{ marginTop: 16 }}>
                  <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 4 && report && (
            <div data-testid="audit-result">
              <h2 className="rs-audit__q">{t('scoreLabel')}</h2>
              <p className="rs-audit__hint">{t('scoreSource', { domain: report.domain })}</p>
              <div className="rs-result">
                <ScoreRing score={report.score} label={t('scoreLabel')} />
                <div>
                  <h3 className="rs-overline" style={{ color: 'var(--color-rs-fg-1)' }}>{t('resultTitle')}</h3>
                  {topRisks.length > 0 ? (
                    <ul className="rs-risks">
                      {topRisks.map((issue) => (
                        <li key={issue.id} className="rs-risk">
                          <AlertTriangle
                            size={16}
                            aria-hidden="true"
                            color={issue.severity === 'critical' ? 'var(--color-rs-danger)' : 'var(--color-rs-warning)'}
                          />
                          <div>
                            <div>{issue.title}</div>
                            {issue.paragraph_ref && <div className="rs-risk__ref">{issue.paragraph_ref}</div>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rs-audit__hint">{t('noCriticalRisks')}</p>
                  )}
                  {recommended && (
                    <div className="rs-rec" data-testid="audit-plan-recommendation">
                      <p className="rs-overline" style={{ color: 'var(--color-rs-primary-light)' }}>{t('recPlan')}</p>
                      <p style={{ marginTop: 6, fontSize: 18, fontWeight: 600, color: 'var(--color-rs-fg-0)' }}>
                        {recommended.name} ·{' '}
                        {recommended.priceOnRequest
                          ? t('onRequest')
                          : `${formatPriceEur(recommended.priceEur)} ${t('perMonth')}`}
                      </p>
                      <p className="rs-audit__hint" style={{ fontSize: 13, marginTop: 4 }}>{t('recWhy')}</p>
                      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                        <Link to={`/pricing?plan=${recommended.id}`} className="rs-btn rs-btn--outline rs-btn--h40">
                          {t('toPlan')}
                        </Link>
                        <a href="#report" className="rs-btn rs-btn--outline rs-btn--h40">{t('fullReport')}</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="rs-audit__footer">
          <p className="rs-audit__foot-note">
            {t('auditFoot')}{' '}
            <Link to="/legal/privacy">{t('moreInfo')}</Link>
          </p>
          <div className="rs-audit__actions">
            {step === 4 && done ? (
              <>
                <button type="button" className="rs-btn rs-btn--outline rs-btn--h44" onClick={newScan}>
                  {t('retry')}
                </button>
                <Link to="/app/dashboard" className="rs-btn rs-btn--primary rs-btn--h44">
                  {t('toDash')}
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rs-btn rs-btn--outline rs-btn--h44"
                  onClick={back}
                  disabled={step === 0 || running}
                >
                  {t('back')}
                </button>
                {step < 4 && (
                  <button
                    type="submit"
                    form={formId}
                    className="rs-btn rs-btn--primary rs-btn--h44"
                    disabled={!stepValid[step]}
                    data-testid={step === 3 ? 'audit-start' : 'audit-next'}
                  >
                    {step === 3 ? t('start') : t('next')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
