// REBUILD — Design-System aus der vorhandenen Marke.
//
// Aus Farben, Schriften und Radien der Ausgangsseite entsteht ein
// kontrolliertes Token-Set (`DesignSpec`). Kontrolliert heißt:
//
//   • Jede Entscheidung fällt aus einer festen Menge (Kartenstil, Hero-
//     Variante, Abstandsstufe) — kein freies CSS, keine Zufallsfarben.
//   • Die Markenfarbe bleibt im Farbton erhalten; nur ihre Helligkeit wird
//     so weit verschoben, dass WCAG AA (4,5:1) gegen die Fläche erreicht ist.
//   • Hell/Dunkel folgt der Marke, nicht einer Mode: Dunkel nur, wo die
//     Ausgangsseite dunkel ist und die Richtung es trägt.
//   • Was abgeleitet wurde, steht in `notes` — in Sätzen, mit Zahlen.
//
// Schriften werden nicht von Google geladen (Drittanbieter-Abruf,
// TDDDG § 25). Die Markenschrift steht als erste Familie im Stack; ist sie
// auf dem Gerät nicht vorhanden, greift eine gleichartige Systemschrift. Das
// Selbst-Hosten ist ein Schritt der Veröffentlichung und steht als offener
// Punkt in der Checkliste.

import { contrastRatio } from '../render/theme.ts';
import type { DesignSpec, SiteTheme } from '../types.ts';
import { colorDistance, ensureContrast, hexToHsl, hslToHex, isBrandCandidate, isDark, mix } from './color.ts';
import type { SourceSnapshot } from './types.ts';

export type DirectionKey = 'clean-enterprise' | 'conversion-focus' | 'local-trust' | 'premium-advisory';

/** Neutraler Akzent, wenn keine Markenfarbe erkennbar ist — bewusst gewählt, im Hinweis benannt. */
const NEUTRAL_ACCENT = '#1f4fbf';

const SERIF_FAMILIES = [
  'georgia', 'times', 'times new roman', 'merriweather', 'lora', 'playfair display', 'libre baskerville', 'pt serif',
  'source serif', 'source serif pro', 'source serif 4', 'crimson', 'crimson text', 'cormorant', 'cormorant garamond',
  'eb garamond', 'garamond', 'roboto slab', 'zilla slab', 'bitter', 'domine', 'noto serif', 'dm serif display',
  'dm serif text', 'fraunces', 'spectral', 'cardo', 'alegreya', 'arvo', 'rockwell', 'libre caslon text', 'newsreader',
];
const MONO_FAMILIES = ['courier', 'courier new', 'jetbrains mono', 'fira code', 'source code pro', 'ibm plex mono', 'roboto mono', 'space mono', 'dm mono'];

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_FALLBACK = 'Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
const MONO_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface BrandSignals {
  /** Markenfarbe der Quelle, `null` wenn keine erkennbar. */
  brandColor: string | null;
  brandColorEvidence: string[];
  /** Hintergrund der Quelle ist dunkel. */
  darkSource: boolean;
  displayFamily: string | null;
  bodyFamily: string | null;
  fontEvidence: string[];
  /** Median der Radien in px, ohne Pillen-Werte; `null` ohne Angaben. */
  radiusPx: number | null;
  pillButtons: boolean;
}

