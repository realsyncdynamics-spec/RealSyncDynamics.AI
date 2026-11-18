import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/**
 * Sternenfeld für die Studio-Vorschau (`/design/landing-studio`).
 * Reines Deko-Element: `aria-hidden`, kein Netzwerk, kein Zustand.
 * Bei `prefers-reduced-motion` wird einmal statisch gezeichnet.
 */
function reducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

interface Star { x: number; y: number; r: number; a: number; s: number; p: number }

export function StudioStarfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const still = reducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 5200);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.8 + 0.2,
        s: Math.random() * 0.02 + 0.004,
        p: Math.random() * Math.PI * 2,
      }));
      if (still) draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = still ? s.a : s.a * (0.55 + 0.45 * Math.sin(t * s.s * 0.06 + s.p));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!still) raf = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    if (!still) raf = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="lst-stars" aria-hidden="true" />;
}

/**
 * Gläserner Neon-Würfel (CSS-3D, dekorativ), umgesetzt nach dem
 * Claude-Design-Entwurf „RealSync Studio – 3D-Glaswürfel“: schwebender
 * Deckel, Lichtschimmer, pulsierender Halo, Bodenreflexion und
 * Neigung zur Mausposition. Bei `prefers-reduced-motion` statisch.
 */
export function StudioGlassCube() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const still = reducedMotion();

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (still || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: Math.round(-py * 16), y: Math.round(px * 22) });
  };
  const onPointerLeave = () => setTilt({ x: 0, y: 0 });

  const tiltStyle = { '--lst-tx': `${tilt.x}deg`, '--lst-ty': `${tilt.y}deg` } as CSSProperties;

  return (
    <div className="lst-stage" aria-hidden="true" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} data-testid="studio-cube">
      <div className="lst-halo" />
      <div className="lst-floor" />
      <div className="lst-tilt" style={tiltStyle}>
        <div className="lst-cube">
          <div className="lst-face lst-f-back" />
          <div className="lst-face lst-f-left" />
          <div className="lst-face lst-f-bottom" />
          <div className="lst-face lst-f-right" />
          <div className="lst-face lst-f-front"><div className="lst-inner" /></div>
          <div className="lst-lid" />
        </div>
      </div>
    </div>
  );
}
