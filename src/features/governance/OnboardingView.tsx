import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Circle, Download, Loader2, ShieldCheck,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { autoMapAsset, createAsset, saveAssetClassification } from './resourcesApi';
import { fetchAssetEvidenceStats, type DbGovernanceAsset } from './governanceApi';
import { downloadConformityDossier } from '../../lib/ai-act/conformityDossier';
import {
  obligationsFor,
  runFirstAudit,
  suggestClassification,
  TIER_LABEL,
  TIER_SUMMARY,
  USE_CASE_EXAMPLES,
  type ClassificationSuggestion,
  type FirstAuditResult,
  type SuggestedTier,
} from './onboarding/firstAuditModel';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import { RegistryWriteNotice, useCanEditRegistry } from './ai-registry/RegistryWriteAccess';
import './onboarding/first-audit.css';

/**
 * /app/onboarding — Compliance-Assistent statt SaaS-Wizard: in wenigen
 * Minuten vom ersten KI-System zum ersten Audit.
 *
 *   1. Anlegen        — Name + Einsatzzweck → create_asset (Klasse unbekannt)
 *   2. Klassifizieren — Ersteinordnung nach EU AI Act, anpassbar; „Nachweise
 *                       erzeugen“ speichert sie über classify_asset (später
 *                       im KI-Register jederzeit änderbar)
 *   3. Dokumentieren  — Kontrollen aus der Klasse ableiten (auto_map),
 *                       Annex-IV-Dossier als Download
 *   4. Auditieren     — Prüfpunkte aus echten Feldern + Nachweisen
 *   → Erfolgsmeldung mit nächsten Schritten
 *
 * Entscheidungen liegen in onboarding/firstAuditModel.ts (ohne React testbar).
 * Ingest-Keys und Policies bleiben unter /app/keys und /app/policies.
 *
 * Ohne owner/admin ist der Assistent nur zum Ansehen: Hinweis ab Schritt 1,
 * Registrieren gesperrt — der Server lehnt create_asset ohnehin ab.
 */
function _OnboardingView() {
  return <AuthGate>{(session) => <Inner session={session} />}</AuthGate>;
}

export const OnboardingView = withPerformanceMonitoring(
  _OnboardingView,
  'OnboardingView',
  { threshold: 500, maxRenders: 10 }
);

type Step = 'register' | 'classify' | 'evidence' | 'audit' | 'done';

const FLOW: ReadonlyArray<{ id: Exclude<Step, 'done'>; label: string }> = [
  { id: 'register', label: 'Anlegen' },
  { id: 'classify', label: 'Klassifizieren' },
  { id: 'evidence', label: 'Dokumentieren' },
  { id: 'audit', label: 'Auditieren' },
];

function Inner({ session }: { session: Session }) {
  const navigate = useNavigate();
  const { activeTenantId } = useTenant();
  const canEdit = useCanEditRegistry();
  const [step, setStep] = useState<Step>('register');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [asset, setAsset] = useState<DbGovernanceAsset | null>(null);

  const restart = () => {
    setName('');
    setDescription('');
    setAsset(null);
    setStep('register');
  };

  if (!activeTenantId) {
    return (
      <Shell step={step}>
        <p className="rs-note rs-fa__loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Workspace wird geladen …
        </p>
      </Shell>
    );
  }

  return (
    <Shell step={step}>
      {step === 'register' && (
        <RegisterStep
          tenantId={activeTenantId}
          ownerEmail={session?.user?.email ?? null}
          canEdit={canEdit}
          name={name}
          description={description}
          onChange={(n, d) => { setName(n); setDescription(d); }}
          onDone={(a) => { setAsset(a); setStep('classify'); }}
        />
      )}
      {step === 'classify' && asset && (
        <ClassifyStep asset={asset} onSaved={(a) => { setAsset(a); setStep('evidence'); }} />
      )}
      {step === 'evidence' && asset && (
        <EvidenceStep asset={asset} onDone={() => setStep('audit')} />
      )}
      {step === 'audit' && asset && (
        <AuditStep tenantId={activeTenantId} asset={asset} onDone={() => setStep('done')} />
      )}
      {step === 'done' && (
        <DoneStep onAnother={restart} onFinish={() => navigate('/app/dashboard')} />
      )}
    </Shell>
  );
}