/** Liest die Markensignale aus allen Seiten des Snapshots. */
export function readBrandSignals(snapshot: SourceSnapshot): BrandSignals {
  // Farben: Gewichte über alle Seiten, nahe Töne zusammengefasst.
  const groups: { hex: string; weight: number; evidence: string[] }[] = [];
  for (const page of snapshot.pages) {
    for (const color of page.colors) {
      if (!isBrandCandidate(color.hex)) continue;
      const group = groups.find((g) => colorDistance(g.hex, color.hex) < 28);
      if (group) {
        group.weight += color.weight;
        if (!group.evidence.includes(color.ev)) group.evidence.push(color.ev);
      } else {
        groups.push({ hex: color.hex, weight: color.weight, evidence: [color.ev] });
      }
    }
  }
  groups.sort((a, b) => b.weight - a.weight || (a.hex < b.hex ? -1 : 1));
  const brand = groups[0] && groups[0].weight >= 3 ? groups[0] : null;

  const home = snapshot.pages[0];
  const background = home?.css.pageBackground ?? null;

  // Schriften: Überschriften-Familie und Textfamilie getrennt.
  const fonts = new Map<string, { family: string; count: number; headingUses: number; ev: string[] }>();
  for (const page of snapshot.pages) {
    for (const font of page.fonts) {
      const key = font.family.toLowerCase();
      const entry = fonts.get(key) ?? { family: font.family, count: 0, headingUses: 0, ev: [] };
      entry.count += font.count;
      entry.headingUses += font.headingUses;
      entry.ev.push(font.ev);
      fonts.set(key, entry);
    }
  }
  const ranked = [...fonts.values()].sort((a, b) => b.count - a.count || (a.family < b.family ? -1 : 1));
  const byHeading = [...fonts.values()].filter((f) => f.headingUses > 0).sort((a, b) => b.headingUses - a.headingUses);
  let body = ranked.find((f) => f.headingUses === 0) ?? ranked[0] ?? null;
  let display = byHeading[0] ?? null;
  if (!display && ranked.length >= 2) {
    // Ohne Überschriften-Selektor: eine Serifenschrift neben einer
    // Grotesk ist fast immer die Überschriftenschrift.
    const serif = ranked.find((f) => classifyFamily(f.family) === 'serif');
    const sans = ranked.find((f) => classifyFamily(f.family) === 'sans');
    if (serif && sans) {
      display = serif;
      body = sans;
    }
  }
  if (display && body && display.family === body.family && ranked.length >= 2) {
    body = ranked.find((f) => f.family !== display!.family) ?? body;
  }

  const radii = snapshot.pages.flatMap((p) => p.css.radiiPx);
  const regular = radii.filter((r) => r < 40).sort((a, b) => a - b);
  const median = regular.length > 0 ? regular[Math.floor(regular.length / 2)] : null;

  return {
    brandColor: brand?.hex ?? null,
    brandColorEvidence: brand?.evidence ?? [],
    darkSource: background !== null && isDark(background),
    displayFamily: display?.family ?? body?.family ?? null,
    bodyFamily: body?.family ?? display?.family ?? null,
    fontEvidence: [...new Set([...(display?.ev ?? []), ...(body?.ev ?? [])])],
    radiusPx: median,
    pillButtons: radii.some((r) => r >= 40),
  };
}

export function classifyFamily(family: string): 'serif' | 'mono' | 'sans' {
  const key = family.toLowerCase();
  if (SERIF_FAMILIES.some((f) => key === f || key.startsWith(`${f} `))) return 'serif';
  if (MONO_FAMILIES.some((f) => key === f)) return 'mono';
  return 'sans';
}

/** Font-Stack mit Markenschrift zuerst und gleichartigem Systemersatz. */
export function fontStack(family: string | null, fallbackClass: 'serif' | 'sans' | 'mono' = 'sans'): string {
  const cls = family ? classifyFamily(family) : fallbackClass;
  const fallback = cls === 'serif' ? SERIF_FALLBACK : cls === 'mono' ? MONO_FALLBACK : SANS_FALLBACK;
  if (!family || !/^[A-Za-z0-9 _-]{2,60}$/.test(family)) return fallback;
  return `"${family}", ${fallback}`;
}

interface DirectionTraits {
  mode: (dark: boolean) => 'light' | 'dark';
  surface: { light: string; dark: string };
  surfaceAlt: { light: (accent: string) => string; dark: (accent: string) => string };
  foreground: { light: string; dark: string };
  displayWeight: DesignSpec['typography']['displayWeight'];
  scale: DesignSpec['typography']['scale'];
  tracking: DesignSpec['typography']['tracking'];
  radius: (source: number | null) => number;
  spacing: DesignSpec['spacing'];
  elevation: DesignSpec['elevation'];
  cards: DesignSpec['cards'];
  sections: DesignSpec['sections'];
  secondary: DesignSpec['buttons']['secondary'];
  hero: DesignSpec['hero'];
  ctaEmphasis: DesignSpec['ctaEmphasis'];
  headerCta: boolean;
  motion: DesignSpec['motion'];
  serifDisplay: boolean;
  label: string;
}

