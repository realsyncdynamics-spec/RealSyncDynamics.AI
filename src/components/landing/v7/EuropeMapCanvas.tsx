import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../prefers-reduced-motion';

export type Lv7Theme = 'titan' | 'nacht';

/**
 * Stilisierte Europakarte mit Datenbögen (Canvas 2D, keine Abhängigkeit).
 *
 * Übernommen aus dem Design-Artefakt „AI Compliance Operations OS for Europe“,
 * mit drei Korrekturen gegenüber dem Prototyp:
 *  - Pro Frame genau ein `requestAnimationFrame` (der Prototyp plante zwei,
 *    die Schleifen verdoppelten sich mit jedem Frame).
 *  - Skalierung per `setTransform` statt `scale` — sonst wächst sie bei jedem
 *    Resize weiter.
 *  - Bögen rechnen ihre Koordinaten pro Frame aus den Städten, damit sie nach
 *    einem Resize nicht an alter Stelle hängen.
 * Zusätzlich: Bei `prefers-reduced-motion` ein ruhendes Bild, außerhalb des
 * Viewports pausiert die Animation.
 */

const CITIES: readonly (readonly [lon: number, lat: number])[] = [
  [13.4, 52.5], // Berlin
  [2.35, 48.85], // Paris
  [-0.12, 51.5], // London
  [8.68, 50.11], // Frankfurt
  [4.9, 52.37], // Amsterdam
  [21.01, 52.23], // Warschau
  [16.37, 48.21], // Wien
  [-3.7, 40.42], // Madrid
  [12.5, 41.9], // Rom
  [18.07, 59.33], // Stockholm
  [8.55, 47.37], // Zürich
  [11.58, 48.14], // München
  [4.35, 50.85], // Brüssel
  [12.57, 55.68], // Kopenhagen
  [14.42, 50.09], // Prag
];

const ARC_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1], [0, 3], [0, 4], [1, 2], [1, 5], [2, 4], [3, 11], [3, 10],
  [4, 12], [5, 14], [6, 3], [7, 1], [8, 6], [9, 13], [10, 6], [11, 0], [12, 1],
];

/** Grobe Küstenlinien als [lon, lat]-Polygone. */
const LAND: readonly (readonly (readonly [number, number])[])[] = [
  [[-9, 36], [6, 36], [15, 38], [20, 39], [26, 38], [30, 40], [34, 42], [36, 44], [32, 46], [26, 48], [22, 55], [20, 60], [18, 65], [14, 68], [10, 63], [8, 58], [4, 52], [3, 48], [-2, 44], [-6, 38]],
  [[8, 58], [10, 58], [14, 56], [16, 57], [18, 60], [20, 64], [22, 68], [26, 70], [28, 72], [24, 70], [20, 68], [17, 65], [15, 62], [12, 58]],
  [[-5, 50], [-1, 51], [2, 51], [0, 53], [-2, 54], [-4, 56], [-5, 58], [-2, 58], [-2, 56], [-4, 54], [-3, 51]],
  [[-10, 52], [-6, 51], [-6, 53], [-8, 55], [-10, 54]],
  [[8, 44], [10, 44], [14, 42], [16, 38], [18, 40], [16, 42], [14, 44], [10, 46]],
  [[-9, 36], [-6, 37], [-2, 37], [0, 39], [-1, 42], [-2, 44], [-8, 44], [-9, 42]],
];

type Rgb = readonly [number, number, number];
const PALETTES: Record<Lv7Theme, { land: string; grid: string; arc: Rgb; node: Rgb; wash: string }> = {
  titan: { land: 'rgba(50,52,58,0.55)', grid: 'rgba(200,205,215,0.06)', arc: [217, 164, 65], node: [240, 196, 106], wash: 'rgba(35,33,28,0.35)' },
  nacht: { land: 'rgba(4,22,36,0.6)', grid: 'rgba(25,195,221,0.07)', arc: [25, 195, 221], node: [100, 230, 245], wash: 'rgba(4,22,44,0.4)' },
};

const LON0 = -12;
const LON1 = 42;
const LAT0 = 34;
const LAT1 = 72;

interface Arc {
  pair: number;
  t: number;
  spd: number;
  delay: number;
}

