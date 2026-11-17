import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { usePageMeta } from '../lib/usePageMeta';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  AREA_LABEL, AREAS, GOAL_LABEL, GOALS, SECTION_LABEL, recommend, validateAnswers,
  type Answers, type Area, type Goal, type Recommendation,
} from '../../shared/needs-check';
import { errorText, saveCheck, type ApiError } from '../features/needs-check/api';
import { currentStatusNote } from '../features/needs-check/currentStatus';
import { clearPending, readPending, writePending } from '../features/needs-check/pending';
import '../styles/needs-check.css';

/**
 * /check — Bedarfs-Check: Ziel → Bereich → Website → Ergebnis → nächster Schritt.
 *
 * Das Ergebnis beruht ausschließlich auf den Angaben des Nutzers. Die Website
 * wird hier nicht abgerufen; für eine technische Prüfung verweist der Check
 * auf /audit (eigener Ablauf, nicht Teil des gespeicherten Ergebnisses).
 *
 * Nach dem Speichern zeigt die Seite die Empfehlungen, die der Server
 * berechnet und gespeichert hat.
 */

type SaveState =
  | { s: 'idle' }
  | { s: 'saving' }
  | { s: 'saved'; id: string }
  | { s: 'error'; error: ApiError };

const STEPS = ['Ziel', 'Bereich', 'Website'] as const;

export function RecommendationList({ recs }: { recs: Recommendation[] }) {
  return (
    <ol className="nc-recs">
      {recs.map((r, i) => {
        const note = currentStatusNote(r.id);
        return (
          <li key={r.id} className="nc-rec">
            <span className="nc-rec-meta">{String(i + 1).padStart(2, '0')} · {SECTION_LABEL[r.section]}</span>
            <h2 className="nc-h2">{r.title}</h2>
            <p>{r.reason}</p>
            {note ? <p className="nc-status" data-testid={`nc-status-${r.id}`}>{note}</p> : null}
            <Link to={r.cta.href} className={i === 0 ? 'nc-btn' : 'nc-btn nc-btn--ghost'}>{r.cta.label}</Link>
          </li>
        );
      })}
    </ol>
  );
}