const TRAITS: Readonly<Record<DirectionKey, DirectionTraits>> = {
  'clean-enterprise': {
    mode: (dark) => (dark ? 'dark' : 'light'),
    surface: { light: '#ffffff', dark: '#0b0f17' },
    surfaceAlt: { light: () => '#f5f6f8', dark: () => '#111726' },
    foreground: { light: '#0f172a', dark: '#e7ebf3' },
    displayWeight: 600,
    scale: 'regular',
    tracking: 'tight',
    radius: (r) => clampInt(r ?? 8, 4, 10),
    spacing: 'airy',
    elevation: 'flat',
    cards: 'bordered',
    sections: 'plain',
    secondary: 'outline',
    hero: 'split',
    ctaEmphasis: 'standard',
    headerCta: true,
    motion: 'subtle',
    serifDisplay: false,
    label: 'Clean Enterprise',
  },
  'conversion-focus': {
    mode: () => 'light',
    surface: { light: '#ffffff', dark: '#0b0f17' },
    surfaceAlt: { light: (accent) => mix(accent, '#ffffff', 0.06), dark: () => '#121a2b' },
    foreground: { light: '#111827', dark: '#e7ebf3' },
    displayWeight: 800,
    scale: 'expressive',
    tracking: 'tight',
    radius: (r) => clampInt(Math.max(r ?? 10, 8), 8, 14),
    spacing: 'regular',
    elevation: 'soft',
    cards: 'elevated',
    sections: 'banded',
    secondary: 'ghost',
    hero: 'split',
    ctaEmphasis: 'strong',
    headerCta: true,
    motion: 'subtle',
    serifDisplay: false,
    label: 'Conversion Focus',
  },
  'local-trust': {
    mode: () => 'light',
    surface: { light: '#fbfaf7', dark: '#0f0e0c' },
    surfaceAlt: { light: () => '#f3efe7', dark: () => '#1a1814' },
    foreground: { light: '#1c1917', dark: '#ece7df' },
    displayWeight: 700,
    scale: 'regular',
    tracking: 'normal',
    radius: (r) => clampInt(Math.max(r ?? 12, 10), 10, 16),
    spacing: 'regular',
    elevation: 'soft',
    cards: 'tinted',
    sections: 'banded',
    secondary: 'outline',
    hero: 'centered',
    ctaEmphasis: 'standard',
    headerCta: true,
    motion: 'subtle',
    serifDisplay: false,
    label: 'Local Trust',
  },
  'premium-advisory': {
    mode: (dark) => (dark ? 'dark' : 'light'),
    surface: { light: '#fcfcfa', dark: '#0c0c0e' },
    surfaceAlt: { light: () => '#f4f3ef', dark: () => '#15151a' },
    foreground: { light: '#141414', dark: '#ededea' },
    displayWeight: 600,
    scale: 'expressive',
    tracking: 'tight',
    radius: (r) => clampInt(Math.min(r ?? 2, 4), 0, 4),
    spacing: 'airy',
    elevation: 'flat',
    cards: 'bordered',
    sections: 'plain',
    secondary: 'ghost',
    hero: 'editorial',
    ctaEmphasis: 'standard',
    headerCta: false,
    motion: 'none',
    serifDisplay: true,
    label: 'Premium Advisory',
  },
};

export function directionLabel(key: DirectionKey): string {
  return TRAITS[key].label;
}

/**
 * Leitet das Design-System einer Richtung aus den Markensignalen ab.
 * Deterministisch: gleiche Signale ⇒ gleiches System.
 */
