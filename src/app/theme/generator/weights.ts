/** Konfigurierbare Gewichte. Summe der kontinuierlichen Gewichte = 1. */
export const DIMENSION_WEIGHTS = {
  color: 0.28,
  type: 0.16,
  density: 0.14,
  motion: 0.1,
  radius: 0.08,
  depth: 0.08,
  imagery: 0.08,
  tone: 0.08,
} as const;

export type DimensionId = keyof typeof DIMENSION_WEIGHTS;

export const AXIS_IDS = ['header-type', 'card-style', 'sidebar-form'] as const;
export type AxisId = (typeof AXIS_IDS)[number];

export const PUBLISH_MIN_DISTANCE = 0.34;
export const SOFT_WARN_DISTANCE = 0.42;
export const MIN_ACCENT_DELTA_E = 12;
export const MIN_SURFACE_DELTA_L = 18;
/** Strategie, keine Spec-Regel: wie weit der Akzent vom Input abrücken darf. */
export const BRAND_HUE_MAX_DEG = 24;
export const BRAND_DE_MAX = 10;

export function passesBrandGuard(hueShiftDeg: number, deltaE: number): boolean {
  return hueShiftDeg <= BRAND_HUE_MAX_DEG && deltaE <= BRAND_DE_MAX;
}
export const MIN_DISTINCT_AXES = 2;
export const MAX_ADJUST_ITERATIONS = 8;

export const DISTANCE_BLEND = { continuous: 0.75, axes: 0.25 } as const;

export const COLOR_PARTS = { accent: 0.16, surface: 0.08, chroma: 0.04 } as const;
export const ACCENT_DELTA_E_CAP = 40;
export const SURFACE_L_CAP = 45;
export const TYPE_CLASS_WEIGHT = 0.6;
export const TYPE_SCALE_WEIGHT = 0.4;
export const TYPE_SCALE_CAP = 0.35;
export const DENSITY_CAP = 0.6;
export const RADIUS_CAP = 1;
export const MOTION_MS_CAP = 400;
export const DEPTH_CAP = 1;
