import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSupabaseAuth } from '../features/supabase/SupabaseAuthContext';
import { usePageMeta } from '../lib/usePageMeta';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  AREA_LABEL, AREAS, GOAL_LABEL, GOALS, SECTION_LABEL, recommend, validateAnswers,
  type Answers, type Area, type Goal, type Recommendation,
} from '../features/needs-check/model';
import { errorText, runWebsiteScan, saveCheck, type ApiError, type ScanSummary } from '../features/needs-check/api';
import { clearPending, readPending, writePending } from '../features/needs-check/pending';
import '../styles/needs-check.css';

/**
 * /check — Bedarfs-Check: Ziel → Bereich → Website → Ergebnis → nächster Schritt.
 *
 * Das Ergebnis beruht auf den Angaben des Nutzers. Eine technische Prüfung
 * der Website läuft nur, wenn er sie ausdrücklich startet; dann wird das
 * Ergebnis sichtbar als „Angaben + technische Prüfung“ gekennzeichnet.
 */

type SaveState =
  | { s: 'idle' }
  | { s: 'saving' }
  | { s: 'saved'; id: string }
  | { s: 'error'; error: ApiError };

type ScanState =
  | { s: 'idle' }
  | { s: 'running' }
  | { s: 'done'; data: ScanSummary }
  | { s: 'error'; error: ApiError };

const STEPS = ['Ziel', 'Bereich', 'Website'] as const;

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
  const [scan, setScan] = useState<ScanState>({ s: 'idle' });
  const [save, setSave] = useState<SaveState>({ s: 'idle' });
  const resumedRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const configured = isSupabaseConfigured();

  // Fokus auf die Überschrift jedes neuen Schritts / des Ergebnisses.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, answers]);

  const doSave = async (a: Answers, auditId: string | null) => {
    setSave({ s: 'saving' });
    const res = await saveCheck(a, recommend(a).map((r) => r.id), auditId);
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
    if (p.wantsSave && user) void doSave(p.answers, p.auditId);
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
    setScan({ s: 'idle' });
    setSave({ s: 'idle' });
    setStep(STEPS.length);
  };

  const restart = () => {
    setAnswers(null);
    setScan({ s: 'idle' });
    setSave({ s: 'idle' });
    setStep(0);
  };

  const startScan = async () => {
    if (!answers?.websiteUrl) return;
    setScan({ s: 'running' });
    const res = await runWebsiteScan(answers.websiteUrl);
    setScan(res.ok ? { s: 'done', data: res.data } : { s: 'error', error: res.error });
    setSave({ s: 'idle' });
  };

  const auditId = scan.s === 'done' ? scan.data.auditId : null;

  const saveOrLogin = () => {
    if (!answers) return;
    if (!user) {
      writePending({ answers, auditId, wantsSave: true });
      navigate(`/welcome?next=${encodeURIComponent('/check?resume=1')}`);
      return;
    }
    void doSave(answers, auditId);
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
                    Adresse (optional – nur nötig, wenn Sie sie später technisch prüfen lassen möchten)
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
              <span className="nc-badge" data-testid="nc-basis">
                {scan.s === 'done' ? 'Grundlage: Ihre Angaben + technische Prüfung' : 'Grundlage: Ihre Angaben'}
              </span>
            </div>
            <p className="nc-summary">
              Ziel: {GOAL_LABEL[answers.goal]} · Bereich: {AREA_LABEL[answers.area]} · Website: {answers.hasWebsite ? (answers.websiteUrl ?? 'ja') : 'noch keine'}
            </p>

            <ol className="nc-recs">
              {recs.map((r, i) => (
                <li key={r.id} className="nc-rec">
                  <span className="nc-rec-meta">{String(i + 1).padStart(2, '0')} · {SECTION_LABEL[r.section]}</span>
                  <h2 className="nc-h2">{r.title}</h2>
                  <p>{r.reason}</p>
                  {r.status ? <p className="nc-status">{r.status}</p> : null}
                  <Link to={r.cta.href} className={i === 0 ? 'nc-btn' : 'nc-btn nc-btn--ghost'}>{r.cta.label}</Link>
                </li>
              ))}
            </ol>

            {answers.websiteUrl ? (
              <div className="nc-block" aria-live="polite">
                <h2 className="nc-h2">Website technisch prüfen</h2>
                {scan.s === 'idle' ? (
                  <>
                    <p>Auf Wunsch ruft der kostenlose Scan {answers.websiteUrl} ab und prüft Sicherheit, Einwilligung, Impressum und Datenschutzerklärung. Höchstens 5 Prüfungen pro Stunde.</p>
                    <button type="button" className="nc-btn nc-btn--ghost" onClick={startScan} disabled={!configured}>Jetzt prüfen</button>
                    {!configured ? <p className="nc-note">Die Prüfung ist hier nicht verfügbar: Die Verbindung zur Plattform ist nicht eingerichtet.</p> : null}
                  </>
                ) : null}
                {scan.s === 'running' ? <p role="status">Website wird geprüft …</p> : null}
                {scan.s === 'error' ? (
                  <>
                    <p role="alert" className="nc-error">{errorText(scan.error)}</p>
                    <button type="button" className="nc-btn nc-btn--ghost" onClick={startScan}>Erneut versuchen</button>
                  </>
                ) : null}
                {scan.s === 'done' ? (
                  <div data-testid="nc-scan-result">
                    <p className="nc-score"><strong>{scan.data.score}</strong> von 100 · {scan.data.domain}</p>
                    {scan.data.issues.length ? (
                      <ul className="nc-issues">
                        {scan.data.issues.map((x) => (
                          <li key={x.title}><strong>{x.title}</strong> <span>{x.severity}{x.ref ? ` · ${x.ref}` : ''}</span></li>
                        ))}
                      </ul>
                    ) : <p>Keine Befunde in den geprüften Punkten.</p>}
                    {scan.data.coverageNotice ? <p className="nc-note">{scan.data.coverageNotice}</p> : null}
                    <Link to={`/audit/result/${scan.data.auditId}`} className="nc-link">Vollständigen Bericht öffnen →</Link>
                    <p className="nc-note">Technische Prüfung des ausgelieferten Codes – keine Rechtsberatung.</p>
                  </div>
                ) : null}
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
