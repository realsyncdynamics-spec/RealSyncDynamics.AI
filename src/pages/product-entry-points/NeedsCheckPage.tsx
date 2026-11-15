import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { LandingHeader } from '../../components/landing/LandingShell';
import { usePageMeta } from '../../lib/usePageMeta';
import { useSupabaseAuth } from '../../features/supabase/SupabaseAuthContext';
import {
  NEEDS_GOAL_LABEL,
  NEEDS_PILLAR_LABEL,
  NEEDS_QUESTIONS,
  deriveNeedsResult,
  parseNeedsAnswers,
  type NeedsAnswers,
  type NeedsQuestionId,
} from '@/shared/needs-check';
import { clearNeedsDraft, readNeedsDraft, writeNeedsDraft } from '../../features/needs-check/draft';
import {
  NeedsCheckApiError,
  deleteNeedsCheck,
  listNeedsChecks,
  saveNeedsCheck,
  type SavedNeedsCheck,
} from '../../features/needs-check/api';

/**
 * /check — Bedarfs-Check: drei Fragen, eine Empfehlung, passender nächster Schritt.
 *
 * Das Ergebnis beruht nur auf den Angaben des Nutzers (`shared/needs-check.ts`).
 * Diese Seite ruft keine Website ab und prüft nichts technisch; die technische
 * Prüfung bleibt der bestehende Website-Check unter `/audit`.
 *
 * Speichern: nur für angemeldete Nutzer, über RLS auf `needs_check_results`.
 * „Gespeichert“ erscheint erst, wenn das Backend die Zeile zurückgegeben hat.
 * Der begonnene Check bleibt über die Anmeldung erhalten (`draft.ts`).
 */

type Selection = Partial<Record<NeedsQuestionId, string>>;

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

type ListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; items: SavedNeedsCheck[] }
  | { kind: 'error'; message: string };

const LOGIN_HREF = `/welcome?next=${encodeURIComponent('/check')}`;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof NeedsCheckApiError ? error.message : fallback;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE');
}

