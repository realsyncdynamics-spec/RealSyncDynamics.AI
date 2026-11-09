// Branchen-Presets für den AI Builder.
//
// Single Source of Truth: Seitenplan, Compliance-Profil und schema.org-Typ
// je Branche. Der Builder erzeugt daraus deterministisch das Gerüst; das
// Sprachmodell füllt anschließend nur noch Copy. Diese Trennung ist
// Absicht — das Compliance-Gerüst darf nicht vom Modell abhängen.

import type { BlockKind, ComplianceProfile, IndustryKey, Locale, SiteTheme } from '../types.ts';

export interface IndustryPreset {
  key: IndustryKey;
  label: string;
  /** schema.org-Typ für JSON-LD. */
  structuredDataType: string;
  /** Seitenplan: Pfad → Blockfolge. Reihenfolge ist bedeutungstragend. */
  pagePlan: { path: string; title: string; blocks: BlockKind[]; noindex?: boolean }[];
  /**
   * Compliance-Grundprofil der Branche. Blockspezifische Zusätze
   * (z. B. Kontaktformular ⇒ Art. 6 Abs. 1 lit. b) kommen im Builder dazu.
   */
  compliance: Omit<ComplianceProfile, 'consentCategories'>;
  /** Begriffe, die den Prompt dieser Branche zuordnen (kleingeschrieben). */
  promptTerms: string[];
}

/** Seiten, die jede Site nach deutschem Recht führen muss. */
const LEGAL_PAGES: IndustryPreset['pagePlan'] = [
  { path: '/impressum', title: 'Impressum', blocks: ['navigation', 'legal-text', 'footer'] },
  { path: '/datenschutz', title: 'Datenschutzerklärung', blocks: ['navigation', 'legal-text', 'footer'] },
  { path: '/barrierefreiheit', title: 'Erklärung zur Barrierefreiheit', blocks: ['navigation', 'legal-text', 'footer'] },
];

/**
 * Heilberufe verarbeiten Gesundheitsdaten (Art. 9 DSGVO) — sobald eine
 * Terminbuchung existiert, ist eine DSFA indiziert.
 */
const HEALTHCARE_COMPLIANCE: IndustryPreset['compliance'] = {
  specialCategories: true,
  legalBases: ['Art. 6 Abs. 1 lit. b DSGVO', 'Art. 9 Abs. 2 lit. h DSGVO'],
  policyPackIds: ['dsgvo-core', 'dsgvo-health', 'eu-ai-act-transparency'],
  controlRefs: ['GDPR-ART-9', 'GDPR-ART-32', 'GDPR-ART-35'],
  dpiaRequired: true,
};

const PROFESSIONAL_COMPLIANCE: IndustryPreset['compliance'] = {
  specialCategories: false,
  legalBases: ['Art. 6 Abs. 1 lit. b DSGVO'],
  policyPackIds: ['dsgvo-core', 'eu-ai-act-transparency'],
  controlRefs: ['GDPR-ART-6', 'GDPR-ART-32'],
  dpiaRequired: false,
};

