import { useEffect, useRef } from 'react';

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

/** Gläserner Neon-Würfel (reines CSS-3D, dekorativ). */
export function StudioGlassCube() {
  return (
    <div className="lst-stage" aria-hidden="true">
      <div className="lst-halo" />
      <div className="lst-cube">
        <div className="lst-face lst-f-back" />
        <div className="lst-face lst-f-left" />
        <div className="lst-face lst-f-bottom" />
        <div className="lst-face lst-f-right" />
        <div className="lst-face lst-f-front"><div className="lst-inner" /></div>
      </div>
      <div className="lst-cube lst-lid"><div className="lst-top" /></div>
    </div>
  );
}
