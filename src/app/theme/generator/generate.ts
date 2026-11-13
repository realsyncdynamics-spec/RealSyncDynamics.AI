import { contrastGaps, contrastRatio, REQUIRED_TEXT_PAIRS, REQUIRED_UI_PAIRS } from '../contrast';
import { resolveTheme } from '../resolve';
import { semanticOverrideStyle, type SemanticOverride } from '../overrides';
import { extractColor, type ColorSample } from './colorSample';
import { fixtureThemeCatalog, fingerprintFromVars, type ThemeCatalog } from './catalog';
import { axisCycle, distanceVerdict, type DistanceVerdict, type ThemeAxes, type ThemeFingerprint } from './distance';
import { canonicalJson, sha256Hex } from './hash';
import { hexToOklch, oklchToHex, type Oklch } from './oklch';
import {
  AXIS_IDS,
  MAX_ADJUST_ITERATIONS,
  type AxisId,
  type DimensionId,
} from './weights';

export const INDUSTRIES = ['handwerk-regional', 'b2b-saas', 'kanzlei-beratung', 'gesundheit'] as const;
export type IndustryId = (typeof INDUSTRIES)[number];

export const TONE_PRESETS = [
  'warm-nahbar',
  'sachlich-formal',
  'technisch-praezise',
  'ruhig-vertrauensvoll',
  'energetisch-kuehn',
] as const;
export type TonePreset = (typeof TONE_PRESETS)[number];

export type Goal = 'termin' | 'lead' | 'trust' | 'self-serve-demo';

export interface ToneSliders {
  formality: number;
  warmth: number;
  directness: number;
}

export interface GeneratorInput {
  industry: IndustryId;
  tone: TonePreset | ToneSliders;
  primaryColor?: string | null;
  logo?: Uint8Array | null;
  moodImage?: Uint8Array | null;
  brandFonts?: { display?: string; body?: string } | null;
  competitorRefs?: readonly string[];
  goals?: readonly Goal[];
  locks?: { dimensions?: readonly DimensionId[]; axes?: readonly AxisId[] };
  market?: string;
}

export interface GeneratorResult {
  status: 'ready' | 'warn' | 'needs-editor';
  iterations: number;
  hash: string;
  remixOffer: boolean;
  reasons: string[];
  wcag: { ok: boolean; gaps: string[] };
  distance: DistanceVerdict;
  overlay: SemanticOverride;
  axes: ThemeAxes;
  modules: readonly string[];
  reduce: { fast: '0ms'; base: '0ms'; slow: '0ms' };
  colorSample: ColorSample;
  document: Record<string, unknown>;
}

const TONE_VECTOR: Record<TonePreset, ToneSliders> = {
  'warm-nahbar': { formality: 0.2, warmth: 0.85, directness: 0.6 },
  'sachlich-formal': { formality: 0.9, warmth: 0.2, directness: 0.4 },
  'technisch-praezise': { formality: 0.7, warmth: 0.15, directness: 0.8 },
  'ruhig-vertrauensvoll': { formality: 0.6, warmth: 0.35, directness: 0.3 },
  'energetisch-kuehn': { formality: 0.3, warmth: 0.55, directness: 0.9 },
};

const MODULES: Record<IndustryId, readonly string[]> = {
  'handwerk-regional': ['Dashboard', 'Website Builder', 'Anfragen'],
  'b2b-saas': ['Dashboard', 'AI Studio', 'Automationen'],
  'kanzlei-beratung': ['Dashboard', 'Governance', 'Abrechnung'],
  gesundheit: ['Dashboard', 'Agent Studio', 'Governance'],
};

const FONTS: Record<IndustryId, { display: string; body: string }> = {
  'handwerk-regional': { display: 'Newsreader, Georgia, serif', body: 'Inter, sans-serif' },
  'b2b-saas': { display: 'Space Grotesk, Inter, sans-serif', body: 'Space Grotesk, Inter, sans-serif' },
  'kanzlei-beratung': { display: 'Newsreader, Georgia, serif', body: 'Newsreader, Georgia, serif' },
  gesundheit: { display: 'Inter, sans-serif', body: 'Inter, sans-serif' },
};

