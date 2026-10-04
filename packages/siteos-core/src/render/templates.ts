import type { SiteBlueprint } from '../types.ts';

// RealSync SiteOS — deterministic public-site design templates.
// Templates are presentation presets only. Compliance, SEO and content remain
// governed by the SiteBlueprint and are never weakened by a visual choice.

export type DesignTemplate = 'modern-minimal' | 'bento-bold' | 'dark-professional';
export type SiteDesignTemplate = DesignTemplate;

type Template = {
  id: DesignTemplate;
  name: string;
  label: string;
  description: string;
  mode: 'light' | 'dark';
  radiusPx: number;
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
};

export const DESIGN_TEMPLATES: ReadonlyArray<Template> = [
  { id: 'modern-minimal', name: 'Modern Minimal', label: 'Modern Minimal', description: 'Helle, klare Premium-Optik mit starker Typografie und ruhiger Informationshierarchie.', mode: 'light', radiusPx: 14, accent: '#145CFF', surface: '#F7F8FA', foreground: '#111827', fontDisplay: 'Inter, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
  { id: 'bento-bold', name: 'Bento Bold', label: 'Bento Bold', description: 'Moderne modulare Kartenstruktur mit markanten Headlines und klaren Conversion-Flächen.', mode: 'light', radiusPx: 18, accent: '#0B63F6', surface: '#F4F7FB', foreground: '#0F172A', fontDisplay: 'Space Grotesk, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
  { id: 'dark-professional', name: 'Dark Professional', label: 'Dark Professional', description: 'Dunkle High-End-Darstellung mit kontrastreicher Typografie und ruhiger Premium-Anmutung.', mode: 'dark', radiusPx: 12, accent: '#5B8CFF', surface: '#090B10', foreground: '#F1F5F9', fontDisplay: 'Space Grotesk, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
];

export const SITE_DESIGN_TEMPLATES: ReadonlyArray<{ id: SiteDesignTemplate; label: string; description: string }> = DESIGN_TEMPLATES.map(({ id, label, description }) => ({ id, label, description }));

export function designTemplateById(id: DesignTemplate): Template {
  return DESIGN_TEMPLATES.find((template) => template.id === id) ?? DESIGN_TEMPLATES[0];
}

export function defaultDesignTemplate(): DesignTemplate {
  return 'bento-bold';
}

export function isDesignTemplate(value: unknown): value is DesignTemplate {
  return typeof value === 'string' && DESIGN_TEMPLATES.some((template) => template.id === value);
}

/**
 * Überträgt eine Vorlage vollständig auf das Theme — Farben, Radius **und**
 * Schriften. Bis 2026-10 fehlten die Schriften: Die Vorschau zeigte die
 * Vorlage mit den Schriften des Bauplans, obwohl jede Vorlage eigene führt.
 */
export function applySiteDesignTemplate(blueprint: SiteBlueprint, template: SiteDesignTemplate): SiteBlueprint {
  const selected = designTemplateById(template);
  return {
    ...blueprint,
    theme: {
      ...blueprint.theme,
      mode: selected.mode,
      accent: selected.accent,
      surface: selected.surface,
      foreground: selected.foreground,
      fontDisplay: selected.fontDisplay,
      fontBody: selected.fontBody,
      radiusPx: selected.radiusPx,
    },
  };
}

/**
 * Welche Vorlage trägt dieses Theme? `null`, wenn keine passt — dann hat der
 * Bauplan ein eigenes Theme (aus dem Erstbau oder einer Verfeinerung), und
 * der Editor darf es nicht stillschweigend durch eine Vorlage ersetzen.
 */
export function matchDesignTemplate(theme: SiteBlueprint['theme'] | undefined): DesignTemplate | null {
  if (!theme) return null;
  const same = (a: unknown, b: string) => String(a ?? '').trim().toLowerCase() === b.toLowerCase();
  const match = DESIGN_TEMPLATES.find((t) =>
    theme.mode === t.mode
    && same(theme.accent, t.accent)
    && same(theme.surface, t.surface)
    && same(theme.foreground, t.foreground)
    && same(theme.fontDisplay, t.fontDisplay)
    && same(theme.fontBody, t.fontBody)
    && Number(theme.radiusPx) === t.radiusPx);
  return match?.id ?? null;
}
