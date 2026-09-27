/**
 * Signature Governance Pipeline auf `/` (`#pipeline`).
 *
 * Ein Beispiel-Request läuft Stufe für Stufe durch Request → Identity →
 * Tenant → Policy → Risk → Approval → Execution → Verification → Evidence.
 * Die Animation trägt Bedeutung: Bei „Freigabe erforderlich" hält die
 * Ausführung an, bis der Besucher freigibt; bei „Policy-Verstoß" schließt das
 * Gate, die Ausführung unterbleibt, der Nachweis entsteht trotzdem.
 *
 * Alles hier ist Beispiel — kein Request verlässt den Browser. Die
 * Verdikte entsprechen dem Vokabular des Policy Decision Point
 * (`supabase/functions/_shared/pdp`). Ohne IntersectionObserver oder bei
 * reduzierter Bewegung steht das Ergebnis sofort da.
 */
import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  DEMO_LABEL,
  PIPELINE_APPROVAL_INDEX,
  PIPELINE_SCENARIOS,
  PIPELINE_STAGES,
  type PipelineScenarioId,
} from '../governance-frontend/hero-content';
import { prefersReducedMotion } from './prefers-reduced-motion';

const STEP_MS = 480;
const SCENARIO_ORDER: readonly PipelineScenarioId[] = ['approval', 'violation', 'routine'];

export function GovernancePipelineDemo() {
  const [scenarioId, setScenarioId] = useState<PipelineScenarioId>('approval');
  const [revealed, setRevealed] = useState(0);
  const [approved, setApproved] = useState(false);
  const [started, setStarted] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const scenario = PIPELINE_SCENARIOS[scenarioId];
  const waiting = scenarioId === 'approval' && !approved;
  const stopAt = waiting ? PIPELINE_APPROVAL_INDEX + 1 : PIPELINE_STAGES.length;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started || revealed >= stopAt) return;
    if (prefersReducedMotion()) {
      setRevealed(stopAt);
      return;
    }
    const timer = window.setTimeout(() => setRevealed((n) => n + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [started, revealed, stopAt]);

  function selectScenario(id: PipelineScenarioId) {
    setScenarioId(id);
    setApproved(false);
    setRevealed(0);
  }

  function replay() {
    setApproved(false);
    setRevealed(0);
  }

  const done = revealed >= PIPELINE_STAGES.length;

  return (
    <section
      id="pipeline"
      ref={sectionRef}
      className="os-section os-section--alt scroll-mt-4"
      aria-labelledby="pipeline-heading"
    >
      <div className="os-inner">
        <p className="os-kicker"><b>SIGNATURE</b> GOVERNANCE PIPELINE</p>
        <h2 id="pipeline-heading" className="os-display">
          <span>Kontrolle</span>
          <span>vor der</span>
          <span className="os-dim">Ausführung.</span>
        </h2>
        <p className="os-lede">
          Jede Aktion eines Menschen oder Agenten durchläuft dieselbe Kette — bevor ein Provider etwas ausführt.
          Wählen Sie ein Szenario.
        </p>

        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Szenario wählen">
          {SCENARIO_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className="os-chip"
              aria-pressed={id === scenarioId}
              onClick={() => selectScenario(id)}
            >
              {PIPELINE_SCENARIOS[id].label}
            </button>
          ))}
        </div>

        <div className="os-panel mt-6" data-testid="pipeline-panel" data-scenario={scenarioId}>
          <div className="os-panel__bar">
            <span className="min-w-0 truncate">
              {scenario.actor} → {scenario.action}
            </span>
            <span className="os-demo-tag">{DEMO_LABEL}</span>
          </div>

          <ol className="os-pipe" aria-live="polite">
            {PIPELINE_STAGES.map((stage, i) => {
              const [result, tone] = scenario.results[i];
              const isApproval = i === PIPELINE_APPROVAL_INDEX;
              const holding = isApproval && waiting && revealed > i;
              let state: 'pending' | 'current' | 'done' | 'hold' | 'gate' = 'pending';
              if (revealed > i) state = holding ? 'hold' : tone === 'block' ? 'gate' : 'done';
              else if (revealed === i && started && revealed < stopAt) state = 'current';
              const shown = revealed > i;
              const text = holding ? 'REQUIRED · WARTET' : shown ? result : '';
              const toneClass = holding ? 'os-tone-warn' : `os-tone-${tone}`;
              return (
                <li key={stage} data-state={state} data-testid={`pipeline-stage-${stage.toLowerCase()}`}>
                  <span className="text-[11px]" style={{ fontFamily: 'var(--font-rs-mono)', color: 'var(--color-rs-fg-2)' }} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="os-pipe__stage">{stage}</span>
                  <span className={`os-pipe__result ${shown ? toneClass : ''}`}>
                    {shown ? text : <span className="sr-only">ausstehend</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4" style={{ borderColor: 'var(--color-rs-border)' }}>
            <p className="m-0 text-[13px]" style={{ color: 'var(--color-rs-fg-1)' }}>
              {waiting && revealed >= stopAt
                ? 'Ausführung pausiert — eine berechtigte Rolle muss freigeben.'
                : scenarioId === 'violation' && done
                  ? 'Gate geschlossen. Nicht ausgeführt — der Nachweis entsteht trotzdem.'
                  : done
                    ? 'Ausgeführt, geprüft, belegt.'
                    : 'Entscheidung läuft …'}
            </p>
            <div className="flex flex-wrap gap-2">
              {waiting && revealed >= stopAt ? (
                <button type="button" className="os-btn" onClick={() => setApproved(true)}>
                  Als Approver freigeben
                </button>
              ) : null}
              <button type="button" className="os-btn os-btn--ghost" onClick={replay}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Erneut abspielen
              </button>
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-[48rem] text-[13px] leading-[1.6]" style={{ color: 'var(--color-rs-fg-2)' }}>
          Beispielablauf im Browser, keine Live-Ausführung. Im Produkt laufen Identitätsprüfung, Tenant-Zuordnung,
          Policy Decision Point, Freigaben und Nachweiskette serverseitig; die Durchsetzung ist je Umgebung
          beobachtend oder blockierend konfigurierbar. Die durchgängige Agent-Runtime ist Preview.
        </p>
      </div>
    </section>
  );
}
