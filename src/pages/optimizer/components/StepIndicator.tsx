/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Step-Indicator für den Optimizer-Flow.
 * Zeigt „Schritt X von Y" plus einen Fortschrittsbalken.
 * Steps: Entdecken → Scannen → Ergebnisse → Anmelden → Paket → Fertig
 */

import { Check } from 'lucide-react';

export const OPTIMIZER_STEPS = [
  'Entdecken',
  'Scannen',
  'Ergebnisse',
  'Anmelden',
  'Paket',
  'Fertig',
] as const;

export type OptimizerStep = (typeof OPTIMIZER_STEPS)[number];

/** 1-basierter Index des aktiven Schritts. */
export function StepIndicator({ current }: { current: number }) {
  const total = OPTIMIZER_STEPS.length;
  const clamped = Math.max(1, Math.min(total, current));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-400">
          Schritt {clamped} / {total}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-200">
          {OPTIMIZER_STEPS[clamped - 1]}
        </span>
      </div>

      {/* Segmentierter Balken — hard edges, kein Radius */}
      <ol className="flex items-center gap-1" aria-label="Fortschritt">
        {OPTIMIZER_STEPS.map((label, idx) => {
          const stepNo = idx + 1;
          const done = stepNo < clamped;
          const active = stepNo === clamped;
          return (
            <li
              key={label}
              className="flex-1"
              aria-current={active ? 'step' : undefined}
              title={label}
            >
              <div
                className={
                  'h-1.5 w-full ' +
                  (done
                    ? 'bg-petrol'
                    : active
                      ? 'bg-security-500'
                      : 'bg-obsidian-700')
                }
              />
            </li>
          );
        })}
      </ol>

      {/* Schritt-Labels nur ab sm sichtbar, um Mobile nicht zu überladen */}
      <ol className="mt-2 hidden sm:flex items-center justify-between">
        {OPTIMIZER_STEPS.map((label, idx) => {
          const stepNo = idx + 1;
          const done = stepNo < clamped;
          const active = stepNo === clamped;
          return (
            <li
              key={label}
              className={
                'flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ' +
                (active ? 'text-titanium-100' : done ? 'text-petrol' : 'text-titanium-500')
              }
            >
              {done && <Check className="h-3 w-3" aria-hidden />}
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
