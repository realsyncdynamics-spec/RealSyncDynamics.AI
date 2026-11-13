import dnaJson from '../dna-tokens.json';
import { DNA_MODES, dnaOverlayStyle, type DnaModeId } from '../dna';
import { resolveTheme } from '../resolve';
import { classifyFamily, type ThemeAxes, type ThemeFingerprint } from './distance';
import { hexToOklch } from './oklch';

export interface ThemeCatalog {
  list(): readonly ThemeFingerprint[];
}

function numberOf(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

function axesOf(mode: DnaModeId): ThemeAxes {
  const meta = (dnaJson as { $extensions: { 'com.rsd.meta': Record<string, unknown> } }).$extensions['com.rsd.meta'];
  const bag = (meta.axes_not_in_semantic_111 ?? meta.axes_not_in_semantic_109) as Record<string, unknown>;
  const read = (key: string, fallback: string) => {
    const value = bag?.[key];
    if (value && typeof value === 'object' && mode in value) return String((value as Record<string, string>)[mode]);
    return fallback;
  };
  return {
    'header-type': read('axis/header-type', 'solid'),
    'card-style': read('axis/card-style', 'raised'),
    'sidebar-form': read('axis/sidebar-form', 'rail'),
  };
}

const TONE: Record<DnaModeId, readonly [number, number, number]> = {
  'beispiel-handwerk': [0.2, 0.85, 0.6],
  'beispiel-b2b-saas': [0.7, 0.15, 0.8],
  'beispiel-kanzlei': [0.9, 0.2, 0.4],
};

export function fingerprintFromVars(
  id: string,
  vars: Record<string, string>,
  axes: ThemeAxes,
  tone: readonly [number, number, number],
  imagery: readonly [number, number, number] = [0.5, 0.5, 0.5],
): ThemeFingerprint {
  const family = vars['--type-family-display'] || vars['--type-family-sans'] || 'Inter';
  const body = vars['--type-family-body'] || family;
  const accent = hexToOklch(vars['--color-accent-primary'] || '#2457E6');
  const surface = hexToOklch(vars['--color-surface-default'] || '#F7F3EB');
  return {
    id,
    accent,
    surfaceL: surface.l,
    typeClass: { display: classifyFamily(family), body: classifyFamily(body) },
    scale: numberOf(vars['--type-size-body'], 16) / 16,
    density: (numberOf(vars['--space-400'], 24) - 16) / 40,
    radius: numberOf(vars['--radius-md'], 10) / 28,
    motionMs: numberOf(vars['--motion-duration-base'], 200),
    depth: numberOf(vars['--depth-2-y'], 14) / 24,
    imagery,
    tone,
    axes,
  };
}

export function fixtureThemeCatalog(): ThemeCatalog {
  const base = resolveTheme('light-cream');
  const themes = DNA_MODES.map((mode) => {
    const overlay = dnaOverlayStyle(mode) as Record<string, string>;
    return fingerprintFromVars(mode, { ...base, ...overlay }, axesOf(mode), TONE[mode]);
  });
  return { list: () => themes };
}
