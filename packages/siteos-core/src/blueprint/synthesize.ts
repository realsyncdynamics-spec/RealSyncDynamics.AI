// Brief → SiteBlueprint.
//
// Kern des AI Builders. Die Synthese ist vollständig deterministisch: gleicher
// Brief ⇒ gleicher Blueprint ⇒ gleicher Hash. Das ist die Voraussetzung
// dafür, dass ein Blueprint überhaupt beweisbar ist — ein Nachweis über eine
// Struktur, die sich bei jedem Aufruf ändert, wäre wertlos.
//
// Nicht-deterministisch sind allein `origin.createdAt` und `origin.model`;
// beide sind Metadaten und werden vom Aufrufer gesetzt.

import type {
  BlockKind,
  ComplianceProfile,
  SiteBlock,
  SiteBlueprint,
  SitePage,
  SiteTheme,
} from '../types.ts';
import type { SiteBrief } from './brief.ts';
import { getIndustryPreset } from './industries.ts';

const EPOCH_ISO = new Date(0).toISOString();

export interface SynthesizeOptions {
  /** Quelle des Blueprints. Steuert die Transparenzpflicht (Art. 50 AI Act). */
  source?: SiteBlueprint['origin']['source'];
  model?: string | null;
  promptSha256?: string | null;
  createdAt?: string;
  theme?: Partial<SiteTheme>;
}

/**
 * Hard-Edge-Industrial als Plattform-Default (siehe CLAUDE.md).
 *
 * Der Akzent ist die aufgehellte Variante des Marken-Blaus: #0052FF
 * erreicht auf Obsidian nur 3.44:1 und verfehlt WCAG AA. Begründung im
 * Detail bei THEME_FALLBACK in render/theme.ts — beide Werte müssen
 * übereinstimmen.
 */
const DEFAULT_THEME: SiteTheme = Object.freeze({
  mode: 'dark',
  accent: '#4C82FF',
  surface: '#0A0A0B',
  foreground: '#E2E2E2',
  fontDisplay: 'Space Grotesk, sans-serif',
  fontBody: 'Inter, sans-serif',
  radiusPx: 0,
});

/**
 * EU-souveräne Kartenquelle. Bewusst nicht Google Maps: der Host taucht in
 * `thirdPartyHosts` auf und löst damit sichtbar eine Consent-Kategorie aus,
 * statt still Daten in ein Drittland zu tragen.
 */
const MAP_HOST = 'tile.openstreetmap.org';