export function NeedsCheckPage() {
  usePageMeta({
    title: 'Bedarfs-Check — drei Fragen, eine Empfehlung',
    description:
      'Drei kurze Fragen zu Ziel, Bereich und Website. Das Ergebnis beruht auf Ihren Angaben und zeigt den passenden nächsten Schritt bei RealSyncDynamics.AI.',
    url: 'https://realsyncdynamicsai.de/check',
  });

  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [selection, setSelection] = useState<Selection>({});
  const [answers, setAnswers] = useState<NeedsAnswers | null>(null);
  const [formError, setFormError] = useState('');
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [list, setList] = useState<ListState>({ kind: 'idle' });
  const resultHeading = useRef<HTMLHeadingElement>(null);

  // Begonnenen Check nach Neuladen oder Anmeldung wieder aufnehmen.
  useEffect(() => {
    const draft = readNeedsDraft();
    if (draft) {
      setSelection(draft);
      setAnswers(draft);
    }
  }, []);

  const loadSaved = useCallback(async () => {
    setList({ kind: 'loading' });
    try {
      setList({ kind: 'ready', items: await listNeedsChecks() });
    } catch (error) {
      setList({ kind: 'error', message: messageOf(error, 'Gespeicherte Ergebnisse konnten nicht geladen werden.') });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void loadSaved();
    else setList({ kind: 'idle' });
  }, [isAuthenticated, loadSaved]);

  function choose(question: NeedsQuestionId, value: string) {
    setSelection((current) => ({ ...current, [question]: value }));
    setFormError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseNeedsAnswers(selection);
    if (!parsed) {
      setFormError('Bitte beantworten Sie alle drei Fragen.');
      return;
    }
    setFormError('');
    setAnswers(parsed);
    setSave({ kind: 'idle' });
    writeNeedsDraft(parsed);
    window.requestAnimationFrame(() => resultHeading.current?.focus());
  }

  function restart() {
    clearNeedsDraft();
    setSelection({});
    setAnswers(null);
    setFormError('');
    setSave({ kind: 'idle' });
  }

  async function saveResult() {
    if (!answers || save.kind === 'saving') return;
    setSave({ kind: 'saving' });
    try {
      const saved = await saveNeedsCheck(answers);
      setSave({ kind: 'saved', at: saved.createdAt });
      clearNeedsDraft();
      void loadSaved();
    } catch (error) {
      setSave({ kind: 'error', message: messageOf(error, 'Das Ergebnis konnte nicht gespeichert werden.') });
    }
  }

  function openSaved(item: SavedNeedsCheck) {
    setSelection(item.answers);
    setAnswers(item.answers);
    setSave({ kind: 'saved', at: item.createdAt });
    window.requestAnimationFrame(() => resultHeading.current?.focus());
  }

  async function removeSaved(id: string) {
    try {
      await deleteNeedsCheck(id);
      void loadSaved();
    } catch (error) {
      setList({ kind: 'error', message: messageOf(error, 'Das Ergebnis konnte nicht gelöscht werden.') });
    }
  }

  const result = answers ? deriveNeedsResult(answers) : null;

  return (
    <div className="rs-paper bg-hero-only min-h-screen flex flex-col text-titanium-50">
      <LandingHeader />

      <main className="px-4 sm:px-6 lg:px-8 pt-14 pb-20 sm:pt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-100 mb-4">
            Bedarfs-Check · 3 Fragen
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05]">
            Was hilft Ihrem Betrieb zuerst?
          </h1>
          <p className="mt-5 text-base sm:text-lg text-silver-300 leading-relaxed">
            Drei kurze Fragen, ohne Konto. Die Empfehlung beruht nur auf Ihren Angaben – diese
            Seite ruft keine Website ab und prüft nichts technisch.
          </p>

          <form onSubmit={submit} noValidate className="mt-10 flex flex-col gap-8" aria-describedby="needs-check-error">
            {NEEDS_QUESTIONS.map((question, index) => (
              <fieldset key={question.id} aria-describedby={`needs-hint-${question.id}`} className="border border-silver-700/30 p-5">
                <legend className="px-2 font-display text-lg text-titanium-50">
                  {index + 1}. {question.title}
                </legend>
                <p id={`needs-hint-${question.id}`} className="text-sm text-silver-300 mb-3">
                  {question.hint}
                </p>
                <div className="flex flex-col gap-1">
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex items-center gap-3 min-h-[44px] px-2 cursor-pointer text-base text-silver-100"
                    >
                      <input
                        type="radio"
                        name={`needs-${question.id}`}
                        value={option.id}
                        checked={selection[question.id] === option.id}
                        onChange={() => choose(question.id, option.id)}
                        className="h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <p id="needs-check-error" role="alert" className="min-h-[1.5rem] text-sm text-silver-100">
              {formError}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
              >
                Empfehlung anzeigen <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {answers ? (
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center justify-center px-6 py-3.5 border border-silver-500 text-silver-100 text-base font-semibold rounded-none"
                >
                  Neu beginnen
                </button>
              ) : null}
            </div>
          </form>

          {result && answers ? (
            <section aria-labelledby="needs-result-heading" className="mt-14 border-t border-silver-700/30 pt-10">
              <h2
                id="needs-result-heading"
                ref={resultHeading}
                tabIndex={-1}
                className="font-display font-bold text-2xl sm:text-3xl text-titanium-50 tracking-tight outline-none"
              >
                Ihre Empfehlung: zuerst {NEEDS_PILLAR_LABEL[result.primary]}
              </h2>
              <p data-testid="needs-basis" className="mt-3 text-sm text-silver-300 leading-relaxed border-l border-silver-500 pl-4">
                Grundlage: Ihre drei Angaben. Es wurde keine Website abgerufen und nichts technisch geprüft.
              </p>

              <ol className="mt-6 grid gap-px bg-silver-700/30 border border-silver-700/30">
                {result.recommendations.map((rec) => (
                  <li key={rec.id} className="bg-[var(--brand-bg-0,#0b0d10)] p-5 flex flex-col gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-titanium-100">
                      {NEEDS_PILLAR_LABEL[rec.pillar]}
                      {rec.startsTechnicalCheck ? ' · technische Prüfung, startet erst dort' : ''}
                    </span>
                    <span className="font-display text-lg text-titanium-50">{rec.title}</span>
                    <span className="text-sm text-silver-300 leading-relaxed">{rec.reason}</span>
                    <Link
                      to={rec.to}
                      className="mt-1 inline-flex items-center gap-2 min-h-[44px] text-base font-semibold text-titanium-50 underline underline-offset-4"
                    >
                      {rec.linkLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ol>

              <div className="mt-8 border border-silver-700/30 p-5" data-testid="needs-save">
                <h3 className="font-display text-lg text-titanium-50">Ergebnis speichern</h3>
                {authLoading ? (
                  <p role="status" className="mt-2 text-sm text-silver-300">Anmeldestatus wird geprüft …</p>
                ) : !isAuthenticated ? (
                  <>
                    <p className="mt-2 text-sm text-silver-300 leading-relaxed">
                      Zum Speichern ist ein Konto nötig. Ihre drei Angaben bleiben bis dahin nur in diesem
                      Browser und stehen nach der Anmeldung wieder hier.
                    </p>
                    <Link
                      to={LOGIN_HREF}
                      className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 border border-silver-500 text-silver-100 text-base font-semibold rounded-none"
                    >
                      Anmelden und speichern
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveResult()}
                      disabled={save.kind === 'saving' || save.kind === 'saved'}
                      className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 border border-silver-500 text-silver-100 text-base font-semibold rounded-none disabled:opacity-60"
                    >
                      {save.kind === 'saving' ? 'Wird gespeichert …' : 'In meinem Konto speichern'}
                    </button>
                    <p role="status" className="mt-3 min-h-[1.25rem] text-sm text-silver-300">
                      {save.kind === 'saved' ? `Gespeichert am ${formatDate(save.at)}.` : ''}
                    </p>
                    {save.kind === 'error' ? (
                      <p role="alert" className="text-sm text-silver-100">{save.message}</p>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          ) : null}

          {isAuthenticated ? (
            <section aria-labelledby="needs-saved-heading" className="mt-14 border-t border-silver-700/30 pt-10">
              <h2 id="needs-saved-heading" className="font-display font-bold text-2xl text-titanium-50 tracking-tight">
                Gespeicherte Ergebnisse
              </h2>
              {list.kind === 'loading' ? (
                <p role="status" className="mt-3 text-sm text-silver-300">Wird geladen …</p>
              ) : null}
              {list.kind === 'error' ? (
                <div role="alert" className="mt-3 text-sm text-silver-100">
                  <p>{list.message}</p>
                  <button type="button" onClick={() => void loadSaved()} className="mt-2 min-h-[44px] underline underline-offset-4">
                    Erneut versuchen
                  </button>
                </div>
              ) : null}
              {list.kind === 'ready' && list.items.length === 0 ? (
                <p className="mt-3 text-sm text-silver-300">Noch nichts gespeichert.</p>
              ) : null}
              {list.kind === 'ready' && list.items.length > 0 ? (
                <ul className="mt-4 grid gap-px bg-silver-700/30 border border-silver-700/30">
                  {list.items.map((item) => (
                    <li key={item.id} className="bg-[var(--brand-bg-0,#0b0d10)] p-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-silver-100">
                        {formatDate(item.createdAt)} · {NEEDS_GOAL_LABEL[item.answers.goal]}
                      </span>
                      <span className="flex gap-4">
                        <button type="button" onClick={() => openSaved(item)} className="min-h-[44px] text-sm font-semibold underline underline-offset-4">
                          Öffnen
                        </button>
                        <button type="button" onClick={() => void removeSaved(item.id)} className="min-h-[44px] text-sm font-semibold underline underline-offset-4">
                          Löschen
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
