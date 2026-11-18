import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import '../../styles/glass-tokens.css';
import '../../styles/glass-cube.css';

/**
 * Glaswürfel — Markenelement nach der Owner-Vorlage „RealSync Studio –
 * 3D-Glaswürfel“ (18.11.2026).
 *
 * Bewusst reines CSS-3D statt WebGL: läuft ohne GPU-Kontext, ohne neue
 * Abhängigkeit und ohne Ladezeit auf `/`. Verhalten:
 *   - schwebt langsam, Deckel leuchtet und hebt sich leicht,
 *   - neigt sich subtil zur Maus (nur feiner Zeiger, nicht auf Touch),
 *   - bleibt bei `prefers-reduced-motion: reduce` statisch (CSS + JS),
 *   - pausiert, wenn er nicht im Bild ist (IntersectionObserver),
 *   - `pointer-events` nur auf der Bühne; Navigation und Eingaben liegen
 *     außerhalb und werden nie überdeckt.
 * Dekorativ: `aria-hidden`; Inhalte stehen immer im Text daneben.
 */

const MAX_TILT_X = 8;
const MAX_TILT_Y = 11;

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
          <div className="gc-face gc-back" />
          <div className="gc-face gc-left" />
          <div className="gc-face gc-bottom" />
          <div className="gc-face gc-right" />
          <div className="gc-face gc-front"><div className="gc-inner" /></div>
          <div className="gc-lid" />
        </div>
      </div>
    </div>
  );
}
