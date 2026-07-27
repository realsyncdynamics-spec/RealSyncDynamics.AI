/**
 * FlowStepPage — wiederverwendbare Flow-Zielseite.
 *
 * Beantwortet die drei Pflicht-Fragen jeder Seite:
 *   1. Wo bin ich?         → Überschrift + „Was wurde geklickt?“
 *   2. Warum bin ich hier? → Erklärungstext + Fortschritt
 *   3. Was kann ich tun?   → Primär-/Sekundär-/Weitere Aktionen
 *
 * Beim Betreten wird der Flow-Zustand aktualisiert (stateEffect + lastStep),
 * sodass der Kontext nach Reload erhalten bleibt.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Info } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useFlow } from './FlowContext';
import { FlowProgress } from './FlowProgress';
import { FlowNavButtons } from './FlowNavButtons';
import { FLOW_STAGES, stageIndex, type FlowStep } from './flowRoutes';

const DASHBOARD_FALLBACK = { label: 'Zum Dashboard', to: '/flow/dashboard' };

export function FlowStepPage({ step }: { step: FlowStep }) {
  const { state, applyEffect, markStep } = useFlow();

  // Zustand beim Betreten übernehmen und Schritt vermerken.
  useEffect(() => {
    applyEffect(step.stateEffect);
    markStep(step.id);
  }, [step.id, step.stateEffect, applyEffect, markStep]);

  const currentStageIdx = stageIndex(step.stage);
  const totalStages = FLOW_STAGES.length;

  // Kontext-Zeile: was wir über den bisherigen Weg des Nutzers wissen.
  const contextBits: string[] = [];
  if (state.scanDomain) contextBits.push(`Domain: ${state.scanDomain}`);
  if (state.scanCompleted) contextBits.push('Scan abgeschlossen');
  else if (state.scanStarted) contextBits.push('Scan gestartet');
  if (state.selectedPlan) contextBits.push(`Paket: ${state.selectedPlan}`);
  if (state.checkoutStatus !== 'idle') contextBits.push(`Checkout: ${state.checkoutStatus}`);

  return (
    <div className="flow-context min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />

      <main className="pt-20">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          {/* Fortschritt: Wo im Prozess? */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">
              <Compass className="h-3.5 w-3.5" />
              Schritt in Stufe {currentStageIdx + 1} von {totalStages} · {step.fromPage} →{' '}
              {step.title}
            </div>
            <FlowProgress stage={step.stage} />
          </div>

          {/* Wo bin ich / Was wurde geklickt? */}
          <div className="border border-titanium-900 bg-obsidian-900/60 p-6 sm:p-8">
            <div className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-security-blue">
              Was wurde geklickt?
            </div>
            <h1 className="text-3xl font-display font-semibold tracking-tight text-titanium-50 sm:text-4xl">
              {step.title}
            </h1>
            <p className="mt-3 font-mono text-sm text-titanium-300">{step.clicked}</p>

            {/* Warum bin ich hier? */}
            <div className="mt-6 border-t border-titanium-900 pt-6">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">
                <Info className="h-3.5 w-3.5" />
                Was passiert hier?
              </div>
              <p className="text-base leading-relaxed text-titanium-200">{step.explanation}</p>
            </div>

            {/* Kontext-Status (persistiert) */}
            {contextBits.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {contextBits.map((bit) => (
                  <span
                    key={bit}
                    className="border border-titanium-800 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-titanium-400"
                  >
                    {bit}
                  </span>
                ))}
              </div>
            )}

            {/* Was kann ich als Nächstes tun? */}
            <FlowNavButtons
              primary={step.primary}
              secondary={step.secondary}
              extraActions={step.extraActions}
              fallbackPrimary={DASHBOARD_FALLBACK}
            />
          </div>

          <p className="mt-6 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-600">
            Geführter Ablauf ·{' '}
            <Link to="/" className="hover:text-titanium-300">
              Startseite
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
