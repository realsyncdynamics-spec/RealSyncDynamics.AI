// Startwerte aus Draft #2197 (`INDUSTRY_THEMES`), übernommen in den
// DNA-Adapter. #2197 wird hier nicht geändert und nicht geschlossen.
//
// `sonstiges` hat dort keinen Eintrag und behält den Plattform-Default.
// `radiusPx` ist mit abgeschrieben und wird nicht als zweite Palette
// in den Renderer geschrieben. Den Radius setzt der Generator über
// `radius/md`.

import type { IndustryId, TonePreset } from '../../../app/theme/generator/generate';
import type { IndustryKey } from '../../../../packages/siteos-core/src/types';

export interface IndustryThemeSeed {
  mode: 'dark' | 'light';
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
  radiusPx: number;
}

export const INDUSTRY_THEME_SEEDS: Partial<Record<IndustryKey, IndustryThemeSeed>> = {
  zahnarzt: {
    mode: 'light',
    accent: '#0F766E',
    surface: '#F4F9F9',
    foreground: '#0E2A2F',
    fontDisplay: 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    fontBody: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
    radiusPx: 16,
  },
  arztpraxis: {
    mode: 'light',
    accent: '#1D4ED8',
    surface: '#F5F8FC',
    foreground: '#0F1E33',
    fontDisplay: 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    fontBody: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
    radiusPx: 14,
  },
  rechtsanwalt: {
    mode: 'dark',
    accent: '#D4B26A',
    surface: '#0D1420',
    foreground: '#E9EDF3',
    fontDisplay: 'Georgia, Times New Roman, serif',
    fontBody: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
    radiusPx: 2,
  },
  steuerberatung: {
    mode: 'light',
    accent: '#1E5A46',
    surface: '#F7F7F4',
    foreground: '#1A2230',
    fontDisplay: 'Georgia, Times New Roman, serif',
    fontBody: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
    radiusPx: 6,
  },
  handwerk: {
    mode: 'light',
    accent: '#9A3412',
    surface: '#F5F3EE',
    foreground: '#1C1917',
    fontDisplay: 'Arial Black, Helvetica Neue, Arial, sans-serif',
    fontBody: 'Helvetica Neue, Arial, sans-serif',
    radiusPx: 4,
  },
  gastronomie: {
    mode: 'light',
    accent: '#8A2342',
    surface: '#FBF5EC',
    foreground: '#2A1A12',
    fontDisplay: 'Georgia, Cambria, Times New Roman, serif',
    fontBody: 'Helvetica Neue, Arial, sans-serif',
    radiusPx: 20,
  },
  immobilien: {
    mode: 'dark',
    accent: '#9CC5B2',
    surface: '#101418',
    foreground: '#EEF0F2',
    fontDisplay: 'Helvetica Neue, Arial, sans-serif',
    fontBody: 'Helvetica Neue, Arial, sans-serif',
    radiusPx: 10,
  },
  agentur: {
    mode: 'dark',
    accent: '#B49CFB',
    surface: '#0B0B0F',
    foreground: '#F4F4F5',
    fontDisplay: 'Helvetica Neue, Arial, sans-serif',
    fontBody: 'Helvetica Neue, Arial, sans-serif',
    radiusPx: 18,
  },
  ecommerce: {
    mode: 'light',
    accent: '#B5164F',
    surface: '#FFFFFF',
    foreground: '#111111',
    fontDisplay: 'Helvetica Neue, Arial, sans-serif',
    fontBody: 'Helvetica Neue, Arial, sans-serif',
    radiusPx: 12,
  },
};

/**
 * Abbildung auf die vier Generator-Branchen aus #2216.
 * Die drei markierten Zeilen sind Annahmen: die Taxonomie hat dafür keinen eigenen Namen.
 */
export const INDUSTRY_GENERATOR_MAP: Partial<
  Record<IndustryKey, { generatorIndustry: IndustryId; tone: TonePreset; assumption: boolean }>
> = {
  zahnarzt: { generatorIndustry: 'gesundheit', tone: 'ruhig-vertrauensvoll', assumption: false },
  arztpraxis: { generatorIndustry: 'gesundheit', tone: 'ruhig-vertrauensvoll', assumption: false },
  rechtsanwalt: { generatorIndustry: 'kanzlei-beratung', tone: 'sachlich-formal', assumption: false },
  steuerberatung: { generatorIndustry: 'kanzlei-beratung', tone: 'sachlich-formal', assumption: false },
  handwerk: { generatorIndustry: 'handwerk-regional', tone: 'warm-nahbar', assumption: false },
  gastronomie: { generatorIndustry: 'handwerk-regional', tone: 'warm-nahbar', assumption: true },
  immobilien: { generatorIndustry: 'b2b-saas', tone: 'sachlich-formal', assumption: true },
  agentur: { generatorIndustry: 'b2b-saas', tone: 'technisch-praezise', assumption: false },
  ecommerce: { generatorIndustry: 'b2b-saas', tone: 'energetisch-kuehn', assumption: true },
};
