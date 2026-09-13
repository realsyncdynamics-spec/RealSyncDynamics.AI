import { useEffect, useMemo, useRef, useState } from 'react';
import { COMPLIANCE_NODES, HUB_NODE } from './governance-nodes';
import { prefersReducedMotion } from './prefers-reduced-motion';

/**
 * Fester Hintergrund der Startseite — gebürstetes Titan mit Europa als
 * Chrom-Relief und goldenen Datenströmen.
 *
 * ## Aufbau (hinten nach vorn)
 *
 * 1. Titanplatte    — Verlaufsfläche mit Lichtkante oben und Bürststruktur
 * 2. Carbon-Gewebe  — Grundtextur der linken Hälfte (unter der Textspalte)
 * 3. Foto-Ebene     — `public/europe-globe.webp`, entsättigt, rechts maskiert
 * 4. 3D-Platte      — geneigtes Titan-Raster + Europa-Relief + stehende Pins
 * 5. Atmosphäre     — Abdunklung oben/unten, seitlicher Scrim für Textkontrast
 *
 * ## Statisch, nicht animiert
 *
 * Bewusst ohne Lichtdrift oder Dauerbewegung („kein dynamischer Hintergrund
 * mehr, fest"). Einzige Bewegung ist eine dezente Zeiger-Parallaxe von ±3°
 * auf der Platte — und die entfällt bei `prefers-reduced-motion`.
 *
 * ## Geometrie
 *
 * Lädt `public/europe-relief.json` (≈35 kB, vorprojiziert von
 * `scripts/generate-europe-relief.mjs`). Kein d3, kein topojson-client, kein
 * CDN-Request — auf einer Seite, die DSGVO-Konformität verkauft, wäre ein
 * Third-Party-Fetch für Dekoration das falsche Signal.
 *
 * Schlägt der Fetch fehl, bleibt die Titan-/Carbon-/Foto-Komposition stehen
 * und nur das Relief entfällt. Die Seite ist nie von der Karte abhängig.
 */

type ReliefData = {
  size: number;
  projection: { k: number; tx: number; ty: number };
  graticule: string;
  countries: readonly { key: string; id: string; name: string; eu: boolean; d: string }[];
};

/** Deterministischer PRNG — gleiche Stadtlichter bei jedem Render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Punkte als ein einziger Pfad aus Kreis-Subpfaden. 900 `<circle>`-Knoten
 *  kosten spürbar Layout-Zeit; drei gebündelte Pfade sehen identisch aus. */
function dotsToPath(points: readonly (readonly [number, number])[], r: number): string {
  const d = r * 2;
  return points
    .map(([x, y]) => `M${x},${y}m${-r},0a${r},${r} 0 1,0 ${d},0a${r},${r} 0 1,0 ${-d},0`)
    .join('');
}

/** Streuzentren der Stadtlichter — EU-Knoten plus weitere Ballungsräume. */
const LIGHT_CENTERS: readonly (readonly [number, number])[] = [
  [13.4, 52.52], [4.35, 50.85], [8.68, 50.11], [18.07, 59.33], [2.35, 48.86],
  [16.37, 48.21], [-3.7, 40.42], [12.5, 41.9], [24.94, 60.17], [21.01, 52.23],
  [-6.26, 53.35], [-0.13, 51.5],
];

/** Zielpunkte der Datenströme ab Frankfurt — EU-Knoten und Fernverbindungen. */
const FLOW_TARGETS: readonly (readonly [number, number])[] = [
  [13.4, 52.52], [4.35, 50.85], [18.07, 59.33], [2.35, 48.86], [16.37, 48.21],
  [-3.7, 40.42], [12.5, 41.9], [24.94, 60.17], [21.01, 52.23], [-6.26, 53.35],
  [-0.13, 51.5], [28.05, 39.9], [34, 55], [30, 30], [-14, 30], [10, 68],
];

const BASE_ROTATE_X = 58;
const BASE_ROTATE_Z = -16;

/**
 * Kantenlänge der geneigten Platte in vw und der Anteil, den die Karte
 * darauf einnimmt.
 *
 * Die Platte trägt das Titan-Raster und muss über den Bildrand hinausgehen,
 * damit das Raster nicht als Rechteck endet. Die Karte darf das nicht: Bei
 * den 215vw des Prototyps lag Mitteleuropa jenseits des Bildrands, sichtbar
 * blieben nur Chromflächen ohne erkennbaren Kontinent. `rotateX` staucht die
 * Höhe zusätzlich auf cos(58°) ≈ 0,53 — die Karte wirkt also flacher als
 * breit und braucht entsprechend Platz.
 */
const PLATE_VW = 132;
const MAP_INSET = '24%';

