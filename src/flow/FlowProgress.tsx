/**
 * FlowProgress — Status-/Fortschrittsanzeige: „Wo befindet sich der Nutzer im
 * Prozess?“. Zeigt die Prozess-Stufen (Scan → Ergebnis → Anmeldung → Paket →
 * Checkout → Dashboard) und hebt die aktuelle Stufe hervor.
 */
import { Check } from 'lucide-react';
import { FLOW_STAGES, stageIndex, type FlowStageKey } from './flowRoutes';

export function FlowProgress({ stage }: { stage: FlowStageKey }) {
  const current = stageIndex(stage);

  return (
    <nav aria-label="Fortschritt" className="w-full">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
        {FLOW_STAGES.map((s, idx) => {
          const done = idx < current;
          const active = idx === current;
          return (
            <li key={s.key} className="flex items-center gap-2 sm:gap-3">
              <div
                className={[
                  'flex items-center gap-2 px-3 py-1.5 border font-mono text-[11px] uppercase tracking-[0.14em]',
                  active
                    ? 'border-security-blue text-security-blue bg-security-blue/10'
                    : done
                      ? 'border-titanium-700 text-titanium-300'
                      : 'border-titanium-900 text-titanium-600',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  {done ? <Check className="h-3.5 w-3.5" /> : <span>{idx + 1}</span>}
                </span>
                {s.label}
              </div>
              {idx < FLOW_STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px w-3 sm:w-5 ${idx < current ? 'bg-titanium-600' : 'bg-titanium-900'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