export function deriveDesignSpec(brand: BrandSignals, direction: DirectionKey): DesignSpec {
  const traits = TRAITS[direction];
  const notes: string[] = [];
  const mode = traits.mode(brand.darkSource);
  const surface = mode === 'dark' ? traits.surface.dark : traits.surface.light;
  const foreground = mode === 'dark' ? traits.foreground.dark : traits.foreground.light;

  // ── Akzent ──────────────────────────────────────────────────────────
  const base = brand.brandColor ?? NEUTRAL_ACCENT;
  let accent = ensureContrast(base, surface, 4.5) ?? (mode === 'dark' ? '#8fb3ff' : NEUTRAL_ACCENT);
  if (!brand.brandColor) {
    notes.push(`Keine Markenfarbe erkennbar — neutraler Akzent ${accent}. Bitte durch die Markenfarbe ersetzen.`);
  } else if (accent !== brand.brandColor) {
    const before = contrastRatio(brand.brandColor, surface);
    const after = contrastRatio(accent, surface);
    notes.push(`Markenfarbe ${brand.brandColor} (${fmt(before)}:1 auf ${surface}) im selben Farbton auf ${accent} angepasst (${fmt(after)}:1, WCAG AA).`);
  } else {
    notes.push(`Markenfarbe ${brand.brandColor} übernommen (${fmt(contrastRatio(accent, surface))}:1 auf ${surface}, WCAG AA).`);
  }
  if (direction === 'premium-advisory') {
    // Zurückhaltender: Sättigung um ein Viertel senken, Farbton bleibt.
    const hsl = hexToHsl(accent);
    if (hsl) {
      const calmer = ensureContrast(hslToHex({ ...hsl, s: hsl.s * 0.75 }), surface, 4.5);
      if (calmer) accent = calmer;
    }
  }
  const accentText = pickTextOn(accent, surface);

  // ── Flächen und Text ────────────────────────────────────────────────
  const surfaceAlt = mode === 'dark' ? traits.surfaceAlt.dark(accent) : traits.surfaceAlt.light(accent);
  const muted = ensureContrast(mix(foreground, surface, 0.66), surface, 4.5) ?? foreground;
  const mutedOnAlt = ensureContrast(muted, surfaceAlt, 4.5) ?? foreground;
  const line = mix(foreground, surface, mode === 'dark' ? 0.18 : 0.12);

  // ── Schrift ─────────────────────────────────────────────────────────
  const bodyStack = fontStack(brand.bodyFamily, 'sans');
  let displayStack = fontStack(brand.displayFamily, 'sans');
  if (traits.serifDisplay && (!brand.displayFamily || classifyFamily(brand.displayFamily) !== 'serif')) {
    displayStack = SERIF_FALLBACK;
    notes.push('Überschriften in einer Serifenschrift — die Richtung setzt auf ruhige, beratende Anmutung.');
  }
  if (brand.displayFamily || brand.bodyFamily) {
    const names = [...new Set([brand.displayFamily, brand.bodyFamily].filter(Boolean))].join(' und ');
    notes.push(`Markenschrift ${names} erkannt und an erster Stelle gesetzt; ohne lokale Installation greift eine gleichartige Systemschrift. Für die Auslieferung selbst hosten (kein Abruf bei Google Fonts).`);
  } else {
    notes.push('Keine Markenschrift erkennbar — Systemschrift.');
  }

  // ── Form ────────────────────────────────────────────────────────────
  const control = traits.radius(brand.radiusPx);
  const card = direction === 'premium-advisory' ? control : Math.min(control + 4, 20);
  if (brand.radiusPx !== null) notes.push(`Radien der Quelle im Median ${brand.radiusPx}px → Bedienelemente ${control}px, Karten ${card}px.`);

  return {
    version: 1,
    direction,
    mode,
    // Der gedämpfte Ton muss auf beiden Flächen AA erreichen.
    palette: { accent, accentText, surface, surfaceAlt, foreground, muted: mutedOnAlt, line },
    typography: { display: displayStack, body: bodyStack, displayWeight: traits.displayWeight, scale: traits.scale, tracking: traits.tracking },
    radius: { control, card },
    spacing: traits.spacing,
    elevation: traits.elevation,
    cards: traits.cards,
    sections: traits.sections,
    buttons: { primary: brand.pillButtons && direction !== 'premium-advisory' ? 'pill' : 'solid', secondary: traits.secondary },
    hero: traits.hero,
    ctaEmphasis: traits.ctaEmphasis,
    headerCta: traits.headerCta,
    motion: traits.motion,
    notes,
    brand: {
      color: brand.brandColor,
      displayFamily: brand.displayFamily,
      bodyFamily: brand.bodyFamily,
      radiusPx: brand.radiusPx,
      pill: brand.pillButtons,
      dark: brand.darkSource,
    },
  };
}

/**
 * Markensignale aus einem gespeicherten Design-System — für den
 * Richtungswechsel in einer Verfeinerung. Mit `design.brand` exakt; ohne
 * (ältere Systeme) aus den Werten des Systems selbst genähert.
 */
export function brandFromDesign(design: DesignSpec): BrandSignals {
  const stored = design.brand;
  if (stored) {
    return {
      brandColor: stored.color,
      brandColorEvidence: [],
      darkSource: stored.dark,
      displayFamily: stored.displayFamily,
      bodyFamily: stored.bodyFamily,
      fontEvidence: [],
      radiusPx: stored.radiusPx,
      pillButtons: stored.pill,
    };
  }
  return {
    brandColor: design.palette.accent,
    brandColorEvidence: [],
    darkSource: design.mode === 'dark',
    displayFamily: quotedFamily(design.typography.display),
    bodyFamily: quotedFamily(design.typography.body),
    fontEvidence: [],
    radiusPx: design.radius.control,
    pillButtons: design.buttons.primary === 'pill',
  };
}

/** Markenschrift an erster Stelle eines Stacks (`"Inter", system-ui` → `Inter`); Systemstacks liefern `null`. */
function quotedFamily(stack: string): string | null {
  if (!stack.startsWith('"')) return null;
  const end = stack.indexOf('"', 1);
  return end > 1 ? stack.slice(1, end) : null;
}

