/**
 * Europe relief for the `/design/governance` hero — pure SVG, no d3.
 *
 * Land geometry is pre-projected (see europe-relief-data.ts). Pins, golden
 * data flows and city lights are projected at render time with the same
 * Mercator parameters, so everything lines up on the tilted plate.
 * Loaded lazily by the page so the ~35 KB of path data stays off the
 * main bundle.
 */
import { useMemo } from 'react';
import { FLOW_HUB, FLOW_TARGETS, NODES, type GovernanceTheme } from './content';
import {
  RELIEF_GRATICULE,
  RELIEF_LAND,
  RELIEF_SCALE,
  RELIEF_SIZE,
  RELIEF_TRANSLATE,
} from './europe-relief-data';

const DEG = Math.PI / 180;

/** Mercator projection matching the pre-projected land paths. */
export function projectLonLat(lon: number, lat: number): [number, number] {
  const x = RELIEF_SCALE * lon * DEG + RELIEF_TRANSLATE[0];
  const y = RELIEF_TRANSLATE[1] - RELIEF_SCALE * Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2));
  return [x, y];
}

/** Deterministic PRNG (mulberry32) — city lights are stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ThemeSpec {
  eu: readonly [string, string, string];
  titan: readonly [string, string, string];
  flow: readonly [string, string, string];
  flowHalo: string;
  stroke: readonly [string, string];
  lightsOpacity: number;
  landOpacity: readonly [number, number];
  lightingColor: string;
  specularConstant: number;
}

const THEMES: Record<GovernanceTheme, ThemeSpec> = {
  titan: {
    eu: ['#f4f6f8', '#c9ced4', '#8a9098'],
    titan: ['#b9bec5', '#7f858d', '#4f545b'],
    flow: ['#fff1d6', '#e8bd92', '#c98b52'],
    flowHalo: 'rgba(255,241,214,.35)',
    stroke: ['rgba(255,255,255,.55)', 'rgba(214,220,228,.25)'],
    lightsOpacity: 0.9,
    landOpacity: [0.22, 0.14],
    lightingColor: '#ffe9cf',
    specularConstant: 0.95,
  },
  night: {
    eu: ['#1b2028', '#0f1319', '#06080b'],
    titan: ['#141920', '#0b0e13', '#050608'],
    flow: ['#bff3fb', '#22c3e6', '#0e8aa6'],
    flowHalo: 'rgba(34,195,230,.28)',
    stroke: ['rgba(255,214,150,.42)', 'rgba(127,227,245,.22)'],
    lightsOpacity: 1,
    landOpacity: [1, 0.95],
    lightingColor: '#3a5561',
    specularConstant: 0.35,
  },
};

interface CityLight {
  x: number;
  y: number;
  rTitan: number;
  rNight: number;
  fill: string;
  opacity: number;
}

const LIGHT_COUNT = 900;
const LIGHT_SEEDS = 11; // first 11 flow targets are European cities

function buildLights(): CityLight[] {
  const rand = mulberry32(0x5eed);
  const out: CityLight[] = [];
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const [clon, clat] = FLOW_TARGETS[i % LIGHT_SEEDS];
    const lon = clon + (rand() - 0.5) * 9;
    const lat = clat + (rand() - 0.5) * 6;
    const [x, y] = projectLonLat(lon, lat);
    const r = rand();
    out.push({
      x,
      y,
      rTitan: 0.5 + r * 1.4,
      rNight: 0.7 + r * 1.9,
      fill: rand() < 0.7 ? '#e8bd92' : '#fff6e6',
      opacity: 0.35 + rand() * 0.6,
    });
  }
  return out;
}

function buildFlows(): string[] {
  const [hx, hy] = projectLonLat(FLOW_HUB[0], FLOW_HUB[1]);
  return FLOW_TARGETS.map(([lon, lat]) => {
    const [px, py] = projectLonLat(lon, lat);
    const mx = (hx + px) / 2 + (py - hy) * 0.35;
    const my = (hy + py) / 2 - (px - hx) * 0.35;
    return `M${hx},${hy} Q${mx},${my} ${px},${py}`;
  });
}

const fmt = (v: number) => v.toFixed(1);

export interface EuropeReliefProps {
  theme: GovernanceTheme;
}

export function EuropeRelief({ theme }: EuropeReliefProps) {
  const t = THEMES[theme];
  const lights = useMemo(buildLights, []);
  const flows = useMemo(buildFlows, []);
  const pins = useMemo(
    () =>
      NODES.map((n) => {
        const [x, y] = projectLonLat(n.lon, n.lat);
        return { city: n.city, left: `${(x / RELIEF_SIZE) * 100}%`, top: `${(y / RELIEF_SIZE) * 100}%` };
      }),
    [],
  );

  return (
    <>
      <svg id="dgov-map" viewBox={`0 0 ${RELIEF_SIZE} ${RELIEF_SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id="dgov-titanFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.titan[0]} />
            <stop offset="48%" stopColor={t.titan[1]} />
            <stop offset="100%" stopColor={t.titan[2]} />
          </linearGradient>
          <linearGradient id="dgov-euFill" x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={t.eu[0]} />
            <stop offset="42%" stopColor={t.eu[1]} />
            <stop offset="100%" stopColor={t.eu[2]} />
          </linearGradient>
          <linearGradient id="dgov-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.flow[0]} stopOpacity={0.95} />
            <stop offset="55%" stopColor={t.flow[1]} stopOpacity={0.8} />
            <stop offset="100%" stopColor={t.flow[2]} stopOpacity={0} />
          </linearGradient>
          {/* Specular lighting on the land mask → relief glint edges, light from NW. */}
          <filter id="dgov-reliefLight" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation={3} result="bump" />
            <feSpecularLighting
              in="bump"
              surfaceScale={6}
              specularConstant={t.specularConstant}
              specularExponent={18}
              lightingColor={t.lightingColor}
              result="spec"
            >
              <feDistantLight azimuth={225} elevation={48} />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="specClip" />
            </feMerge>
          </filter>
          <filter id="dgov-flowGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={3.5} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={RELIEF_GRATICULE} fill="none" stroke="rgba(214,220,228,.12)" strokeWidth={0.8} />

        <g filter="url(#dgov-reliefLight)">
          {RELIEF_LAND.map((land, i) => (
            <path
              key={land.id || `${land.name}-${i}`}
              d={land.d}
              fillRule="evenodd"
              fill={land.eu ? 'url(#dgov-euFill)' : 'url(#dgov-titanFill)'}
              fillOpacity={land.eu ? t.landOpacity[0] : t.landOpacity[1]}
              stroke={land.eu ? t.stroke[0] : t.stroke[1]}
              strokeWidth={0.9}
            />
          ))}
        </g>

        <g filter="url(#dgov-flowGlow)">
          {flows.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="url(#dgov-flow)" strokeWidth={1.6} strokeLinecap="round" />
              <path d={d} fill="none" stroke={t.flowHalo} strokeWidth={5} />
            </g>
          ))}
        </g>

        <g opacity={t.lightsOpacity}>
          {lights.map((l, i) => (
            <circle
              key={i}
              cx={fmt(l.x)}
              cy={fmt(l.y)}
              r={fmt(theme === 'night' ? l.rNight : l.rTitan)}
              fill={l.fill}
              opacity={l.opacity.toFixed(2)}
            />
          ))}
        </g>
      </svg>

      <div id="dgov-pins" aria-hidden="true">
        {pins.map((p) => (
          <div key={p.city} className="pin" style={{ left: p.left, top: p.top }}>
            <div className="halo" />
            <div className="stem" />
            <div className="head" />
          </div>
        ))}
      </div>
    </>
  );
}

export default EuropeRelief;
