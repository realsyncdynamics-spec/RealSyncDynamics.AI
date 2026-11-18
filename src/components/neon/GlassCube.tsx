import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/glass-tokens.css';
import '../../styles/glass-cube.css';

/**
 * Glaswürfel — Markenelement nach der Owner-Vorlage „RealSync Studio –
 * 3D-Glaswürfel“ (18.11.2026), erweitert am selben Tag:
 *
 * Der geschlossene Würfel besteht aus 3×3×3 kleinen Glaswürfeln. In einer
 * Endlosschleife (≈14 s) leuchten sie in kräftigen Farben auf, zerfallen in
 * alle Richtungen (Drehung, Verkleinerung, Ausblenden) und setzen sich wieder
 * zum Würfel zusammen.
 *
 * Bewusst reines CSS-3D statt WebGL: kein GPU-Kontext, keine neue
 * Abhängigkeit, keine Ladezeit auf `/`. Verhalten:
 *   - neigt sich subtil zur Maus (nur feiner Zeiger, nicht auf Touch),
 *   - bleibt bei `prefers-reduced-motion: reduce` geschlossen und still,
 *   - pausiert, wenn er nicht im Bild ist (IntersectionObserver),
 *   - überdeckt nichts außerhalb seiner Bühne (overflow: hidden).
 * Dekorativ: `aria-hidden`; Inhalte stehen immer im Text daneben.
 */

const MAX_TILT_X = 8;
const MAX_TILT_Y = 11;

/** Kräftige Farben für die Teilwürfel: Tokens `--rs-g-spectrum-1…7` aus glass-tokens.css
 *  (dekorativ, keine Statusbedeutung). */
export const CUBE_SPECTRUM = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--rs-g-spectrum-${n})`);

const FACES = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const;

interface Cell {
  key: string;
  style: CSSProperties;
}

/** Deterministischer Zufall (gleiches Bild bei jedem Render, kein Hydration-Flackern). */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** 27 Teilwürfel mit Heimatposition, Flugrichtung, Drehung, Farbe und Versatz. */
export function buildCells(): Cell[] {
  const cells: Cell[] = [];
  let n = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        const r1 = rand(n + 1);
        const r2 = rand(n + 7);
        const r3 = rand(n + 13);
        // Flugrichtung: von der Mitte weg; der Mittelwürfel fliegt nach vorn oben.
        let dx = i + (r1 - 0.5) * 0.8;
        let dy = j + (r2 - 0.5) * 0.8;
        let dz = k + (r3 - 0.5) * 0.8;
        if (i === 0 && j === 0 && k === 0) {
          dx = 0.3;
          dy = -0.9;
          dz = 1.1;
        }
        const len = Math.hypot(dx, dy, dz) || 1;
        const dist = 1.1 + r1 * 0.7; // in Würfelkantenlängen
        cells.push({
          key: `${i}${j}${k}`,
          style: {
            '--i': i,
            '--j': j,
            '--k': k,
            '--dx': ((dx / len) * dist).toFixed(3),
            '--dy': ((dy / len) * dist).toFixed(3),
            '--dz': ((dz / len) * dist).toFixed(3),
            '--rx': `${Math.round((r2 - 0.5) * 540)}deg`,
            '--ry': `${Math.round((r3 - 0.5) * 540)}deg`,
            '--c': CUBE_SPECTRUM[n % CUBE_SPECTRUM.length],
            // Welle von einer Ecke aus: Teile weiter weg starten etwas später.
            '--d': `${((i + 1 + j + 1 + k + 1) * 0.09).toFixed(2)}s`,
          } as CSSProperties,
        });
        n++;
      }
    }
  }
  return cells;
}

function wantsStill(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

function hasFinePointer(): boolean {
  try {
    return window.matchMedia?.('(pointer: fine)').matches ?? false;
  } catch {
    return false;
  }
}

export interface GlassCubeProps {
  /** Zusätzliche Klasse für die Bühne (Größe/Platzierung durch den Aufrufer). */
  className?: string;
}

export function GlassCube({ className }: GlassCubeProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const [still] = useState(() => (typeof window === 'undefined' ? true : wantsStill()));
  const [tiltable] = useState(() => (typeof window === 'undefined' ? false : !wantsStill() && hasFinePointer()));
  const [visible, setVisible] = useState(true);
  const cells = useMemo(buildCells, []);

  // Energie sparen: Animation anhalten, solange der Würfel nicht sichtbar ist.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || still || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  useEffect(() => () => window.cancelAnimationFrame(rafRef.current), []);

  const setTilt = (x: number, y: number) => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty('--gc-tx', `${x}deg`);
    el.style.setProperty('--gc-ty', `${y}deg`);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!tiltable || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(() => setTilt(Math.round(-py * 2 * MAX_TILT_X), Math.round(px * 2 * MAX_TILT_Y)));
  };

  const onLeave = () => {
    window.cancelAnimationFrame(rafRef.current);
    setTilt(0, 0);
  };

  return (
    <div
      ref={stageRef}
      className={`rs-glass gc-stage${className ? ` ${className}` : ''}`}
      data-still={still}
      data-paused={!visible}
      data-testid="glass-cube"
      aria-hidden="true"
      onPointerMove={tiltable ? onMove : undefined}
      onPointerLeave={tiltable ? onLeave : undefined}
    >
      <div className="gc-stars" />
      <div className="gc-halo" />
      <div className="gc-floor" />
      <div className="gc-tilt">
        <div className="gc-cube">
          {cells.map((c) => (
            <div key={c.key} className="gc-cell" style={c.style}>
              {FACES.map((f) => <span key={f} className={`gc-cf gc-cf-${f}`} />)}
            </div>
          ))}
          <div className="gc-lid" />
        </div>
      </div>
    </div>
  );
}