export function EuropeReliefBackdrop() {
  const [relief, setRelief] = useState<ReliefData | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);

  // Relief erst laden, wenn der Hauptthread frei ist: Der Hero und seine
  // CTAs müssen sofort klickbar sein, die Karte ist Dekoration.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = () => {
      fetch('/europe-relief.json', { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
        .then((data: ReliefData) => {
          if (!cancelled) setRelief(data);
        })
        .catch(() => {
          /* Relief entfällt, Titan-Komposition bleibt. */
        });
    };

    // `requestIdleCallback` fehlt in älteren Safari-Versionen — dort genügt
    // ein kurzer Timeout, damit der Hero zuerst steht.
    const supportsIdle = 'requestIdleCallback' in window;
    const handle = supportsIdle
      ? window.requestIdleCallback(load, { timeout: 1200 })
      : window.setTimeout(load, 200);

    return () => {
      cancelled = true;
      controller.abort();
      if (supportsIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  // Zeiger-Parallaxe, gedrosselt auf einen Frame.
  useEffect(() => {
    const plate = plateRef.current;
    if (!plate) return;
    if (prefersReducedMotion()) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const dx = (event.clientX / window.innerWidth - 0.5) * 2;
        const dy = (event.clientY / window.innerHeight - 0.5) * 2;
        plate.style.transform =
          `rotateX(${BASE_ROTATE_X - dy * 3}deg) rotateZ(${BASE_ROTATE_Z - dx * 3}deg) ` +
          'translateZ(-40px) scale(.9)';
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [relief]);

  // Projektion und abgeleitete Geometrie — einmal je geladenem Relief.
  const scene = useMemo(() => {
    if (!relief) return null;
    const { k, tx, ty } = relief.projection;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const project = (lon: number, lat: number): [number, number] => [
      rad(lon) * k + tx,
      ty - Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) * k,
    ];
    const round = (n: number) => Math.round(n * 10) / 10;

    const hub = project(HUB_NODE.lon, HUB_NODE.lat);

    // Datenströme als quadratische Bézier mit seitlichem Versatz — der
    // Bogen macht aus geraden Linien ein Netz.
    const flows = FLOW_TARGETS.map((target) => {
      const point = project(target[0], target[1]);
      const mx = (hub[0] + point[0]) / 2 + (point[1] - hub[1]) * 0.35;
      const my = (hub[1] + point[1]) / 2 - (point[0] - hub[0]) * 0.35;
      return `M${round(hub[0])},${round(hub[1])}Q${round(mx)},${round(my)} ${round(point[0])},${round(point[1])}`;
    });

    // Stadtlichter in drei Größenklassen, je Klasse ein Pfad.
    const random = mulberry32(0x5ea1);
    const buckets: [number, number][][] = [[], [], []];
    for (let i = 0; i < 780; i++) {
      const center = LIGHT_CENTERS[i % LIGHT_CENTERS.length];
      const lon = center[0] + (random() - 0.5) * 9;
      const lat = center[1] + (random() - 0.5) * 6;
      const [x, y] = project(lon, lat);
      buckets[Math.floor(random() * 3)].push([round(x), round(y)]);
    }

    const pins = COMPLIANCE_NODES.map((node) => {
      const [x, y] = project(node.lon, node.lat);
      return { city: node.city, left: (x / relief.size) * 100, top: (y / relief.size) * 100 };
    });

    return {
      flows,
      pins,
      lights: [
        { d: dotsToPath(buckets[0], 0.6), fill: '#e8bd92', opacity: 0.55 },
        { d: dotsToPath(buckets[1], 1.0), fill: '#fff6e6', opacity: 0.75 },
        { d: dotsToPath(buckets[2], 1.5), fill: '#e8bd92', opacity: 0.4 },
      ],
    };
  }, [relief]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
      data-hero-visual="europe-relief-titan"
      data-hero-framing="europe-right"
      data-hero-scenery="titan-chrome-gold-network"
      style={{
        background:
          'radial-gradient(34% 60% at 38% -10%, rgba(255,255,255,.7) 0%, rgba(220,223,228,.32) 34%, transparent 64%),' +
          'radial-gradient(90% 70% at 82% 14%, rgba(150,155,162,.28) 0%, transparent 60%),' +
          'linear-gradient(180deg, #6a6e74 0%, #4a4e54 18%, #2e3135 52%, #16171a 100%)',
      }}
    >
      {/* Bürststruktur: feine horizontale Linien über der Titanfläche. */}
      <div
        className="absolute inset-0 opacity-[.35] mix-blend-overlay"
        style={{
          background:
            'repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 1px, transparent 1px 3px),' +
            'repeating-linear-gradient(180deg, rgba(0,0,0,.08) 0 1px, transparent 1px 7px)',
        }}
      />

      {/* Konstruktionsraster in Viertelspalten + Satzspiegel-Kanten. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(90deg, rgba(214,220,228,.05) 1px, transparent 1px)',
          backgroundSize: '25% 100%',
        }}
      />
      <div className="absolute inset-y-0 left-[4vw] right-[4vw] border-x border-[rgba(214,220,228,.08)]" />

      {/* Warmer Horizont — die Lichtquelle der Komposition. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(54% 48% at 56% 50%, rgba(232,189,146,.24) 0%, transparent 62%),' +
            'linear-gradient(180deg, rgba(214,220,228,.08) 0%, transparent 9%),' +
            'radial-gradient(72% 46% at 50% 26%, rgba(232,189,146,.12) 0%, transparent 66%)',
        }}
      />

      {/* Carbon-Gewebe unter der Textspalte. */}
      <div
        className="absolute inset-0 opacity-[.55]"
        style={{
          backgroundColor: '#14161a',
          backgroundImage:
            'linear-gradient(27deg, #1b1e23 5px, transparent 5px),' +
            'linear-gradient(207deg, #1b1e23 5px, transparent 5px),' +
            'linear-gradient(27deg, #101216 5px, transparent 5px),' +
            'linear-gradient(207deg, #101216 5px, transparent 5px),' +
            'linear-gradient(90deg, #17191d 10px, transparent 10px),' +
            'linear-gradient(#1d2025 25%, #16181c 25%, #16181c 50%, transparent 50%, transparent 75%, #1a1c21 75%, #1a1c21)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 5px, 10px 0, 0 10px, 10px 5px, 0 0, 0 0',
          maskImage: 'linear-gradient(96deg, #000 0%, #000 40%, rgba(0,0,0,.5) 62%, transparent 86%)',
          WebkitMaskImage:
            'linear-gradient(96deg, #000 0%, #000 40%, rgba(0,0,0,.5) 62%, transparent 86%)',
        }}
      />

      {/* Fotorealistische Europa-Nacht aus dem Repo-Asset, in Titan getont. */}
      <div
        className="absolute -right-[4%] -top-[8%] h-[116%] w-[96%] opacity-[.94]"
        style={{
          backgroundImage: "url('/europe-globe.webp')",
          backgroundSize: 'cover',
          backgroundPosition: '62% 44%',
          filter: 'grayscale(.9) contrast(1.2) brightness(1.1)',
          maskImage:
            'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.5) 14%, #000 34%, #000 100%)',
          WebkitMaskImage:
            'linear-gradient(96deg, transparent 0%, rgba(0,0,0,.5) 14%, #000 34%, #000 100%)',
        }}
      />

      {/* 3D-Platte: Relief beginnt erst rechts der Textspalte. */}
      <div
        className="absolute inset-0"
        style={{
          perspective: '1500px',
          perspectiveOrigin: '58% 34%',
          maskImage: 'linear-gradient(96deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.85) 16%, #000 34%)',
          WebkitMaskImage:
            'linear-gradient(96deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.85) 16%, #000 34%)',
        }}
      >
        <div
          ref={plateRef}
          className="absolute left-[70%] top-[52%]"
          style={{
            height: `${PLATE_VW}vw`,
            width: `${PLATE_VW}vw`,
            margin: `${-PLATE_VW / 2}vw 0 0 ${-PLATE_VW / 2}vw`,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${BASE_ROTATE_X}deg) rotateZ(${BASE_ROTATE_Z}deg) translateZ(-40px) scale(.9)`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(214,220,228,.07) 1px, transparent 1px),' +
                'linear-gradient(90deg, rgba(214,220,228,.07) 1px, transparent 1px)',
              backgroundSize: '7.2vw 7.2vw',
              maskImage: 'radial-gradient(46% 46% at 50% 50%, #000 0%, transparent 78%)',
              WebkitMaskImage: 'radial-gradient(46% 46% at 50% 50%, #000 0%, transparent 78%)',
            }}
          />

          {relief && scene && (
            <>
              {/* Die Karte sitzt mittig auf der Platte und bleibt schmaler als
                  die sichtbare Scheibe des Rasters. Formatfüllend (so der
                  Prototyp) schneidet die Maske mitten durch Mitteleuropa — man
                  sieht dann Chromflächen, aber keinen Kontinent mehr. */}
              <svg
                viewBox={`0 0 ${relief.size} ${relief.size}`}
                className="absolute overflow-hidden"
                style={{
                  inset: MAP_INSET,
                  maskImage: 'radial-gradient(58% 58% at 50% 50%, #000 66%, transparent 97%)',
                  WebkitMaskImage: 'radial-gradient(58% 58% at 50% 50%, #000 66%, transparent 97%)',
                  filter:
                    'drop-shadow(0 2px 0 rgba(120,124,130,.6)) drop-shadow(0 5px 0 rgba(64,67,72,.45)) ' +
                    'drop-shadow(0 24px 34px rgba(0,0,0,.55))',
                }}
              >
                <defs>
                  <linearGradient id="ga-titan-fill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#b9bec5" />
                    <stop offset="48%" stopColor="#7f858d" />
                    <stop offset="100%" stopColor="#4f545b" />
                  </linearGradient>
                  <linearGradient id="ga-eu-fill" x1="0" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#f4f6f8" />
                    <stop offset="42%" stopColor="#c9ced4" />
                    <stop offset="100%" stopColor="#8a9098" />
                  </linearGradient>
                  <linearGradient id="ga-flow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fff1d6" stopOpacity=".95" />
                    <stop offset="55%" stopColor="#e8bd92" stopOpacity=".8" />
                    <stop offset="100%" stopColor="#c98b52" stopOpacity="0" />
                  </linearGradient>

                  {/* Relief-Glanzkanten: feste Lichtachse aus Nordwesten. */}
                  <filter id="ga-relief-light" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="bump" />
                    <feSpecularLighting
                      in="bump"
                      surfaceScale="6"
                      specularConstant="1.1"
                      specularExponent="18"
                      lightingColor="#ffe9cf"
                      result="spec"
                    >
                      <feDistantLight azimuth="225" elevation="48" />
                    </feSpecularLighting>
                    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
                    <feMerge>
                      <feMergeNode in="SourceGraphic" />
                      <feMergeNode in="specClip" />
                    </feMerge>
                  </filter>

                  <filter id="ga-flow-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  d={relief.graticule}
                  fill="none"
                  stroke="rgba(214,220,228,.12)"
                  strokeWidth="0.8"
                />

                <g filter="url(#ga-relief-light)">
                  {relief.countries.map((country) => (
                    <path
                      key={country.key}
                      d={country.d}
                      fill={country.eu ? 'url(#ga-eu-fill)' : 'url(#ga-titan-fill)'}
                      fillOpacity={country.eu ? 1 : 0.8}
                      stroke={country.eu ? 'rgba(255,255,255,.7)' : 'rgba(214,220,228,.3)'}
                      strokeWidth="0.9"
                    />
                  ))}
                </g>

                <g filter="url(#ga-flow-glow)">
                  {scene.flows.map((d, i) => (
                    <g key={i}>
                      <path d={d} fill="none" stroke="rgba(255,241,214,.35)" strokeWidth="5" />
                      <path
                        d={d}
                        fill="none"
                        stroke="url(#ga-flow)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </g>
                  ))}
                </g>

                {scene.lights.map((layer, i) => (
                  <path key={i} d={layer.d} fill={layer.fill} opacity={layer.opacity} />
                ))}
              </svg>

              {/* Stehende Pins — der Stiel wird gegen die Plattenneigung
                  aufgerichtet, sonst läge er flach auf der Karte. */}
              <div className="absolute" style={{ inset: MAP_INSET, transformStyle: 'preserve-3d' }}>
                {scene.pins.map((pin) => (
                  <div
                    key={pin.city}
                    className="absolute"
                    style={{
                      left: `${pin.left}%`,
                      top: `${pin.top}%`,
                      transformStyle: 'preserve-3d',
                    }}
                  >
                    <div className="absolute -bottom-[11px] -left-[11px] h-[22px] w-[22px] rounded-full border border-[rgba(232,189,146,.55)] shadow-[0_0_0_6px_rgba(232,189,146,.08)]" />
                    <div
                      className="absolute bottom-0 left-0 h-[62px] w-[1.5px] origin-bottom"
                      style={{
                        background: 'linear-gradient(180deg, #e6c98a, rgba(201,139,82,0))',
                        transform: `rotateX(${-BASE_ROTATE_X}deg)`,
                      }}
                    />
                    <div
                      className="absolute bottom-[58px] -left-[3.5px] h-[8px] w-[8px] rounded-full bg-[#e6c98a] shadow-[0_0_12px_rgba(232,189,146,.9)]"
                      style={{ transform: `rotateX(${-BASE_ROTATE_X}deg)` }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Atmosphäre oben/unten. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,19,28,.55) 0%, rgba(11,19,28,0) 24%,' +
            ' rgba(11,19,28,.06) 58%, rgba(11,19,28,.8) 100%)',
        }}
      />
      {/* Seitlicher Scrim — hält den Textkontrast links. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(18,19,22,.42) 0%, rgba(18,19,22,.26) 30%,' +
            ' transparent 50%, transparent 100%)',
        }}
      />
    </div>
  );
}