export const INDUSTRY_PRESETS: Readonly<Record<IndustryKey, IndustryPreset>> = Object.freeze({
  zahnarzt: {
    key: 'zahnarzt',
    label: 'Zahnarztpraxis',
    structuredDataType: 'Dentist',
    promptTerms: ['zahnarzt', 'zahnärztin', 'zahnarztpraxis', 'dentist', 'kieferorthopäd'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'team', 'testimonials', 'faq', 'cta', 'footer'] },
      { path: '/leistungen', title: 'Leistungen', blocks: ['navigation', 'hero', 'services', 'faq', 'cta', 'footer'] },
      { path: '/praxis', title: 'Praxis', blocks: ['navigation', 'hero', 'about', 'team', 'footer'] },
      { path: '/termin', title: 'Termin vereinbaren', blocks: ['navigation', 'booking', 'contact-form', 'map', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: HEALTHCARE_COMPLIANCE,
  },

  arztpraxis: {
    key: 'arztpraxis',
    label: 'Arztpraxis',
    structuredDataType: 'MedicalClinic',
    promptTerms: ['arzt', 'ärztin', 'arztpraxis', 'hausarzt', 'facharzt', 'physiotherap', 'heilprakt'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'team', 'faq', 'cta', 'footer'] },
      { path: '/leistungen', title: 'Leistungen', blocks: ['navigation', 'hero', 'services', 'faq', 'footer'] },
      { path: '/team', title: 'Team', blocks: ['navigation', 'team', 'about', 'footer'] },
      { path: '/termin', title: 'Termin vereinbaren', blocks: ['navigation', 'booking', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: HEALTHCARE_COMPLIANCE,
  },

  rechtsanwalt: {
    key: 'rechtsanwalt',
    label: 'Rechtsanwaltskanzlei',
    structuredDataType: 'LegalService',
    promptTerms: ['rechtsanwalt', 'anwalt', 'kanzlei', 'notar', 'jurist'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'team', 'testimonials', 'cta', 'footer'] },
      { path: '/rechtsgebiete', title: 'Rechtsgebiete', blocks: ['navigation', 'hero', 'services', 'faq', 'footer'] },
      { path: '/kanzlei', title: 'Kanzlei', blocks: ['navigation', 'about', 'team', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: {
      specialCategories: false,
      // Mandatsanbahnung berührt regelmäßig das Berufsgeheimnis (§ 203 StGB).
      legalBases: ['Art. 6 Abs. 1 lit. b DSGVO', 'Art. 6 Abs. 1 lit. c DSGVO'],
      policyPackIds: ['dsgvo-core', 'dsgvo-confidentiality', 'eu-ai-act-transparency'],
      controlRefs: ['GDPR-ART-6', 'GDPR-ART-32', 'GDPR-ART-28'],
      dpiaRequired: false,
    },
  },

  steuerberatung: {
    key: 'steuerberatung',
    label: 'Steuerberatung',
    structuredDataType: 'AccountingService',
    promptTerms: ['steuerberat', 'wirtschaftsprüf', 'buchhalt', 'lohnbuchhaltung'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'team', 'cta', 'footer'] },
      { path: '/leistungen', title: 'Leistungen', blocks: ['navigation', 'hero', 'services', 'faq', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },

  handwerk: {
    key: 'handwerk',
    label: 'Handwerksbetrieb',
    structuredDataType: 'HomeAndConstructionBusiness',
    promptTerms: ['handwerk', 'maler', 'tischler', 'schreiner', 'elektrik', 'sanitär', 'dachdeck', 'installateur', 'bau'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'testimonials', 'cta', 'footer'] },
      { path: '/leistungen', title: 'Leistungen', blocks: ['navigation', 'hero', 'services', 'faq', 'footer'] },
      { path: '/referenzen', title: 'Referenzen', blocks: ['navigation', 'testimonials', 'about', 'footer'] },
      { path: '/anfrage', title: 'Anfrage', blocks: ['navigation', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },

  gastronomie: {
    key: 'gastronomie',
    label: 'Gastronomie',
    structuredDataType: 'Restaurant',
    promptTerms: ['restaurant', 'gastronom', 'café', 'cafe', 'bistro', 'bäckerei', 'hotel', 'pizzeria'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'features', 'services', 'testimonials', 'cta', 'footer'] },
      { path: '/speisekarte', title: 'Speisekarte', blocks: ['navigation', 'hero', 'services', 'footer'] },
      { path: '/reservierung', title: 'Reservierung', blocks: ['navigation', 'booking', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },

  immobilien: {
    key: 'immobilien',
    label: 'Immobilien',
    structuredDataType: 'RealEstateAgent',
    promptTerms: ['immobilien', 'makler', 'hausverwaltung', 'wohnung'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'services', 'features', 'testimonials', 'cta', 'footer'] },
      { path: '/angebote', title: 'Angebote', blocks: ['navigation', 'hero', 'services', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'map', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },

  agentur: {
    key: 'agentur',
    label: 'Agentur / Dienstleistung',
    structuredDataType: 'ProfessionalService',
    // Planende und gestaltende Büros fallen fachlich hierher: dieselbe
    // Rechtsgrundlage, derselbe Seitenschnitt aus Leistungen, Team, Kontakt.
    promptTerms: [
      'agentur', 'beratung', 'consulting', 'marketing', 'dienstleist', 'coach',
      'architekt', 'ingenieur', 'planungsbüro', 'designbüro', 'fotograf', 'atelier',
    ],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'features', 'services', 'testimonials', 'faq', 'cta', 'footer'] },
      { path: '/leistungen', title: 'Leistungen', blocks: ['navigation', 'hero', 'services', 'faq', 'footer'] },
      { path: '/ueber-uns', title: 'Über uns', blocks: ['navigation', 'about', 'team', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },

  ecommerce: {
    key: 'ecommerce',
    label: 'Onlinehandel',
    structuredDataType: 'OnlineStore',
    promptTerms: ['shop', 'onlineshop', 'e-commerce', 'ecommerce', 'händler', 'store'],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'features', 'services', 'testimonials', 'cta', 'footer'] },
      { path: '/sortiment', title: 'Sortiment', blocks: ['navigation', 'hero', 'services', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'footer'] },
      { path: '/agb', title: 'AGB', blocks: ['navigation', 'legal-text', 'footer'] },
      { path: '/widerruf', title: 'Widerrufsbelehrung', blocks: ['navigation', 'legal-text', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: {
      specialCategories: false,
      legalBases: ['Art. 6 Abs. 1 lit. b DSGVO', 'Art. 6 Abs. 1 lit. f DSGVO'],
      policyPackIds: ['dsgvo-core', 'dsgvo-ecommerce', 'eu-ai-act-transparency'],
      controlRefs: ['GDPR-ART-6', 'GDPR-ART-13', 'GDPR-ART-32'],
      dpiaRequired: false,
    },
  },

  sonstiges: {
    key: 'sonstiges',
    label: 'Allgemein',
    structuredDataType: 'Organization',
    promptTerms: [],
    pagePlan: [
      { path: '/', title: 'Startseite', blocks: ['navigation', 'hero', 'features', 'services', 'faq', 'cta', 'footer'] },
      { path: '/kontakt', title: 'Kontakt', blocks: ['navigation', 'contact-form', 'footer'] },
      ...LEGAL_PAGES,
    ],
    compliance: PROFESSIONAL_COMPLIANCE,
  },
});

/**
 * Erscheinungsbild je Branche — Startwert einer neuen Site, kein Zwang.
 *
 * Bisher bekam jede Branche dasselbe Plattform-Theme (Obsidian, Blau,
 * eckig); Zahnarzt, Restaurant und Dachdecker sahen gleich aus. Diese
 * Tabelle gibt jeder Branche eine eigene Ausgangslage. Alles Weitere bleibt
 * wie gehabt: `options.theme`, Vorlagen und die Verfeinerung („mach es
 * dunkel") überschreiben die Werte.
 *
 * Regeln:
 * - Nur Systemschrift-Stapel: generierte Sites laden keine Fremd-Fonts.
 * - Jedes Farbpaar (Text/Fläche, Akzent/Fläche) besteht WCAG AA; der Test
 *   `siteos/industry-themes.test.ts` hält das für alle Branchen fest.
 * - `sonstiges` bleibt beim Plattform-Default.
 */
export const INDUSTRY_THEMES: Readonly<Partial<Record<IndustryKey, Partial<SiteTheme>>>> = Object.freeze({
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
    accent: '#A63A1E',
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
});

export function getIndustryTheme(key: IndustryKey): Partial<SiteTheme> {
  return INDUSTRY_THEMES[key] ?? {};
}

export function getIndustryPreset(key: IndustryKey): IndustryPreset {
  return INDUSTRY_PRESETS[key] ?? INDUSTRY_PRESETS.sonstiges;
}

/** Standardsprachen einer neuen Site. */
export const DEFAULT_LOCALES: { default: Locale; supported: Locale[] } = Object.freeze({
  default: 'de' as Locale,
  supported: ['de'] as Locale[],
});
