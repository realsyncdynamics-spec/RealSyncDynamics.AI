/**
 * Geführte Produktdemonstration 01–07 auf `/` (`#system`).
 *
 * Beim Scrollen wächst aus einer unkontrollierten KI-Landschaft eine
 * Governance-Struktur: Das Inventar rechts (mobil oben, sticky) bekommt je
 * Kapitel eine Spalte dazu — Owner, Risiko, Policy, Ausführung, Prüfung —
 * und am Ende eine Evidence Chain. Alle Zeilen sind Beispielwerte und als
 * solche gekennzeichnet (`DEMO_LABEL`).
 *
 * Ohne IntersectionObserver (Prerender, Tests) bleibt Kapitel 01 aktiv; der
 * Inhalt ist trotzdem vollständig lesbar, weil jedes Kapitel seinen Text trägt.
 */
import { useEffect, useRef, useState } from 'react';
import {
  DEMO_LABEL,
  SYSTEM_STORY_CHAPTERS,
  SYSTEM_STORY_ROWS,
} from '../governance-frontend/hero-content';

const COLUMNS = ['System', 'Owner', 'Risiko', 'Policy', 'Ausführung', 'Geprüft'] as const;

function visibleColumns(step: number): number {
  return step === 0 ? 1 : Math.min(step + 1, COLUMNS.length);
}

export function GovernanceSystemStory() {
  const [step, setStep] = useState(0);
  const chapterRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(index)) setStep(index);
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    for (const el of chapterRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cols = visibleColumns(step);
  const latest = cols - 1;
  const unknown = step === 0;

  function cell(row: (typeof SYSTEM_STORY_ROWS)[number], col: number): string {
    switch (col) {
      case 0: return unknown ? 'nicht erfasst' : row.system;
      case 1: return row.owner;
      case 2: return row.risk;
      case 3: return row.policy;
      case 4: return row.execution;
      default: return 'ok';
    }
  }

  return (
    <section id="system" className="os-section" aria-labelledby="system-heading">
      <div className="os-inner">
        <p className="os-kicker"><b>GOVERNANCE OS</b> VON DER LANDSCHAFT ZUR KONTROLLE</p>
        <h2 id="system-heading" className="os-display">
          <span>Hier wird nicht</span>
          <span>nur dokumentiert.</span>
          <span className="os-dim">Hier wird KI kontrolliert.</span>
        </h2>

        <div className="os-story">
          <div className="os-story__visual">
            <div className="os-panel" data-testid="system-story-visual" data-step={step}>
              <div className="os-panel__bar">
                <span>
                  {String(step + 1).padStart(2, '0')} · {SYSTEM_STORY_CHAPTERS[step].step}
                </span>
                <span className="os-demo-tag">{DEMO_LABEL}</span>
              </div>
              <table className="os-inv">
                <caption className="sr-only">
                  KI-Inventar einer Beispielumgebung, Stufe {SYSTEM_STORY_CHAPTERS[step].step}
                </caption>
                <thead>
                  <tr>
                    {COLUMNS.map((label, col) => (
                      <th
                        key={label}
                        scope="col"
                        data-col-hidden={col >= cols}
                        data-col-secondary={col !== 0 && col !== latest}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SYSTEM_STORY_ROWS.map((row) => (
                    <tr key={row.system} data-unknown={unknown}>
                      {COLUMNS.map((label, col) => (
                        <td
                          key={label}
                          data-col-hidden={col >= cols}
                          data-col-secondary={col !== 0 && col !== latest}
                          data-reveal={col === latest && col > 0}
                          className={
                            col === 2 && row.risk === 'hoch'
                              ? 'os-tone-warn'
                              : col === 4 && row.execution === 'Freigabe'
                                ? 'os-tone-warn'
                                : col === 5
                                  ? 'os-tone-ok'
                                  : undefined
                          }
                        >
                          {cell(row, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {step === SYSTEM_STORY_CHAPTERS.length - 1 ? (
                <div className="os-chain" aria-label="Evidence Chain der Beispielumgebung">
                  {['decision', 'approval', 'execution', 'verification', 'evidence'].map((kind, i) => (
                    <span key={kind}>
                      E-{1041 + i} · {kind}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <ol className="m-0 list-none p-0">
            {SYSTEM_STORY_CHAPTERS.map((chapter, i) => (
              <li
                key={chapter.id}
                ref={(el) => {
                  chapterRefs.current[i] = el;
                }}
                data-index={i}
                data-active={i === step}
                className="os-story__chapter"
              >
                <p className="os-kicker">
                  <b>{String(i + 1).padStart(2, '0')}</b> {chapter.step}
                  {chapter.status === 'preview' ? <span className="os-status">Preview</span> : null}
                </p>
                <h3 className="os-h2" style={{ fontSize: 'clamp(26px, 2.6vw, 40px)' }}>
                  {chapter.title}
                </h3>
                <p className="os-lede">{chapter.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