export function NeedsCheckPage() {
  usePageMeta({
    title: 'Kostenloser Bedarfs-Check — Was passt zu Ihrem Betrieb? | RealSync Dynamics & AI',
    description: 'Drei kurze Fragen, dann sehen Sie, welche Bausteine aus Build, Automate und Govern zu Ihrem Betrieb passen. Kostenlos, ohne Konto.',
    url: 'https://realsyncdynamicsai.de/check',
  });

  const { user, isLoading: authLoading } = useSupabaseAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resume = params.get('resume') === '1';

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [url, setUrl] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [save, setSave] = useState<SaveState>({ s: 'idle' });
  const resumedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const configured = isSupabaseConfigured();

  // Fokus auf die Überschrift jedes neuen Schritts / des Ergebnisses.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, answers]);

  const doSave = async (a: Answers) => {
    setSave({ s: 'saving' });
    const res = await saveCheck(a);
    if (res.ok) {
      clearPending();
      setSave({ s: 'saved', id: res.data.id });
    } else {
      setSave({ s: 'error', error: res.error });
    }
  };

  // Rückkehr nach der Anmeldung: begonnenen Ablauf wiederherstellen.
  useEffect(() => {
    if (!resume || resumedRef.current || authLoading) return;
    resumedRef.current = true;
    const p = readPending();
    if (!p) return;
    setGoal(p.answers.goal);
    setArea(p.answers.area);
    setHasWebsite(p.answers.hasWebsite);
    setUrl(p.answers.websiteUrl ?? '');
    setAnswers(p.answers);
    setStep(STEPS.length);
    if (p.wantsSave && user) void doSave(p.answers);
  }, [resume, authLoading, user]);

  const canNext = step === 0 ? goal !== null : step === 1 ? area !== null : hasWebsite !== null;

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    setFieldError('');
    if (!canNext) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const v = validateAnswers({ goal, area, hasWebsite, websiteUrl: url });
    if (!v.ok) {
      setFieldError(v.message);
      return;
    }
    setAnswers(v.answers);
    setSave({ s: 'idle' });
    setStep(STEPS.length);
  };

  const restart = () => {
    setAnswers(null);
    setSave({ s: 'idle' });
    setStep(0);
  };

  const saveOrLogin = () => {
    if (!answers) return;
    if (!user) {
      writePending({ answers, wantsSave: true });
      navigate(`/welcome?next=${encodeURIComponent('/check?resume=1')}`);
      return;
    }
    void doSave(answers);
  };

  const recs: Recommendation[] = answers ? recommend(answers) : [];

  return (
    <div className="nc">
      <header className="nc-top">
        <Link to="/" className="nc-brand">RealSync Dynamics &amp; AI</Link>
        {user ? <Link to="/check/ergebnisse" className="nc-toplink">Gespeicherte Ergebnisse</Link> : null}
      </header>

      <main className="nc-main" id="main">
        <p className="nc-eyebrow">Kostenloser Bedarfs-Check · ohne Konto</p>

        {!answers ? (
          <form onSubmit={next} className="nc-card" aria-describedby="nc-basis-note" noValidate>
            <ol className="nc-steps" aria-label="Fortschritt">
              {STEPS.map((label, i) => (
                <li key={label} className="nc-step" data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
                  <span aria-hidden="true">{i < step ? '✓' : i + 1}</span>{label}
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <fieldset className="nc-field">
                <legend><h1 ref={headingRef} tabIndex={-1} className="nc-h1">Was möchten Sie erreichen?</h1></legend>
                <div className="nc-options">
                  {GOALS.map((g) => (
                    <label key={g} className="nc-option" data-on={goal === g}>
                      <input type="radio" name="goal" value={g} checked={goal === g} onChange={() => setGoal(g)} />
                      <span>{GOAL_LABEL[g]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {step === 1 ? (
              <fieldset className="nc-field">
                <legend><h1 ref={headingRef} tabIndex={-1} className="nc-h1">In welchem Bereich arbeiten Sie?</h1></legend>
                <div className="nc-options nc-options--grid">
                  {AREAS.map((a) => (
                    <label key={a} className="nc-option" data-on={area === a}>
                      <input type="radio" name="area" value={a} checked={area === a} onChange={() => setArea(a)} />
                      <span>{AREA_LABEL[a]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {step === 2 ? (
              <fieldset className="nc-field">
                <legend><h1 ref={headingRef} tabIndex={-1} className="nc-h1">Gibt es schon eine Website?</h1></legend>
                <div className="nc-options">
                  <label className="nc-option" data-on={hasWebsite === true}>
                    <input type="radio" name="site" checked={hasWebsite === true} onChange={() => setHasWebsite(true)} />
                    <span>Ja</span>
                  </label>
                  <label className="nc-option" data-on={hasWebsite === false}>
                    <input type="radio" name="site" checked={hasWebsite === false} onChange={() => { setHasWebsite(false); setUrl(''); }} />
                    <span>Nein</span>
                  </label>
                </div>
                {hasWebsite ? (
                  <label className="nc-label">
                    Adresse (optional – wird nur gespeichert, wenn Sie das Ergebnis speichern; die Website wird nicht abgerufen)
                    <input
                      className="nc-input"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="ihr-betrieb.de"
                      value={url}
                      maxLength={300}
                      onChange={(e) => setUrl(e.target.value)}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? 'nc-field-error' : undefined}
                    />
                  </label>
                ) : null}
              </fieldset>
            ) : null}

            {fieldError ? <p id="nc-field-error" role="alert" className="nc-error">{fieldError}</p> : null}

            <div className="nc-actions">
              {step > 0 ? <button type="button" className="nc-btn nc-btn--ghost" onClick={() => setStep(step - 1)}>Zurück</button> : <span />}
              <button type="submit" className="nc-btn" disabled={!canNext} aria-disabled={!canNext}>
                {step < STEPS.length - 1 ? 'Weiter' : 'Ergebnis anzeigen'}
              </button>
            </div>
            <p id="nc-basis-note" className="nc-note">Das Ergebnis beruht auf Ihren Angaben. Ihre Website wird dabei nicht abgerufen.</p>
          </form>
        ) : (
          <section className="nc-card" aria-labelledby="nc-result-h">
            <div className="nc-result-head">
              <h1 id="nc-result-h" ref={headingRef} tabIndex={-1} className="nc-h1">Das passt zu Ihrem Betrieb</h1>
              <span className="nc-badge" data-testid="nc-basis">Grundlage: Ihre Angaben</span>
            </div>
            <p className="nc-summary">
              Ziel: {GOAL_LABEL[answers.goal]} · Bereich: {AREA_LABEL[answers.area]} · Website: {answers.hasWebsite ? (answers.websiteUrl ?? 'ja') : 'noch keine'}
            </p>

            <RecommendationList recs={recs} />

            {answers.hasWebsite ? (
              <div className="nc-block" data-testid="nc-audit-hint">
                <h2 className="nc-h2">Website technisch prüfen</h2>
                <p>
                  Dieses Ergebnis enthält keine technische Prüfung. Der kostenlose Scan läuft separat: Er ruft Ihre Website ab und prüft
                  Sicherheit, Einwilligung, Impressum und Datenschutzerklärung.
                </p>
                <Link to="/audit?source=needs-check" className="nc-link">Zum kostenlosen Scan →</Link>
              </div>
            ) : null}

            <div className="nc-block" aria-live="polite">
              <h2 className="nc-h2">Ergebnis speichern</h2>
              {save.s === 'saved' ? (
                <p role="status" data-testid="nc-saved">Gespeichert. <Link to={`/check/ergebnisse/${save.id}`} className="nc-link">Ergebnis öffnen</Link></p>
              ) : (
                <>
                  <p>{user ? 'Speichern Sie das Ergebnis in Ihrem Konto, um es später wieder aufzurufen.' : 'Zum Speichern melden Sie sich an. Ihre Angaben bleiben dabei erhalten.'}</p>
                  <button
                    type="button"
                    className="nc-btn nc-btn--ghost"
                    onClick={saveOrLogin}
                    disabled={!configured || save.s === 'saving' || authLoading}
                  >
                    {save.s === 'saving' ? 'Wird gespeichert …' : user ? 'Ergebnis speichern' : 'Anmelden und speichern'}
                  </button>
                  {!configured ? <p className="nc-note">Speichern ist hier nicht verfügbar: Die Verbindung zur Plattform ist nicht eingerichtet.</p> : null}
                  {save.s === 'error' ? <p role="alert" className="nc-error">{errorText(save.error)}</p> : null}
                </>
              )}
            </div>

            <div className="nc-actions">
              <button type="button" className="nc-btn nc-btn--ghost" onClick={restart}>Angaben ändern</button>
              <Link to="/pricing?source=needs-check" className="nc-link">Pakete vergleichen →</Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
