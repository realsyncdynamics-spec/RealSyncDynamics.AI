import type { SiteBlueprint } from '../types.ts';

export type SiteDesignTemplate = 'modern-minimal' | 'bento-bold' | 'dark-professional';

export const SITE_DESIGN_TEMPLATES: ReadonlyArray<{ id: SiteDesignTemplate; label: string; description: string }> = [
  { id: 'modern-minimal', label: 'Modern Minimal', description: 'Klar, hell, typografisch und conversion-orientiert.' },
  { id: 'bento-bold', label: 'Bento Bold', description: 'Karten, starke Kontraste und moderne Informationshierarchie.' },
  { id: 'dark-professional', label: 'Dark Professional', description: 'Dunkle Premium-Anmutung mit fokussierter Navigation.' },
];

export function applySiteDesignTemplate(blueprint: SiteBlueprint, template: SiteDesignTemplate): SiteBlueprint {
  const themes = {
    'modern-minimal': { mode: 'light' as const, accent: '#155EEF', surface: '#F8FAFC', foreground: '#101828', radiusPx: 14 },
    'bento-bold': { mode: 'light' as const, accent: '#7F56D9', surface: '#F9FAFB', foreground: '#101828', radiusPx: 18 },
    'dark-professional': { mode: 'dark' as const, accent: '#67E8F9', surface: '#05070D', foreground: '#F8FAFC', radiusPx: 12 },
  };
  return { ...blueprint, theme: { ...blueprint.theme, ...themes[template] } };
}