/* ── Schritt 1: KI-System registrieren ─────────────────────────── */

function RegisterStep({
  tenantId, ownerEmail, canEdit, name, description, onChange, onDone,
}: {
  tenantId: string;
  ownerEmail: string | null;
  canEdit: boolean;
  name: string;
  description: string;
  onChange: (name: string, description: string) => void;
  onDone: (asset: DbGovernanceAsset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && description.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !canEdit || busy) return;
    setError(null);
    setBusy(true);
    const r = await createAsset({
      tenant_id: tenantId,
      asset_type: 'ai_system',
      name: name.trim(),
      description: description.trim(),
      intended_purpose: description.trim(),
      ai_act_class: 'unknown',
      owner_email: ownerEmail ?? undefined,
      metadata: { source: 'first_audit_onboarding' },
    });
    setBusy(false);
    if (!r.ok || !r.asset) {
      setError(r.error?.message ?? 'Das KI-System konnte nicht registriert werden.');
      return;
    }
    onDone(r.asset);
  };

  return (
    <StepCard
      index={1}
      title="KI-System hinzufügen"
      lead="Beschreiben Sie kurz, welche KI in Ihrem Unternehmen eingesetzt wird. Governance OS erstellt daraus automatisch die erste Dokumentation."
    >
      <div className="rs-fa__examples">
        <span className="rs-note">Beispiele:</span>
        <ul>
          {USE_CASE_EXAMPLES.map((ex) => (
            <li key={ex.label}>
              <button
                type="button"
                className="rs-fa__example"
                onClick={() => onChange(ex.name, ex.description)}
                aria-label={`Beispiel übernehmen: ${ex.label}`}
              >
                {ex.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={submit} className="rs-fa__form">
        <label className="rs-field">
          Name des KI-Systems
          <input
            className="rs-field__input"
            type="text"
            required
            maxLength={200}
            value={name}
            onChange={(e) => onChange(e.target.value, description)}
            placeholder="z. B. Kundenservice-Chatbot"
            autoFocus
          />
        </label>
        <label className="rs-field">
          Beschreibung — Wofür wird dieses System eingesetzt?
          <textarea
            className="rs-field__input rs-fa__textarea"
            required
            maxLength={2000}
            rows={3}
            value={description}
            onChange={(e) => onChange(name, e.target.value)}
            placeholder="Beantwortet Kundenanfragen auf unserer Website."
          />
        </label>
        {error && <p role="alert" className="rs-fa__error">{error}</p>}
        {!canEdit && <RegistryWriteNotice className="rs-fa__hint" />}
        <div className="rs-fa__actions">
          <button type="submit" className="rs-fa__cta" disabled={!ready || !canEdit || busy}>
            {busy ? 'Wird registriert …' : 'System registrieren'}
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </form>
    </StepCard>
  );
}

/* ── Schritt 2: Risiko-Klassifizierung ─────────────────────────── */

const TIER_OPTIONS: readonly SuggestedTier[] = ['minimal', 'limited', 'high', 'prohibited'];

function ClassifyStep({
  asset, onSaved,
}: {
  asset: DbGovernanceAsset;
  onSaved: (asset: DbGovernanceAsset) => void;
}) {
  const [suggestion, setSuggestion] = useState<ClassificationSuggestion | null>(null);
  const [tier, setTier] = useState<SuggestedTier>('limited');
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assess = () => {
    const s = suggestClassification(asset.name, asset.intended_purpose ?? asset.description ?? '');
    setSuggestion(s);
    setTier(s.tier);
  };

  const save = async () => {
    if (!suggestion) return;
    setError(null);
    setBusy(true);
    const r = await saveAssetClassification({ asset_id: asset.id, ai_act_class: tier });
    setBusy(false);
    if (!r.ok || !r.asset) {
      setError(r.error?.message ?? 'Die Einstufung konnte nicht gespeichert werden.');
      return;
    }
    onSaved(r.asset);
  };

  const adjusted = suggestion !== null && tier !== suggestion.tier;

  return (
    <StepCard
      index={2}
      title="Risikoeinstufung starten"
      lead={`Governance OS analysiert „${asset.name}“ anhand des EU AI Act und schlägt eine erste Risikoeinstufung vor.`}
    >
      <p className="rs-fa__hint">Sie können alle Angaben später im KI-Register anpassen.</p>

      {!suggestion ? (
        <div className="rs-fa__actions">
          <button type="button" className="rs-fa__cta" onClick={assess}>
            Risikobewertung durchführen <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <section
          className={`rs-fa__result rs-fa__result--${tier}`}
          aria-labelledby="fa-result-title"
          data-testid="onboarding-classification"
        >
          <span className="rs-overline">{adjusted ? 'Angepasste Einstufung' : 'Vorläufige Einstufung'}</span>
          <h3 id="fa-result-title" className="rs-fa__result-title">{TIER_LABEL[tier]}</h3>
          <p className="rs-fa__result-text">{TIER_SUMMARY[tier]}</p>
          {suggestion.needsReview && !adjusted && (
            <p className="rs-note" data-testid="onboarding-needs-review">
              Aus der Beschreibung ließ sich keine eindeutige Kategorie ableiten — die Einstufung ist bewusst
              vorsichtig gewählt. Bitte prüfen Sie sie in den Details.
            </p>
          )}

          {showDetails && (
            <div id="fa-details" className="rs-fa__details">
              <dl>
                <dt>Begründung des Vorschlags</dt>
                <dd>
                  {suggestion.rationale}
                  {suggestion.articleRef !== '—' && <span className="rs-mono"> · {suggestion.articleRef}</span>}
                </dd>
                <dt>Pflichten bei „{TIER_LABEL[tier]}“</dt>
                <dd>
                  <ul>
                    {obligationsFor(tier).map((o) => (
                      <li key={`${o.article}-${o.de}`}>
                        <span className="rs-mono">{o.article}</span> {o.de}
                      </li>
                    ))}
                  </ul>
                </dd>
              </dl>
              <label className="rs-field">
                Einstufung anpassen
                <select
                  className="rs-select"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as SuggestedTier)}
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}{t === suggestion.tier ? ' (Vorschlag)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rs-note">
                Technische Ersteinordnung, keine Rechtsberatung. Die verbindliche Einstufung prüfen Sie mit Ihrer
                Rechts- oder Datenschutzberatung.
              </p>
            </div>
          )}

          {error && <p role="alert" className="rs-fa__error">{error}</p>}

          <div className="rs-fa__actions">
            <button
              type="button"
              className="rs-fa__secondary"
              aria-expanded={showDetails}
              aria-controls="fa-details"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? 'Details ausblenden' : 'Details ansehen'}
              <ChevronDown className={`h-4 w-4 ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <button type="button" className="rs-fa__cta" onClick={save} disabled={busy}>
              {busy ? 'Wird gespeichert …' : 'Nachweise erzeugen'}
              {busy
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </section>
      )}
    </StepCard>
  );
}

/* ── Schritt 3: Nachweise erzeugen ─────────────────────────────── */

type DocsState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; mapped: number | null; error: string | null };

function EvidenceStep({ asset, onDone }: { asset: DbGovernanceAsset; onDone: () => void }) {
  const [docs, setDocs] = useState<DocsState>({ status: 'idle' });
  const tier = asset.ai_act_class === 'unknown' ? null : asset.ai_act_class;

  const generate = async () => {
    setDocs({ status: 'busy' });
    const r = await autoMapAsset(asset.id);
    setDocs({
      status: 'done',
      mapped: r.ok ? (r.applied ?? 0) : null,
      error: r.ok ? null : (r.error?.message ?? 'Kontrollen konnten nicht zugeordnet werden.'),
    });
  };

  const downloadDossier = () =>
    downloadConformityDossier({
      system: {
        name: asset.name,
        provider: asset.vendor,
        riskLabel: tier ? TIER_LABEL[tier] : 'Nicht bestimmt',
        intendedPurpose: asset.intended_purpose ?? asset.description,
        owner: asset.owner_email,
      },
      changeLog: [`${new Date(asset.created_at).toLocaleString('de-DE')}: KI-System angelegt und eingestuft`],
    });

  const done = docs.status === 'done';
  const items: Array<{ label: string; detail: string; ok: boolean }> = [
    { label: 'Systembeschreibung', detail: `„${asset.name}“ mit Einsatzzweck gespeichert`, ok: true },
    {
      label: 'Verantwortlichkeiten',
      detail: asset.owner_email ? `Verantwortlich: ${asset.owner_email}` : 'Noch keine verantwortliche Person — im KI-Register ergänzen',
      ok: !!asset.owner_email,
    },
    {
      label: 'Risikobewertung',
      detail: done && docs.mapped !== null
        ? `${tier ? TIER_LABEL[tier] : 'Einstufung'} · ${docs.mapped} Prüfkontrollen zugeordnet`
        : `${tier ? TIER_LABEL[tier] : 'Einstufung'} gespeichert`,
      ok: !done || docs.mapped !== null,
    },
    { label: 'Änderungsverlauf', detail: 'Anlage und Einstufung mit Zeitstempel protokolliert', ok: true },
    { label: 'Audit-Protokoll', detail: 'Jede weitere Änderung landet im Audit-Log Ihres Workspace', ok: true },
  ];

  return (
    <StepCard
      index={3}
      title="Audit-Nachweise vorbereiten"
      lead="Governance OS erstellt die Dokumentation und Nachweise für dieses KI-System aus Ihren Angaben."
    >
      <p className="rs-overline">Enthalten</p>
      <ul className="rs-fa__checklist" data-testid="onboarding-evidence-items">
        {items.map((it) => {
          const state = !done ? 'planned' : it.ok ? 'done' : 'open';
          return (
            <li key={it.label} className={`rs-fa__check rs-fa__check--${state}`}>
              <span className="rs-fa__check-icon" aria-hidden="true">
                {state === 'open' ? <Circle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              </span>
              <span>
                <span className="rs-fa__check-label">
                  {it.label}
                  <span className="sr-only">
                    {state === 'done' ? ' – erstellt' : state === 'open' ? ' – offen' : ' – wird erstellt'}
                  </span>
                </span>
                {done && <span className="rs-fa__check-detail">{it.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {done && docs.error && (
        <p role="alert" className="rs-fa__error">
          {docs.error} Das System ist gespeichert; Kontrollen können Sie später im KI-Register zuordnen.
        </p>
      )}

      <div className="rs-fa__actions">
        {!done ? (
          <button type="button" className="rs-fa__cta" onClick={generate} disabled={docs.status === 'busy'}>
            {docs.status === 'busy' ? 'Dokumentation wird erzeugt …' : 'Dokumentation erzeugen'}
            {docs.status === 'busy'
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : (
          <>
            <button type="button" className="rs-fa__cta" onClick={onDone}>
              Weiter zum Audit <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="rs-fa__secondary" onClick={downloadDossier}>
              <Download className="h-4 w-4" aria-hidden="true" /> Dossier herunterladen
            </button>
          </>
        )}
      </div>
    </StepCard>
  );
}

/* ── Schritt 4: Erstes Audit ───────────────────────────────────── */

function AuditStep({
  tenantId, asset, onDone,
}: { tenantId: string; asset: DbGovernanceAsset; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FirstAuditResult | null>(null);

  const run = async () => {
    setBusy(true);
    const evidence = await fetchAssetEvidenceStats(tenantId)
      .then((m) => m.get(asset.id) ?? { count: 0, latestAt: null })
      .catch(() => null);
    setResult(runFirstAudit(asset, evidence));
    setBusy(false);
  };

  return (
    <StepCard
      index={4}
      title="Audit starten"
      lead="Prüfen Sie Ihr KI-System auf Vollständigkeit, Compliance und Dokumentationsstatus."
    >
      {!result ? (
        <div className="rs-fa__actions">
          <button type="button" className="rs-fa__cta" onClick={run} disabled={busy}>
            {busy ? 'Audit läuft …' : 'Audit ausführen'}
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      ) : (
        <section className="rs-fa__audit" aria-label="Audit-Ergebnis" data-testid="onboarding-audit-result">
          <div className="rs-fa__score">
            <span className="rs-note">Audit-Score</span>
            <span className="rs-fa__score-value">
              {result.score === null ? '—' : <>{result.score}<small> / 100</small></>}
            </span>
            <span className="rs-note">
              {result.score === null
                ? 'Nachweise konnten nicht geladen werden — kein Score ohne Datenbasis.'
                : `${result.checks.filter((c) => c.passed).length} von ${result.checks.length} Prüfpunkten erfüllt`}
            </span>
          </div>
          <dl className="rs-fa__findings">
            <div>
              <dt>Dokumentation vollständig</dt>
              <dd>{result.documentationComplete ? 'Ja' : 'Noch nicht'}</dd>
            </div>
            <div>
              <dt>Offene Risiken</dt>
              <dd>
                {result.openRisks.length === 0 ? 'Keine' : (
                  <ul>{result.openRisks.map((r) => <li key={r}>{r}</li>)}</ul>
                )}
              </dd>
            </div>
            <div>
              <dt>Fehlende Angaben</dt>
              <dd>
                {result.missing.length === 0 ? 'Keine' : (
                  <ul>{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
                )}
              </dd>
            </div>
          </dl>
          <div className="rs-fa__actions">
            <button type="button" className="rs-fa__cta" onClick={onDone}>
              Einrichtung abschließen <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            {result.missing.length > 0 && (
              <Link to={`/app/ai-systems/${asset.id}`} className="rs-fa__link">
                Fehlende Angaben ergänzen
              </Link>
            )}
          </div>
        </section>
      )}
    </StepCard>
  );
}

/* ── Erfolgsmeldung ────────────────────────────────────────────── */

function DoneStep({ onAnother, onFinish }: { onAnother: () => void; onFinish: () => void }) {
  return (
    <section className="rs-panel rs-fa__card rs-fa__done" aria-labelledby="fa-done-title" data-testid="onboarding-done">
      <span className="rs-fa__done-icon" aria-hidden="true"><ShieldCheck className="h-6 w-6" /></span>
      <h2 id="fa-done-title" className="rs-fa__title">Governance eingerichtet</h2>
      <p className="rs-fa__lead">
        Ihr erstes KI-System wurde erfolgreich registriert. Governance OS verfolgt nun Änderungen, Dokumentation
        und Compliance-Status dieses Systems.
      </p>
      <p className="rs-overline">Nächste Schritte</p>
      <ul className="rs-fa__next">
        <li><button type="button" className="rs-fa__link" onClick={onAnother}>Weitere Systeme erfassen</button></li>
        <li><Link to="/app/websites" className="rs-fa__link">Website verbinden</Link></li>
        <li><Link to="/app/audit" className="rs-fa__link">Audit-Bericht exportieren</Link></li>
      </ul>
      <div className="rs-fa__actions">
        <button type="button" className="rs-fa__cta" onClick={onFinish}>
          Zum Dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="rs-note">
        Für Entwickler: Ereignisse aus eigenen Anwendungen binden Sie über einen{' '}
        <Link to="/app/keys" className="rs-fa__link">Ingest-Key</Link> an.
      </p>
    </section>
  );
}

/* ── Rahmen ────────────────────────────────────────────────────── */

function Shell({ step, children }: { step: Step; children: React.ReactNode }) {
  const current = step === 'done' ? FLOW.length : FLOW.findIndex((s) => s.id === step);
  return (
    <div className="rs-apppage rs-fa" data-testid="first-audit-onboarding">
      <header className="rs-fa__head">
        <Link to="/app/dashboard" className="rs-fa__back">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
        </Link>
        <div>
          <p className="rs-overline">Governance OS · Erstes Audit</p>
          <p className="rs-note">Anlegen → Klassifizieren → Dokumentieren → Auditieren · ca. 3 Minuten</p>
        </div>
      </header>
      <ol className="rs-fa__progress" aria-label="Fortschritt">
        {FLOW.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo';
          return (
            <li
              key={s.id}
              className={`rs-fa__progress-step rs-fa__progress-step--${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="rs-fa__progress-dot" aria-hidden="true">
                {state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <main className="rs-fa__main">{children}</main>
    </div>
  );
}

function StepCard({
  index, title, lead, children,
}: { index: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="rs-panel rs-fa__card" aria-labelledby={`fa-step-${index}`}>
      <p className="rs-overline rs-cyan">Schritt {index} von {FLOW.length}</p>
      <h2 id={`fa-step-${index}`} className="rs-fa__title">{title}</h2>
      <p className="rs-fa__lead">{lead}</p>
      {children}
    </section>
  );
}
