import { useEffect, useRef, useState } from 'react';
import { Radar, Scale, FileCheck2, ShieldCheck, Hash, Archive } from 'lucide-react';

/**
 * RealSyncEventFlow — die visuelle Metapher für „RealSync": ein einzelnes
 * Ereignis wandert durch die Runtime, von der Erkennung bis zur Auditfähigkeit.
 *
 * Bewegung: Die Stufen leuchten nacheinander auf, sobald der Block sichtbar
 * wird — einmal, nicht als Dauerschleife (der Auftrag verlangt ausdrücklich
 * „subtil, nicht dauerhaft nervös animieren"). Danach bleiben alle Stufen
 * aktiv stehen.
 *
 * Zugänglichkeit: Die Sequenz ist reine Dekoration über bereits vollständig
 * vorhandenem Text — kein Inhalt erscheint erst durch die Animation. Bei
 * `prefers-reduced-motion: reduce` und ohne IntersectionObserver werden sofort
 * alle Stufen aktiv gesetzt.
 */

const EVENT_STAGES = [
  { icon: Radar, label: 'Neues KI-System erkannt' },
  { icon: Scale, label: 'Risiko klassifiziert' },
  { icon: FileCheck2, label: 'Policy ausgewertet' },
  { icon: ShieldCheck, label: 'Control geprüft' },
  { icon: Hash, label: 'Evidenz erzeugt' },
  { icon: Archive, label: 'Auditfähig' },
];

const STEP_MS = 420;

export function RealSyncEventFlow() {
  const ref = useRef<HTMLOListElement>(null);
  // -1 = noch nichts aktiv; EVENT_STAGES.length - 1 = alles aktiv.
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const node = ref.current;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Ohne Beobachter oder bei reduzierter Bewegung: Endzustand sofort zeigen.
    if (!node || reduced || typeof IntersectionObserver === 'undefined') {
      setActive(EVENT_STAGES.length - 1);
      return;
    }

    let timers: ReturnType<typeof setTimeout>[] = [];
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect(); // nur einmal abspielen
        timers = EVENT_STAGES.map((_, i) =>
          setTimeout(() => setActive(i), i * STEP_MS),
        );
      },
      { threshold: 0.35 },
    );
    obs.observe(node);

    return () => {
      obs.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <ol
      ref={ref}
      className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden"
    >
      {EVENT_STAGES.map(({ icon: Icon, label }, i) => {
        const on = i <= active;
        return (
          <li
            key={label}
            className={`relative p-4 sm:p-5 bg-[rgb(3,7,18)] transition-colors duration-500 ${
              on ? '' : 'opacity-45'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors duration-500 ${on ? 'text-cyan-400' : 'text-white/40'}`}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <p className={`text-xs leading-relaxed transition-colors duration-500 ${on ? 'text-white/80' : 'text-white/50'}`}>
              {label}
            </p>
            {i < EVENT_STAGES.length - 1 && (
              <span
                className="hidden lg:block absolute top-1/2 -right-px translate-x-1/2 -translate-y-1/2 text-cyan-400/50 text-xs z-10 bg-[rgb(3,7,18)] px-0.5"
                aria-hidden="true"
              >
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