const AXES: Record<IndustryId, ThemeAxes> = {
  'handwerk-regional': { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' },
  'b2b-saas': { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' },
  'kanzlei-beratung': { 'header-type': 'solid', 'card-style': 'raised', 'sidebar-form': 'rail' },
  gesundheit: { 'header-type': 'split', 'card-style': 'outlined', 'sidebar-form': 'floating' },
};

const HEADER_OPTIONS = ['solid', 'transparent', 'split', 'editorial'];
const CARD_OPTIONS = ['raised', 'organic', 'glass', 'outlined'];
const SIDEBAR_OPTIONS = ['rail', 'none', 'floating'];

function toneOf(tone: GeneratorInput['tone']): ToneSliders {
  return typeof tone === 'string' ? TONE_VECTOR[tone] : tone;
}

function locked(input: GeneratorInput, dimension: DimensionId): boolean {
  return input.locks?.dimensions?.includes(dimension) ?? false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mixHex(from: string, to: string, amount: number): string {
  const read = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = read(from);
  const b = read(to);
  const channel = (index: number) => Math.round(a[index]! + (b[index]! - a[index]!) * amount).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`.toUpperCase();
}

interface Draft {
  accent: Oklch;
  surfaceL: number;
  fonts: { display: string; body: string };
  scale: number;
  density: number;
  radius: number;
  motionMs: number;
  depth: number;
  imagery: readonly [number, number, number];
  tone: readonly [number, number, number];
  axes: ThemeAxes;
  modules: readonly string[];
}

function textFor(surface: string): { primary: string; inverseSurface: string; inverseText: string } {
  const dark = '#111318';
  const light = '#F7F8FA';
  const primary = contrastRatio(light, surface) >= contrastRatio(dark, surface) ? light : dark;
  return {
    primary,
    inverseSurface: primary,
    inverseText: primary === dark ? light : dark,
  };
}

function ensureSecondary(primary: string, surface: string): string {
  let mix = 0.2;
  let color = mixHex(primary, surface, mix);
  while (mix < 0.8) {
    const gaps = contrastGaps(
      {
        '--color-text-secondary': color,
        '--color-surface-default': surface,
        '--color-surface-raised': surface,
      },
      [
        { name: 's', foreground: '--color-text-secondary', background: '--color-surface-default', minimum: 4.5 },
        { name: 'r', foreground: '--color-text-secondary', background: '--color-surface-raised', minimum: 4.5 },
      ],
    );
    if (gaps.length === 0) return color;
    mix += 0.05;
    color = mixHex(primary, surface, Math.max(0, 0.55 - mix));
  }
  return primary;
}

function controlBorder(surface: string, paper: string): string {
  const candidates = ['#7F8186', '#5C5E62', '#3A3C40', '#222326', '#C6C7CA', '#EEF0F2'];
  for (const color of candidates) {
    if (contrastRatio(color, surface) >= 3 && contrastRatio(color, paper) >= 3) return color;
  }
  return contrastRatio('#111318', surface) >= 3 ? '#111318' : '#F7F8FA';
}

function palette(draft: Draft): SemanticOverride {
  const accent = oklchToHex(draft.accent);
  const surface = oklchToHex({ l: draft.surfaceL, c: 2, h: draft.accent.h });
  const paper = oklchToHex({ l: clamp(draft.surfaceL + 3, 0, 100), c: 1, h: draft.accent.h });
  const text = textFor(surface);
  const secondary = ensureSecondary(text.primary, surface);
  const border = controlBorder(surface, paper);
  const radiusMd = Math.round(4 + draft.radius * 24);
  return {
    'color/surface/default': surface,
    'color/surface/paper': paper,
    'color/surface/subtle': mixHex(surface, text.primary, 0.06),
    'color/surface/raised': paper,
    'color/surface/metric': paper,
    'color/surface/inverse': text.inverseSurface,
    'color/text/primary': text.primary,
    'color/text/secondary': secondary,
    'color/text/muted': secondary,
    'color/text/micro': secondary,
    'color/text/inverse': text.inverseText,
    'color/accent/primary': accent,
    'color/border/default': mixHex(surface, text.primary, 0.12),
    'color/border/control': border,
    'color/border/focus': border,
    'type/family/display': draft.fonts.display,
    'type/family/body': draft.fonts.body,
    'type/size/body': `${Math.round(16 * draft.scale)}px`,
    'space/400': `${Math.round(16 + draft.density * 40)}px`,
    'radius/md': `${radiusMd}px`,
    'radius/lg': `${radiusMd + 6}px`,
    'motion/duration/fast': `${Math.round(draft.motionMs * 0.5)}ms`,
    'motion/duration/base': `${Math.round(draft.motionMs)}ms`,
    'motion/duration/slow': `${Math.round(draft.motionMs * 1.8)}ms`,
    'motion/easing/standard': draft.motionMs > 320 ? 'cubic-bezier(0.33, 1, 0.68, 1)' : 'cubic-bezier(0.2, 0, 0, 1)',
    'depth/2/y': `${Math.round(draft.depth * 24)}px`,
  };
}

function wcagOf(overlay: SemanticOverride): { ok: boolean; gaps: string[] } {
  const style = {
    ...resolveTheme('light-cream'),
    ...(semanticOverrideStyle(overlay) as Record<string, string>),
  };
  const gaps = contrastGaps(style, [...REQUIRED_TEXT_PAIRS, ...REQUIRED_UI_PAIRS]);
  return { ok: gaps.length === 0, gaps: gaps.map((gap) => gap.name) };
}

function fingerprint(id: string, draft: Draft, overlay: SemanticOverride): ThemeFingerprint {
  const style = semanticOverrideStyle(overlay) as Record<string, string>;
  return fingerprintFromVars(id, style, draft.axes, draft.tone, draft.imagery);
}

function derive(input: GeneratorInput): Draft {
  const tone = toneOf(input.tone);
  const sample = input.primaryColor
    ? { hex: input.primaryColor, method: 'embedded-hex' as const }
    : extractColor(input.logo ?? input.moodImage);
  const accent = hexToOklch(sample.hex);
  const dark = input.industry === 'b2b-saas' && tone.warmth < 0.3;
  const surfaceL = dark ? 16 : clamp(96 - tone.formality * 8 + tone.warmth * 2, 12, 98);
  const fonts = input.brandFonts?.display || input.brandFonts?.body
    ? {
      display: input.brandFonts.display ?? FONTS[input.industry].display,
      body: input.brandFonts.body ?? FONTS[input.industry].body,
    }
    : FONTS[input.industry];
  return {
    accent,
    surfaceL,
    fonts,
    scale: 0.9 + tone.formality * 0.2,
    density: tone.warmth * 0.45,
    radius: tone.formality > 0.7 ? 0.15 : 0.35 + tone.warmth * 0.3,
    motionMs: tone.directness > 0.7 ? 160 : 240 + tone.warmth * 200,
    depth: 0.3 + (1 - tone.formality) * 0.4,
    imagery: [tone.warmth, 1 - tone.formality, tone.directness],
    tone: [tone.formality, tone.warmth, tone.directness],
    axes: { ...AXES[input.industry] },
    modules: MODULES[input.industry],
  };
}

function rotateAccent(accent: Oklch, degrees: number): Oklch {
  return { ...accent, h: (accent.h + degrees + 360) % 360 };
}

function adjust(draft: Draft, input: GeneratorInput, nearest: ThemeFingerprint | null, iteration: number): Draft {
  const next = { ...draft, axes: { ...draft.axes }, fonts: { ...draft.fonts } };
  if (!locked(input, 'color') && iteration < 4) {
    const step = [12, -12, 24, -24][iteration] ?? 24;
    next.accent = rotateAccent(draft.accent, step);
    return next;
  }
  if (nearest && iteration < 6) {
    const axis = AXIS_IDS[iteration % AXIS_IDS.length]!;
    if (!input.locks?.axes?.includes(axis)) {
      const options = axis === 'header-type' ? HEADER_OPTIONS : axis === 'card-style' ? CARD_OPTIONS : SIDEBAR_OPTIONS;
      next.axes[axis] = axisCycle(draft.axes[axis], nearest.axes[axis], options);
      return next;
    }
  }
  if (!locked(input, 'density')) next.density = clamp(draft.density + 0.15, 0, 1);
  else if (!locked(input, 'radius')) next.radius = clamp(draft.radius + 0.2, 0, 1);
  return next;
}

function sameDraft(a: Draft, b: Draft): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function validateInput(input: GeneratorInput): void {
  if (!INDUSTRIES.includes(input.industry)) throw new Error('Branche fehlt oder ist nicht in der Taxonomie.');
  if (typeof input.tone === 'string' && !TONE_PRESETS.includes(input.tone)) throw new Error('Tonalität fehlt.');
  if (!input.primaryColor && !input.logo && !input.moodImage) {
    throw new Error('Logo oder Hauptfarbe ist Pflicht.');
  }
}

export function generateTheme(input: GeneratorInput, catalog: ThemeCatalog = fixtureThemeCatalog()): GeneratorResult {
  validateInput(input);
  const sample = input.primaryColor
    ? { hex: input.primaryColor.toUpperCase(), method: 'embedded-hex' as const }
    : extractColor(input.logo ?? input.moodImage);
  let draft = derive({ ...input, primaryColor: sample.hex });
  if (input.brandFonts?.display || input.brandFonts?.body) {
    input = { ...input, locks: { ...input.locks, dimensions: [...(input.locks?.dimensions ?? []), 'type'] } };
  }
  let iterations = 0;
  let overlay = palette(draft);
  let wcag = wcagOf(overlay);
  let distance = distanceVerdict(fingerprint('generated', draft, overlay), catalog.list());
  while (iterations < MAX_ADJUST_ITERATIONS && (!wcag.ok || !distance.hardPass)) {
    const neighbor = distance.nearest
      ? catalog.list().find((theme) => theme.id === distance.nearest?.id) ?? null
      : null;
    const next = !wcag.ok && !locked(input, 'color')
      ? { ...draft, surfaceL: clamp(draft.surfaceL + (draft.surfaceL < 50 ? -6 : 4), 8, 98) }
      : adjust(draft, input, neighbor, iterations);
    if (sameDraft(next, draft)) break;
    draft = next;
    overlay = palette(draft);
    wcag = wcagOf(overlay);
    distance = distanceVerdict(fingerprint('generated', draft, overlay), catalog.list());
    iterations += 1;
  }
  const hash = sha256Hex(canonicalJson({ overlay, axes: draft.axes, modules: draft.modules }));
  const status = !wcag.ok || !distance.hardPass ? 'needs-editor' : distance.remix ? 'warn' : 'ready';
  return {
    status,
    iterations,
    hash,
    remixOffer: distance.remix,
    reasons: [...(wcag.ok ? [] : ['WCAG AA unterschritten']), ...distance.reasons],
    wcag,
    distance,
    overlay,
    axes: draft.axes,
    modules: draft.modules,
    reduce: { fast: '0ms', base: '0ms', slow: '0ms' },
    colorSample: sample,
    document: {
      $description: 'UI-Konzept · Beispieldaten. Generiertes DNA-Overlay, nur semantische Overrides.',
      semantic: overlay,
      $extensions: {
        'com.rsd.meta': {
          axes_not_in_semantic_109: {
            'axis/header-type': draft.axes['header-type'],
            'axis/card-style': draft.axes['card-style'],
            'axis/sidebar-form': draft.axes['sidebar-form'],
          },
          hash,
          modules: draft.modules,
          reduce: { fast: '0ms', base: '0ms', slow: '0ms' },
          tone: draft.tone,
        },
      },
    },
  };
}

export function publishTheme(result: GeneratorResult, catalog: ThemeCatalog = fixtureThemeCatalog()): GeneratorResult {
  const hash = sha256Hex(canonicalJson({ overlay: result.overlay, axes: result.axes, modules: result.modules }));
  const wcag = wcagOf(result.overlay);
  const meta = (result.document.$extensions as { 'com.rsd.meta': { tone?: number[] } })['com.rsd.meta'];
  const tone = meta.tone?.length === 3 ? [meta.tone[0]!, meta.tone[1]!, meta.tone[2]!] as const : [0, 0, 0] as const;
  const distance = distanceVerdict(
    fingerprintFromVars('publish', semanticOverrideStyle(result.overlay) as Record<string, string>, result.axes, tone),
    catalog.list(),
  );
  const hashOk = hash === result.hash;
  const hard = hashOk && wcag.ok && distance.hardPass;
  return {
    ...result,
    hash,
    status: hard ? (distance.remix ? 'warn' : 'ready') : 'needs-editor',
    remixOffer: distance.remix,
    reasons: [
      ...(hashOk ? [] : ['Theme-Hash weicht ab']),
      ...(wcag.ok ? [] : ['WCAG AA unterschritten']),
      ...distance.reasons,
    ],
    wcag,
    distance,
  };
}