const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function EuropeMapCanvas({ theme }: { theme: Lv7Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  /** Zeichnet das ruhende Bild neu (nur bei reduzierter Bewegung gesetzt). */
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    const still = prefersReducedMotion();
    const start = performance.now();

    // Karte im rechten Teil des Heros (x 0,35–0,93, y 0,05–0,87).
    const xy = (lon: number, lat: number) => ({
      x: (0.35 + ((lon - LON0) / (LON1 - LON0)) * 0.58) * w,
      y: (0.05 + ((LAT1 - lat) / (LAT1 - LAT0)) * 0.82) * h,
    });

    const spawn = (pair: number, delay: number, t = 0): Arc => ({ pair, t, spd: 0.0004 + Math.random() * 0.0004, delay });
    const arcs: Arc[] = ARC_PAIRS.map((_, i) => spawn(i, still ? 0 : Math.random() * 5000, still ? 0.6 : Math.random()));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width || window.innerWidth;
      h = rect.height || 600;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    const drawArc = (arc: Arc, alpha: number, color: Rgb) => {
      const [i, j] = ARC_PAIRS[arc.pair];
      const a = xy(CITIES[i][0], CITIES[i][1]);
      const b = xy(CITIES[j][0], CITIES[j][1]);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const cx = (a.x + b.x) / 2 - dy * 0.28;
      const cy = (a.y + b.y) / 2 + dx * 0.28 - len * 0.18;
      const at = (t: number) => {
        const m = 1 - t;
        return { x: m * m * a.x + 2 * m * t * cx + t * t * b.x, y: m * m * a.y + 2 * m * t * cy + t * t * b.y };
      };
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const p = at((k / 40) * arc.t);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = rgba(color, alpha * 0.6);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (arc.t > 0 && arc.t < 1) {
        const head = at(arc.t);
        const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 5);
        g.addColorStop(0, rgba(color, alpha * 0.9));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = (now: number) => {
      const pal = PALETTES[themeRef.current];
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      const wash = ctx.createRadialGradient(w * 0.7, h * 0.4, 0, w * 0.7, h * 0.4, w * 0.7);
      wash.addColorStop(0, pal.wash);
      wash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 0.5;
      for (let lat = 35; lat <= 70; lat += 5) line(xy(LON0, lat), xy(LON1, lat));
      for (let lon = -10; lon <= 40; lon += 5) line(xy(lon, LAT0), xy(lon, LAT1));

      ctx.fillStyle = pal.land;
      ctx.strokeStyle = 'rgba(180,185,200,0.12)';
      ctx.lineWidth = 0.7;
      for (const poly of LAND) {
        ctx.beginPath();
        poly.forEach(([lon, lat], i) => {
          const p = xy(lon, lat);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      CITIES.forEach(([lon, lat], ci) => {
        const p = xy(lon, lat);
        const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.001 + ci * 0.7);
        const r = 8 + pulse * 4;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        glow.addColorStop(0, rgba(pal.arc, 0.3 + pulse * 0.2));
        glow.addColorStop(1, rgba(pal.arc, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(pal.node, 0.9);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });

      arcs.forEach((arc, i) => {
        if (elapsed < arc.delay) return;
        if (!still) arc.t = Math.min(1, arc.t + arc.spd);
        const alpha = arc.t < 0.2 ? arc.t / 0.2 : arc.t > 0.85 ? (1 - arc.t) / 0.15 : 1;
        drawArc(arc, Math.max(0, alpha), pal.arc);
        if (arc.t >= 1) arcs[i] = spawn(Math.floor(Math.random() * ARC_PAIRS.length), elapsed + 500 + Math.random() * 2000);
      });
    };

    const frame = (now: number) => {
      draw(now);
      raf = visible ? requestAnimationFrame(frame) : 0;
    };

    const kick = () => {
      if (still) draw(performance.now());
      else if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      resize();
      if (still) draw(performance.now());
    };

    if (still) redrawRef.current = () => draw(performance.now());
    resize();
    kick();
    canvas.dataset.ready = 'true';
    window.addEventListener('resize', onResize);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) kick();
      });
      io.observe(canvas);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      io?.disconnect();
      redrawRef.current = null;
    };
  }, []);

  // Ruhendes Bild muss bei Themenwechsel neu gezeichnet werden; die
  // Animation liest das Thema ohnehin pro Frame aus `themeRef`.
  useEffect(() => {
    redrawRef.current?.();
  }, [theme]);

  return <canvas ref={ref} className="lv7-map" role="img" aria-label="Stilisierte Karte Europas mit Datenverbindungen" />;
}