/** Textfarbe auf dem Akzent, AA-geprüft — für Verfeinerungen, die den Akzent ändern. */
export function accentTextFor(accent: string, surface: string): string {
  return pickTextOn(accent, surface);
}

/**
 * Neue Palette für ein bestehendes System — nach einer Farb- oder
 * Hell/Dunkel-Anweisung. Alle übrigen Entscheidungen des Systems bleiben
 * stehen (auch solche, die eine frühere Verfeinerung getroffen hat).
 *
 * Die Richtung bestimmt, ob Dunkel überhaupt möglich ist: „Conversion Focus"
 * und „Local Trust" sind hell angelegt. Eine Anweisung, die das nicht
 * einlösen kann, wird benannt statt still übergangen.
 */
export function repaletteDesign(design: DesignSpec, patch: { mode?: 'light' | 'dark'; accent?: string }): { design: DesignSpec; notes: string[] } {
  const key: DirectionKey = design.direction in TRAITS ? (design.direction as DirectionKey) : 'clean-enterprise';
  const traits = TRAITS[key];
  const notes: string[] = [];
  const requested = patch.mode ?? design.mode;
  const mode = traits.mode(requested === 'dark');
  if (requested !== mode) notes.push(`Die Richtung ${traits.label} ist ${mode === 'light' ? 'hell' : 'dunkel'} angelegt — das Farbschema bleibt ${mode === 'light' ? 'hell' : 'dunkel'}.`);
  const surface = mode === 'dark' ? traits.surface.dark : traits.surface.light;
  const foreground = mode === 'dark' ? traits.foreground.dark : traits.foreground.light;

  const base = patch.accent ?? design.brand?.color ?? design.palette.accent;
  let accent = ensureContrast(base, surface, 4.5) ?? (mode === 'dark' ? '#8fb3ff' : NEUTRAL_ACCENT);
  if (patch.accent && accent.toLowerCase() !== patch.accent.toLowerCase()) {
    notes.push(`Farbe ${patch.accent} im selben Farbton auf ${accent} angepasst, damit Schrift darauf WCAG AA erreicht (${fmt(contrastRatio(accent, surface))}:1).`);
  }
  if (key === 'premium-advisory' && !patch.accent) {
    const hsl = hexToHsl(accent);
    const calmer = hsl ? ensureContrast(hslToHex({ ...hsl, s: hsl.s * 0.75 }), surface, 4.5) : null;
    if (calmer) accent = calmer;
  }
  const surfaceAlt = mode === 'dark' ? traits.surfaceAlt.dark(accent) : traits.surfaceAlt.light(accent);
  const muted = ensureContrast(mix(foreground, surface, 0.66), surface, 4.5) ?? foreground;
  const mutedOnAlt = ensureContrast(muted, surfaceAlt, 4.5) ?? foreground;
  const line = mix(foreground, surface, mode === 'dark' ? 0.18 : 0.12);
  return {
    design: {
      ...design,
      mode,
      palette: { accent, accentText: pickTextOn(accent, surface), surface, surfaceAlt, foreground, muted: mutedOnAlt, line },
    },
    notes,
  };
}

/** Neutrale zweite Fläche der Richtung — ohne Akzent-Tönung. */
export function neutralSurfaceAlt(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? TRAITS['clean-enterprise'].surfaceAlt.dark('') : TRAITS['clean-enterprise'].surfaceAlt.light('');
}

/** Das Theme, das zum Design-System gehört (Kontrastprüfung, Kern-Stylesheet). */
export function themeFromDesign(design: DesignSpec): SiteTheme {
  return {
    mode: design.mode,
    accent: design.palette.accent,
    surface: design.palette.surface,
    foreground: design.palette.foreground,
    fontDisplay: design.typography.display,
    fontBody: design.typography.body,
    radiusPx: design.radius.control,
  };
}

/** Textfarbe auf dem Akzent: die Fläche, wenn sie genügt, sonst Weiß oder Tinte. */
function pickTextOn(accent: string, surface: string): string {
  for (const candidate of [surface, '#ffffff', '#0b0f17']) {
    const ratio = contrastRatio(candidate, accent);
    if (ratio !== null && ratio >= 4.5) return candidate;
  }
  return '#ffffff';
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function fmt(value: number | null): string {
  return value === null ? '–' : value.toFixed(2).replace('.', ',');
}
