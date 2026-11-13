import { deltaEOklch, type Oklch } from './oklch';
import {
  ACCENT_DELTA_E_CAP,
  AXIS_IDS,
  COLOR_PARTS,
  DEPTH_CAP,
  DENSITY_CAP,
  DIMENSION_WEIGHTS,
  DISTANCE_BLEND,
  MIN_ACCENT_DELTA_E,
  MIN_DISTINCT_AXES,
  MIN_SURFACE_DELTA_L,
  MOTION_MS_CAP,
  PUBLISH_MIN_DISTANCE,
  RADIUS_CAP,
  SOFT_WARN_DISTANCE,
  SURFACE_L_CAP,
  TYPE_CLASS_WEIGHT,
  TYPE_SCALE_CAP,
  TYPE_SCALE_WEIGHT,
  type AxisId,
  type DimensionId,
} from './weights';

export type TypeClass = 'serif' | 'sans' | 'slab' | 'mono' | 'display';

export interface ThemeAxes {
  'header-type': string;
  'card-style': string;
  'sidebar-form': string;
}

export interface ThemeFingerprint {
  id: string;
  accent: Oklch;
  surfaceL: number;
  typeClass: { display: TypeClass; body: TypeClass };
  scale: number;
  density: number;
  radius: number;
  motionMs: number;
  depth: number;
  imagery: readonly [number, number, number];
  tone: readonly [number, number, number];
  axes: ThemeAxes;
}

export interface PairDistance {
  id: string;
  d: number;
  continuous: number;
  axes: number;
  distinctAxes: number;
  deltaE: number;
  deltaL: number;
  dimensions: Record<DimensionId, number>;
}

export interface DistanceVerdict {
  nearest: PairDistance | null;
  pairs: PairDistance[];
  hardPass: boolean;
  remix: boolean;
  reasons: string[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function classifyFamily(stack: string): TypeClass {
  const name = stack.toLowerCase();
  if (name.includes('mono')) return 'mono';
  if (name.includes('slab')) return 'slab';
  if (name.includes('grotesk') || name.includes('display')) return 'display';
  if (name.includes('newsreader') || name.includes('serif') || name.includes('georgia')) return 'serif';
  return 'sans';
}

function classGap(a: TypeClass, b: TypeClass): number {
  return a === b ? 0 : 1;
}

export function dimensionDistance(left: ThemeFingerprint, right: ThemeFingerprint): Record<DimensionId, number> {
  const deltaE = deltaEOklch(left.accent, right.accent);
  const dAccent = clamp01(deltaE / ACCENT_DELTA_E_CAP);
  const dSurface = clamp01(Math.abs(left.surfaceL - right.surfaceL) / SURFACE_L_CAP);
  const dChroma = clamp01(Math.abs(left.accent.c - right.accent.c) / ACCENT_DELTA_E_CAP);
  const color = (COLOR_PARTS.accent * dAccent + COLOR_PARTS.surface * dSurface + COLOR_PARTS.chroma * dChroma) / DIMENSION_WEIGHTS.color;
  const typeGap = (classGap(left.typeClass.display, right.typeClass.display) + classGap(left.typeClass.body, right.typeClass.body)) / 2;
  const type = clamp01(TYPE_CLASS_WEIGHT * typeGap + TYPE_SCALE_WEIGHT * (Math.abs(left.scale - right.scale) / TYPE_SCALE_CAP));
  const imagery = clamp01(Math.hypot(...left.imagery.map((value, index) => value - right.imagery[index]!)) / Math.sqrt(3));
  const tone = clamp01(Math.hypot(...left.tone.map((value, index) => value - right.tone[index]!)) / Math.sqrt(3));
  return {
    color: clamp01(color),
    type,
    density: clamp01(Math.abs(left.density - right.density) / DENSITY_CAP),
    motion: clamp01(Math.abs(left.motionMs - right.motionMs) / MOTION_MS_CAP),
    radius: clamp01(Math.abs(left.radius - right.radius) / RADIUS_CAP),
    depth: clamp01(Math.abs(left.depth - right.depth) / DEPTH_CAP),
    imagery,
    tone,
  };
}

export function pairDistance(left: ThemeFingerprint, right: ThemeFingerprint): PairDistance {
  const dimensions = dimensionDistance(left, right);
  const continuous = Math.sqrt(
    (Object.keys(DIMENSION_WEIGHTS) as DimensionId[]).reduce(
      (sum, id) => sum + DIMENSION_WEIGHTS[id] * dimensions[id] ** 2,
      0,
    ),
  );
  const distinctAxes = AXIS_IDS.filter((id) => left.axes[id] !== right.axes[id]).length;
  const axes = distinctAxes / AXIS_IDS.length;
  return {
    id: right.id,
    d: DISTANCE_BLEND.continuous * continuous + DISTANCE_BLEND.axes * axes,
    continuous,
    axes,
    distinctAxes,
    deltaE: deltaEOklch(left.accent, right.accent),
    deltaL: Math.abs(left.surfaceL - right.surfaceL),
    dimensions,
  };
}

export function distanceVerdict(candidate: ThemeFingerprint, existing: readonly ThemeFingerprint[]): DistanceVerdict {
  const pairs = existing.filter((theme) => theme.id !== candidate.id).map((theme) => pairDistance(candidate, theme));
  if (pairs.length === 0) {
    return { nearest: null, pairs, hardPass: true, remix: false, reasons: [] };
  }
  const nearest = pairs.reduce((best, pair) => (pair.d < best.d ? pair : best));
  const reasons: string[] = [];
  const failing = pairs.filter((pair) => {
    const distanceOk = pair.d >= PUBLISH_MIN_DISTANCE;
    const colorOk = pair.deltaE >= MIN_ACCENT_DELTA_E || pair.deltaL >= MIN_SURFACE_DELTA_L;
    const axesOk = pair.distinctAxes >= MIN_DISTINCT_AXES;
    return !distanceOk || !colorOk || !axesOk;
  });
  if (failing.some((pair) => pair.d < PUBLISH_MIN_DISTANCE)) reasons.push('Abstand unter 0,34');
  if (failing.some((pair) => pair.deltaE < MIN_ACCENT_DELTA_E && pair.deltaL < MIN_SURFACE_DELTA_L)) {
    reasons.push('Accent und Surface zu nah');
  }
  if (failing.some((pair) => pair.distinctAxes < MIN_DISTINCT_AXES)) reasons.push('Weniger als zwei Achsen verschieden');
  const hardPass = failing.length === 0;
  const remix = hardPass && pairs.some((pair) => pair.d < SOFT_WARN_DISTANCE);
  return { nearest, pairs, hardPass, remix, reasons };
}

export function axisCycle(current: string, occupied: string, options: readonly string[]): string {
  return options.find((option) => option !== current && option !== occupied) ?? options.find((option) => option !== occupied) ?? current;
}

export type { AxisId };
