import { useEffect, useState } from 'react';

/**
 * RuntimeSequence — kompakte Statuszeile im Hero, die einmal durch die vier
 * Runtime-Stufen läuft und auf „Control Plane · aktiv" stehen bleibt.
 *
 * ⚠️ Claim-Disziplin: Das ist KEINE Telemetrie. Es läuft kein Scan, es wird
 * nichts gemessen — die Zeile illustriert den Ablauf. Sie trägt deshalb
 * sichtbar „Produktvorschau" und ist für Screenreader als solche ausgewiesen.
 *
 * Bewegung: einmalig, ~2,5 s, danach statisch. Bei
 * `prefers-reduced-motion: reduce` wird sofort der Endzustand gezeigt, ohne
 * Durchlauf. Die Zeile ist `aria-hidden`, weil sie keine Information trägt,
 * die nicht schon in der Prozessleiste darunter steht — sie würde Screenreader
 * nur mit wechselndem Text stören.
 */

const STAGES = [
  { label: 'DISCOVER', text: 'Assets werden erfasst' },
  { label: 'CLASSIFY', text: 'Risikoklassen zugeordnet' },
  { label: 'ENFORCE', text: 'Policies aktiv' },
  { label: 'PROVE', text: 'Nachweis erzeugt' },
];

const FINAL = { label: 'CONTROL PLANE', text: 'aktiv' };
const STEP_MS = 620;

export function RuntimeSequence() {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setDone(true);
      return;
    }

    const timers = STAGES.map((_, idx) =>
      setTimeout(() => setI(idx), idx * STEP_MS),
    );
    const end = setTimeout(() => setDone(true), STAGES.length * STEP_MS);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
  }, []);

  const current = done ? FINAL : STAGES[i];

  return (
    <p
      className="inline-flex items-center gap-2 sm:gap-2.5 mb-5 sm:mb-6 px-2.5 py-1.5 border border-white/10 bg-white/[0.03] rounded-lg backdrop-blur-sm"
      aria-hidden="true"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-emerald-400' : 'bg-cyan-400 motion-safe:animate-pulse'}`}
      />
      <span className="font-mono text-[10px] sm:text-[11px] tracking-widest text-white/80 uppercase">
        {current.label}
      </span>
      <span className="font-mono text-[10px] sm:text-[11px] text-white/45">{current.text}</span>
      <span className="font-mono text-[9px] tracking-widest text-white/30 uppercase border-l border-white/10 pl-2 sm:pl-2.5">
        Produktvorschau
      </span>
    </p>
  );
}
