// RealSync SiteOS — deterministic public-site design templates.
// Templates are presentation presets only. Compliance, SEO and content remain
// governed by the SiteBlueprint and are never weakened by a visual choice.

export type DesignTemplate = 'modern-minimal' | 'bento-bold' | 'dark-professional';

export const DESIGN_TEMPLATES: ReadonlyArray<{
  id: DesignTemplate;
  name: string;
  description: string;
  mode: 'light' | 'dark';
  radiusPx: number;
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
}> = [
  {
    id: 'modern-minimal',
    name: 'Modern Minimal',
    description: 'Helle, klare Premium-Optik mit starker Typografie und ruhiger Informationshierarchie.',
    mode: 'light',
    radiusPx: 14,
    accent: '#145CFF',
    surface: '#F7F8FA',
    foreground: '#111827',
    fontDisplay: 'Inter, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'bento-bold',
    name: 'Bento Bold',
    description: 'Moderne modulare Kartenstruktur mit markanten Headlines und klaren Conversion-Flächen.',
    mode: 'light',
    radiusPx: 18,
    accent: '#0B63F6',
    surface: '#F4F7FB',
    foreground: '#0F172A',
    fontDisplay: 'Space Grotesk, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'dark-professional',
    name: 'Dark Professional',
    description: 'Dunkle High-End-Darstellung mit kontrastreicher Typografie und ruhiger Premium-Anmutung.',
    mode: 'dark',
    radiusPx: 12,
    accent: '#5B8CFF',
    surface: '#090B10',
    foreground: '#F1F5F9',
    fontDisplay: 'Space Grotesk, system-ui, sans-serif',
    fontBody: 'Inter, system-ui, sans-serif',
  },
];

export function designTemplateById(id: DesignTemplate): (typeof DESIGN_TEMPLATES)[number] {
  return DESIGN_TEMPLATES.find((template) => template.id === id) ?? DESIGN_TEMPLATES[0];
}

/** Deterministic default: customers can override it during preview. */
export function defaultDesignTemplate(): DesignTemplate {
  return 'bento-bold';
}
