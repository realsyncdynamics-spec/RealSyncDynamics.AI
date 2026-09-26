/**
 * Governance-Check auf `/` — Selbsteinschätzung in acht Fragen.
 *
 * Bewusst ohne Request und ohne Speicherung: Das Ergebnis zählt nur die
 * eigenen Antworten und nennt die offenen Kontrollen. Es erkennt nichts
 * automatisch und behauptet das auch nicht. Nächste Schritte führen auf
 * echte Routen: `/audit` (Domain-Scan mit Bericht) und `/contact-sales`
 * (einzige Kontakt-CTA laut runtimeVocab: „Enterprise anfragen").
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { CTA } from '../../content/runtimeVocab';
import { ArrowRight } from 'lucide-react';
import { GOVERNANCE_CHECK_QUESTIONS, HERO_SCAN_CTA_LABEL } from '../governance-frontend/hero-content';
import { SectionEyebrow, SectionHeading } from './GovernanceSectionChrome';
import {
  GA_LINE_SOFT,
  GA_MONO,
  GA_MUTED,
  GA_PILL_GHOST,
  GA_PILL_PRIMARY,
  GA_SANS,
  GA_SILVER,
} from './governance-ai-theme';

type Answer = 'yes' | 'no' | 'unsure';

const OPTIONS: readonly { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Ja' },
  { value: 'no', label: 'Nein' },
  { value: 'unsure', label: 'Unklar' },
];

export function GovernanceSelfCheck() {
  const baseId = useId();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  const total = GOVERNANCE_CHECK_QUESTIONS.length;
  const answered = Object.keys(answers).length;
  const complete = answered === total;
  const inPlace = GOVERNANCE_CHECK_QUESTIONS.filter((q) => answers[q.id] === 'yes');
  const open = GOVERNANCE_CHECK_QUESTIONS.filter((q) => answers[q.id] === 'no' || answers[q.id] === 'unsure');

  return (
    <section
      id="governance-check"
      className="ga-band relative z-[1] scroll-mt-6 border-t px-[4vw] py-[clamp(56px,6vw,88px)]"
      style={{ borderColor: GA_LINE_SOFT }}
      aria-labelledby="check-heading"
    >
      <div className="mx-auto w-full max-w-[1100px]">
        <SectionEyebrow>GOVERNANCE-CHECK</SectionEyebrow>
        <span id="check-heading">
          <SectionHeading accent="in acht Fragen.">Wo steht Ihre KI-Governance?</SectionHeading>
        </span>
        <p className="mt-4 max-w-[44rem] text-pretty leading-[1.7]" style={{ color: GA_MUTED, fontFamily: GA_SANS }}>
          Eine ehrliche Selbsteinschätzung, kein automatischer Scan: Das Ergebnis beruht ausschließlich auf Ihren
          Antworten. Nichts wird gespeichert oder übertragen.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <ol className="border" style={{ borderColor: GA_LINE_SOFT }}>
            {GOVERNANCE_CHECK_QUESTIONS.map((q, i) => {
              const legendId = `${baseId}-${q.id}`;
              return (
                <li key={q.id} className="border-b px-4 py-4 last:border-b-0 sm:px-5" style={{ borderColor: GA_LINE_SOFT }}>
                  <fieldset aria-labelledby={legendId}>
                    <div className="flex gap-3">
                      <span className="pt-[3px] text-[11px]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }} aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1">
                        <p id={legendId} className="text-[0.97rem] leading-[1.5]" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                          {q.question}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {OPTIONS.map((opt) => {
                            const checked = answers[q.id] === opt.value;
                            return (
                              <label
                                key={opt.value}
                                className="relative inline-flex cursor-pointer items-center rounded-full border px-4 py-[7px] text-[0.85rem] font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ga-accent-lite)]"
                                style={{
                                  fontFamily: GA_SANS,
                                  borderColor: checked ? 'var(--ga-accent)' : 'var(--ga-line)',
                                  backgroundColor: checked ? 'rgba(0,184,212,0.14)' : 'transparent',
                                  color: checked ? 'var(--ga-text)' : GA_MUTED,
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`${baseId}-${q.id}`}
                                  value={opt.value}
                                  checked={checked}
                                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                                  className="sr-only"
                                />
                                {opt.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </fieldset>
                </li>
              );
            })}
          </ol>

          <aside
            className="h-fit border p-5 sm:p-6 lg:sticky lg:top-6"
            style={{ borderColor: 'var(--ga-accent-border)', backgroundColor: 'rgba(0,184,212,0.05)' }}
            aria-labelledby={`${baseId}-result`}
          >
            <p id={`${baseId}-result`} className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: GA_MONO, color: 'var(--ga-accent)' }}>
              Ihr Ergebnis
            </p>
            <div aria-live="polite">
              {answered === 0 ? (
                <p className="mt-3 text-[0.95rem] leading-[1.6]" style={{ color: GA_MUTED }}>
                  Beantworten Sie die Fragen links — das Ergebnis erscheint hier.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-[1.6rem] font-semibold leading-tight" style={{ color: 'var(--ga-text)', fontFamily: GA_SANS }}>
                    {inPlace.length} von {total} Kontrollen vorhanden
                  </p>
                  <p className="mt-1 text-[0.85rem]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                    {answered} von {total} beantwortet · {open.length} offen oder unklar
                  </p>
                  {open.length > 0 ? (
                    <ul className="mt-5 space-y-2">
                      {open.map((q) => (
                        <li key={q.id} className="flex gap-3 text-[0.9rem] leading-[1.5]" style={{ color: 'var(--ga-text)' }}>
                          <span className="shrink-0 pt-[2px] text-[10px] tracking-[0.14em]" style={{ fontFamily: GA_MONO, color: GA_SILVER }}>
                            {q.stage}
                          </span>
                          <span>{q.gap}</span>
                        </li>
                      ))}
                    </ul>
                  ) : complete ? (
                    <p className="mt-5 text-[0.9rem] leading-[1.6]" style={{ color: GA_MUTED }}>
                      Nach Ihren Angaben sind alle acht Kontrollen vorhanden. Der nächste Schritt ist, sie belegbar zu machen.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-6 border-t pt-5" style={{ borderColor: GA_LINE_SOFT }}>
              <p className="text-[0.9rem] leading-[1.6]" style={{ color: GA_MUTED }}>
                Nächster Schritt: den Domain-Scan mit Bericht per E-Mail starten oder offene Punkte für Ihr Unternehmen klären.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  to="/audit"
                  className={`${GA_PILL_PRIMARY} ga-pill-sheen`}
                  style={{
                    fontFamily: GA_SANS,
                    backgroundImage: 'var(--ga-pill-face)',
                    color: 'var(--ga-pill-ink)',
                    boxShadow: 'var(--ga-pill-shadow)',
                  }}
                >
                  {HERO_SCAN_CTA_LABEL}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/contact-sales?tier=enterprise&source=home-check" className={GA_PILL_GHOST} style={{ fontFamily: GA_SANS }}>
                  {CTA.enterprise}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