export function synthesizeBlueprint(brief: SiteBrief, options: SynthesizeOptions = {}): SiteBlueprint {
  const preset = getIndustryPreset(brief.industry);
  const source = options.source ?? 'ai-builder';
  const aiGenerated = source === 'ai-builder';

  const pages: SitePage[] = preset.pagePlan.map((planned) => {
    const blocks = planned.blocks.map((kind, index) =>
      buildBlock(kind, index, planned.path, brief, aiGenerated),
    );

    // Art. 50 EU AI Act: Bei generativ erzeugten Inhalten muss die
    // KI-Beteiligung offengelegt werden. Der Hinweis wird vom Builder
    // gesetzt, nicht vom Modell — er darf nicht wegoptimierbar sein.
    if (aiGenerated) {
      blocks.splice(blocks.length - 1, 0, buildAiDisclosureBlock(planned.path, options.model ?? null));
    }

    return {
      path: planned.path,
      title: planned.title,
      description: pageDescription(planned.title, planned.path, brief),
      blocks,
      noindex: planned.noindex ?? false,
    };
  });

  const compliance = deriveCompliance(brief, pages, preset.compliance);

  return {
    schemaVersion: 1,
    slug: slugify(brief.name),
    name: brief.name,
    industry: brief.industry,
    locales: { default: brief.locale, supported: [brief.locale] },
    theme: { ...DEFAULT_THEME, ...options.theme },
    pages,
    seo: {
      siteName: brief.name,
      defaultTitle: brief.locality ? `${brief.name} — ${brief.locality}` : brief.name,
      defaultDescription: brief.summary,
      keywords: buildKeywords(brief),
      structuredDataType: preset.structuredDataType,
      locality: brief.locality,
    },
    compliance,
    origin: {
      source,
      model: options.model ?? null,
      promptSha256: options.promptSha256 ?? null,
      // Ohne expliziten Zeitstempel bleibt die Synthese rein deterministisch;
      // die Edge Function setzt die reale Zeit beim Persistieren.
      createdAt: options.createdAt ?? EPOCH_ISO,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Blöcke
// ─────────────────────────────────────────────────────────────────────

/**
 * Baut einen einzelnen Block. Öffentlich, weil die nachträgliche Verfeinerung
 * (`blueprint/refine.ts`) Blöcke nachrüstet und dabei exakt dieselben Inhalte
 * und Compliance-Merkmale erzeugen muss wie der Erstbau. Ein zweiter
 * Block-Bauer wäre die Stelle, an der ein Kontaktformular irgendwann ohne
 * Rechtsgrundlage entstünde.
 */
export function buildBlock(
  kind: BlockKind,
  index: number,
  path: string,
  brief: SiteBrief,
  aiGenerated: boolean,
): SiteBlock {
  const base = {
    id: blockId(path, kind, index),
    kind,
    processesPersonalData: false,
    thirdPartyHosts: [] as string[],
    aiGenerated,
  };

  switch (kind) {
    case 'navigation':
      // Die Wortmarke allein ist keine Navigation. Ohne Seitenlinks sind
      // alle Unterseiten des Seitenplans nur über die Sitemap erreichbar —
      // für Besucher wie für Suchmaschinen praktisch nicht vorhanden.
      return {
        ...base,
        aiGenerated: false,
        content: { brand: brief.name, links: navigationLinks(brief) },
      };

    case 'hero':
      return {
        ...base,
        content: {
          headline: brief.name,
          subline: brief.summary,
          primaryCta: { label: 'Termin anfragen', href: contactPath(brief) },
          // Platzhalter statt generiertem Bild: ein Bild ohne geklärte
          // Rechtelage gehört nicht in eine ausgelieferte Site.
          media: { kind: 'placeholder', alt: `${brief.name} — Ansicht`, ratio: '16:9' },
        },
      };

    case 'services':
      return {
        ...base,
        content: {
          heading: 'Leistungen',
          items: brief.services.map((label) => ({ label, description: null })),
        },
      };

    case 'features':
      return {
        ...base,
        content: {
          heading: 'Warum wir',
          items: [
            { label: 'Persönliche Betreuung', description: 'Feste Ansprechpartner statt Warteschleife.' },
            { label: 'Transparente Leistungen', description: 'Klare Angaben zu Umfang und Ablauf.' },
            { label: 'Kurze Wege', description: brief.locality ? `Zentral in ${brief.locality}.` : 'Gut erreichbar.' },
          ],
        },
      };

    case 'about':
      return { ...base, content: { heading: 'Über uns', body: brief.summary } };

    case 'team':
      return { ...base, content: { heading: 'Team', members: [] } };

    case 'testimonials':
      // Leer initialisiert: erfundene Bewertungen wären irreführende Werbung
      // (§ 5 UWG) — der Content-Agent darf hier nur echte Inhalte einsetzen.
      return { ...base, content: { heading: 'Stimmen', items: [], requiresRealContent: true } };

    case 'faq':
      return {
        ...base,
        content: {
          heading: 'Häufige Fragen',
          items: brief.services.slice(0, 3).map((s) => ({ question: `Was umfasst ${s}?`, answer: null })),
        },
      };

    case 'contact-form':
      return {
        ...base,
        processesPersonalData: true,
        content: {
          heading: 'Kontakt',
          fields: ['name', 'email', 'message'],
          legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO',
          consentText: 'Ich habe die Datenschutzerklärung gelesen und stimme der Verarbeitung meiner Angaben zu.',
          privacyHref: '/datenschutz',
        },
      };

    case 'booking':
      return {
        ...base,
        processesPersonalData: true,
        content: {
          heading: 'Termin vereinbaren',
          fields: ['name', 'email', 'phone', 'slot'],
          legalBasis: 'Art. 6 Abs. 1 lit. b DSGVO',
          privacyHref: '/datenschutz',
        },
      };

    case 'map':
      return {
        ...base,
        processesPersonalData: true,
        thirdPartyHosts: [MAP_HOST],
        content: {
          heading: 'Anfahrt',
          locality: brief.locality,
          // Erst nach Einwilligung laden (TDDDG § 25 Abs. 1).
          requiresConsent: true,
          consentCategory: 'karten',
        },
      };

    case 'cta':
      return { ...base, content: { headline: 'Sprechen Sie uns an', href: contactPath(brief) } };

    case 'legal-text':
      // Rechtstexte werden nie generiert, sondern aus dem Legal-Modul der
      // Plattform gezogen (siehe scripts/generate-static-legal-pages.mjs).
      return {
        ...base,
        aiGenerated: false,
        content: { documentRef: legalDocumentRef(path), managed: true },
      };

    case 'ai-disclosure':
      return buildAiDisclosureBlock(path, null);

    case 'footer':
      return {
        ...base,
        aiGenerated: false,
        content: {
          legalLinks: [
            { label: 'Impressum', href: '/impressum' },
            { label: 'Datenschutz', href: '/datenschutz' },
            { label: 'Barrierefreiheit', href: '/barrierefreiheit' },
          ],
        },
      };
  }
}

function buildAiDisclosureBlock(path: string, model: string | null): SiteBlock {
  return {
    id: blockId(path, 'ai-disclosure', 999),
    kind: 'ai-disclosure',
    processesPersonalData: false,
    thirdPartyHosts: [],
    aiGenerated: false,
    content: {
      text: 'Teile der Inhalte dieser Website wurden mit Unterstützung generativer KI erstellt und redaktionell geprüft.',
      reference: 'Art. 50 EU AI Act',
      model,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Compliance-Ableitung
// ─────────────────────────────────────────────────────────────────────

/**
 * Leitet das Compliance-Profil aus Branchen-Preset UND tatsächlich
 * verbauten Blöcken ab. Das Preset ist die Untergrenze — Blöcke können
 * zusätzliche Pflichten auslösen, aber keine entfernen.
 */
export function deriveCompliance(
  brief: SiteBrief,
  pages: SitePage[],
  presetCompliance: Omit<ComplianceProfile, 'consentCategories'>,
): ComplianceProfile {
  const blocks = pages.flatMap((p) => p.blocks);

  const consentCategories = new Set<string>(['notwendig']);
  for (const block of blocks) {
    const category = (block.content as { consentCategory?: unknown }).consentCategory;
    if (typeof category === 'string') consentCategories.add(category);
    else if (block.thirdPartyHosts.length > 0) consentCategories.add('extern');
  }

  const legalBases = new Set(presetCompliance.legalBases);
  for (const block of blocks) {
    const basis = (block.content as { legalBasis?: unknown }).legalBasis;
    if (typeof basis === 'string') legalBases.add(basis);
  }

  // Eine DSFA ist indiziert, sobald besondere Kategorien mit einer
  // Online-Erhebung zusammentreffen (Art. 35 Abs. 3 lit. b DSGVO).
  const collectsPersonalData = blocks.some((b) => b.processesPersonalData);
  const dpiaRequired =
    presetCompliance.dpiaRequired || (presetCompliance.specialCategories && collectsPersonalData);

  return {
    specialCategories: presetCompliance.specialCategories,
    legalBases: [...legalBases].sort(),
    consentCategories: [...consentCategories].sort(),
    policyPackIds: [...presetCompliance.policyPackIds].sort(),
    controlRefs: [...presetCompliance.controlRefs].sort(),
    dpiaRequired,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────

const UMLAUTS: Readonly<Record<string, string>> = Object.freeze({
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', é: 'e', è: 'e', ê: 'e', á: 'a', à: 'a', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ç: 'c',
});

export function slugify(input: string): string {
  const lowered = input.toLowerCase();
  let transliterated = '';
  for (const char of lowered) transliterated += UMLAUTS[char] ?? char;

  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : 'site';
}

function blockId(path: string, kind: BlockKind, index: number): string {
  const pathPart = path === '/' ? 'root' : slugify(path);
  return `${pathPart}--${kind}--${index}`;
}

/** Rechtsseiten stehen im Fuß, nicht in der Hauptnavigation. */
const LEGAL_PATHS = new Set(['/impressum', '/datenschutz', '/barrierefreiheit', '/agb', '/widerruf']);

/**
 * Hauptnavigation aus dem Seitenplan. Die Startseite fehlt bewusst — sie
 * hängt an der Wortmarke, und ein zusätzlicher „Start"-Link wäre ein
 * zweiter Weg zum selben Ziel im selben Element.
 */
function navigationLinks(brief: SiteBrief): { label: string; href: string }[] {
  return getIndustryPreset(brief.industry)
    .pagePlan.filter((page) => page.path !== '/' && !page.noindex && !LEGAL_PATHS.has(page.path))
    .map((page) => ({ label: page.title, href: page.path }));
}

function contactPath(brief: SiteBrief): string {
  const preset = getIndustryPreset(brief.industry);
  const paths = preset.pagePlan.map((p) => p.path);
  for (const candidate of ['/termin', '/kontakt', '/anfrage', '/reservierung']) {
    if (paths.includes(candidate)) return candidate;
  }
  return '/';
}

function pageDescription(title: string, path: string, brief: SiteBrief): string {
  if (path === '/') return brief.summary;
  return brief.locality
    ? `${title} — ${brief.name} in ${brief.locality}.`
    : `${title} — ${brief.name}.`;
}

function legalDocumentRef(path: string): string {
  switch (path) {
    case '/impressum': return 'legal:impressum';
    case '/datenschutz': return 'legal:privacy-policy';
    case '/barrierefreiheit': return 'legal:accessibility-statement';
    case '/agb': return 'legal:terms';
    case '/widerruf': return 'legal:withdrawal';
    default: return 'legal:generic';
  }
}

function buildKeywords(brief: SiteBrief): string[] {
  const preset = getIndustryPreset(brief.industry);
  const keywords = new Set<string>([preset.label.toLowerCase()]);
  if (brief.locality) {
    keywords.add(brief.locality.toLowerCase());
    keywords.add(`${preset.label.toLowerCase()} ${brief.locality.toLowerCase()}`);
  }
  for (const service of brief.services.slice(0, 6)) keywords.add(service.toLowerCase());
  return [...keywords].sort();
}
