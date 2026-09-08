import type { SiteBlueprint } from '../types.ts';

// RealSync SiteOS — deterministic public-site design templates.
// Templates are presentation presets only. Compliance, SEO and content remain
// governed by the SiteBlueprint and are never weakened by a visual choice.
//
// Schriftstacks nutzen Systemschriften. Ein Google-Fonts-Request wäre eine
// Drittland-Übertragung vor Einwilligung (TDDDG § 25) — deshalb kein
// `fonts.googleapis.com`, auch nicht in der Vorschau.

export type DesignTemplate =
  | 'modern-minimal'
  | 'bento-bold'
  | 'dark-professional'
  | 'enterprise-8k'
  | 'cinematic-obsidian'
  | 'editorial-trust';
export type SiteDesignTemplate = DesignTemplate;

type Template = {
  id: DesignTemplate;
  name: string;
  label: string;
  description: string;
  /** Sichtbares Abzeichen in der Vorlagenauswahl. Rein beschreibend. */
  tag: 'Studio' | '8K';
  mode: 'light' | 'dark';
  radiusPx: number;
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
};

export const DESIGN_TEMPLATES: ReadonlyArray<Template> = [
  // European Enterprise Trust (CLAUDE.md §10): Petrol auf Slate, ruhige Radien.
  // Kontrast foreground/surface und accent/surface für großen Text ist in
  // test/siteos/enterprise-templates.test.ts gegen WCAG AA gehalten.
  { id: 'enterprise-8k', name: 'Enterprise 8K', label: 'Enterprise 8K', description: 'Cinematic Light-Theme in 8K-Anmutung: große Typografie, Haarlinien, Petrol-Akzent, Conversion-Führung wie ein Framer-Enterprise-Auftritt.', tag: '8K', mode: 'light', radiusPx: 12, accent: '#0F766E', surface: '#F8FAFC', foreground: '#0F172A', fontDisplay: 'Avenir Next, Segoe UI, Helvetica Neue, system-ui, sans-serif', fontBody: 'Inter, Segoe UI, system-ui, sans-serif' },
  { id: 'cinematic-obsidian', name: 'Cinematic Obsidian', label: 'Cinematic Obsidian', description: 'Dunkle Kinoleinwand: Obsidian-Grund, Titanium-Schrift, weiter Satzspiegel. Für Marken, die nachts verkaufen.', tag: '8K', mode: 'dark', radiusPx: 0, accent: '#7AA2FF', surface: '#05060A', foreground: '#E8E6E1', fontDisplay: 'Avenir Next, Segoe UI, system-ui, sans-serif', fontBody: 'Inter, Segoe UI, system-ui, sans-serif' },
  { id: 'editorial-trust', name: 'Editorial Trust', label: 'Editorial Trust', description: 'Magazin-Satz mit Serifen-Display. Vertrauen durch Weißraum, nicht durch Effekte — Kanzlei, Praxis, Beratung.', tag: '8K', mode: 'light', radiusPx: 10, accent: '#0F766E', surface: '#F7F4EE', foreground: '#1C1917', fontDisplay: 'Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif', fontBody: 'Georgia, Iowan Old Style, serif' },
  { id: 'modern-minimal', name: 'Modern Minimal', label: 'Modern Minimal', description: 'Helle, klare Premium-Optik mit starker Typografie und ruhiger Informationshierarchie.', tag: 'Studio', mode: 'light', radiusPx: 14, accent: '#145CFF', surface: '#F7F8FA', foreground: '#111827', fontDisplay: 'Inter, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
  { id: 'bento-bold', name: 'Bento Bold', label: 'Bento Bold', description: 'Moderne modulare Kartenstruktur mit markanten Headlines und klaren Conversion-Flächen.', tag: 'Studio', mode: 'light', radiusPx: 18, accent: '#0B63F6', surface: '#F4F7FB', foreground: '#0F172A', fontDisplay: 'Avenir Next, Segoe UI, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
  { id: 'dark-professional', name: 'Dark Professional', label: 'Dark Professional', description: 'Dunkle High-End-Darstellung mit kontrastreicher Typografie und ruhiger Premium-Anmutung.', tag: 'Studio', mode: 'dark', radiusPx: 12, accent: '#5B8CFF', surface: '#090B10', foreground: '#F1F5F9', fontDisplay: 'Avenir Next, Segoe UI, system-ui, sans-serif', fontBody: 'Inter, system-ui, sans-serif' },
];

export const SITE_DESIGN_TEMPLATES: ReadonlyArray<{
  id: SiteDesignTemplate;
  label: string;
  description: string;
  tag: Template['tag'];
  mode: Template['mode'];
  accent: string;
  surface: string;
  foreground: string;
}> = DESIGN_TEMPLATES.map(({ id, label, description, tag, mode, accent, surface, foreground }) => ({
  id, label, description, tag, mode, accent, surface, foreground,
}));

export function designTemplateById(id: DesignTemplate): Template {
  return DESIGN_TEMPLATES.find((template) => template.id === id) ?? DESIGN_TEMPLATES[0];
}

export function defaultDesignTemplate(): DesignTemplate {
  return 'enterprise-8k';
}

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
      radiusPx: selected.radiusPx,
      // Schriften gehörten schon zum Template, landeten aber nie im Theme.
      // Ohne diese Zeilen wechselte die Vorlagenauswahl nur Farben — und
      // wirkte bedienbar, ohne die Anmutung zu ändern.
      fontDisplay: selected.fontDisplay,
      fontBody: selected.fontBody,
    },
  };
}
