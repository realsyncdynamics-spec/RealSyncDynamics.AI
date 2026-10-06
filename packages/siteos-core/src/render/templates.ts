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
 * Überträgt eine Vorlage vollständig auf das Theme. Compliance, Inhalte und
 * Seitenstruktur bleiben unverändert; Farben, Radius und Schriften stammen
 * ausschließlich aus dem Template-Katalog des Kerns.
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
 * Erkennt, ob ein gespeichertes Theme exakt einer bekannten Vorlage
 * entspricht. `null` bedeutet eigenes Theme — niemals still auf einen
 * Default zurückfallen.
 */
export function matchDesignTemplate(theme: SiteBlueprint['theme'] | undefined): DesignTemplate | null {
  if (!theme) return null;
  const same = (a: unknown, b: string) => String(a ?? '').trim().toLowerCase() === b.toLowerCase();
  const match = DESIGN_TEMPLATES.find((template) =>
    theme.mode === template.mode
    && same(theme.accent, template.accent)
    && same(theme.surface, template.surface)
    && same(theme.foreground, template.foreground)
    && same(theme.fontDisplay, template.fontDisplay)
    && same(theme.fontBody, template.fontBody)
    && Number(theme.radiusPx) === template.radiusPx);
  return match?.id ?? null;
}
