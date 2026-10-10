// Rebuild-Workflow — Domänenmodell.
//
// DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN.
//
// Diese Datei beschreibt, was aus einer bestehenden Website gelesen wird
// (`SourceSnapshot`), was daraus abgeleitet wird (`Positioning`,
// `Assessment`) und wie jede Aussage an ihren Beleg gebunden bleibt
// (`EvidenceItem`). Sie ist abhängigkeitsfrei und läuft wie der übrige Kern
// im Browser, in Deno und in Vitest.
//
// ## Die zwei Regeln, um die das Modell gebaut ist
//
// 1. **Kein Wert ohne Herkunft.** Alles, was später auf der neuen Website
//    steht oder in einem Befund behauptet wird, trägt die Kennung eines
//    Belegs: Seite, Elementpfad, DOM-Auszug, Zeitpunkt, Hash.
// 2. **Unbekannt ist ein Zustand, kein Loch.** Ein Feld, das nicht sicher
//    bestimmt werden konnte, heißt `unknown` und trägt einen Grund — es wird
//    nicht mit etwas Plausiblem gefüllt. Eine erfundene Branche oder ein
//    geratener Ort wandert sonst in Impressumshinweise, JSON-LD und Copy.

import type { IndustryKey } from '../types.ts';

/** Version der Ableitungsregeln. Steht in jedem Lauf und jedem Nachweis. */
export const REBUILD_ENGINE_VERSION = 'rebuild-2026.09.1';

// ─────────────────────────────────────────────────────────────────────
// Belege
// ─────────────────────────────────────────────────────────────────────

/**
 * Art des Belegs.
 *
 * `element`  — ein konkretes Element im Dokument (Auszug = Quelltext).
 * `absence`  — geprüfte Abwesenheit („kein <h1> im Dokument"). Auch ein
 *              fehlendes Element ist eine Beobachtung und braucht einen Beleg.
 * `document` — Eigenschaft des ganzen Dokuments (Textstatistik, Zählung).
 * `css`      — Deklaration aus einem Stylesheet.
 * `resource` — robots.txt, Sitemap, eingebundene Fremd-Ressource.
 */
export type EvidenceKind = 'element' | 'absence' | 'document' | 'css' | 'resource';

export interface EvidenceItem {
  /** Stabile Kennung im Snapshot, z. B. `p0-e12`. */
  id: string;
  kind: EvidenceKind;
  /** Adresse der Seite, auf der beobachtet wurde. */
  url: string;
  /** Kompakter Elementpfad (`body>main>section.hero>h1`) oder Ressource. */
  path: string;
  /** DOM-Auszug bzw. Feststellung, höchstens `EVIDENCE_EXCERPT_MAX` Zeichen. */
  excerpt: string;
  /** Zeitpunkt des Abrufs (ISO 8601). */
  observedAt: string;
  /**
   * SHA-256 über `{url, path, kind, excerpt, observedAt, documentSha256}`
   * (kanonisch). `null`, solange der Snapshot nicht versiegelt ist.
   */
  sha256: string | null;
}

export const EVIDENCE_EXCERPT_MAX = 280;

/**
 * Ein abgeleiteter Wert samt Herkunft — oder die ausdrückliche Feststellung,
 * dass er nicht bestimmt werden konnte.
 */
export type Known<T> =
  | { status: 'known'; value: T; confidence: 'high' | 'medium' | 'low'; evidence: string[] }
  | { status: 'unknown'; value: null; reason: string };

// ─────────────────────────────────────────────────────────────────────
// Quellseite
// ─────────────────────────────────────────────────────────────────────

export type CtaIntent = 'contact' | 'booking' | 'call' | 'email' | 'buy' | 'demo' | 'download' | 'other';

export interface SourceCta {
  label: string;
  href: string | null;
  intent: CtaIntent;
  /** Gestaltet wie eine Schaltfläche (Klasse/Element), nicht bloß ein Link. */
  buttonLike: boolean;
  /** Im Kopfbereich bzw. im Hero-Container. */
  inHeader: boolean;
  inHero: boolean;
  /** Position im Dokument, 0 = Anfang, 1 = Ende (Näherung für „früh sichtbar"). */
  position: number;
  ev: string;
}

export type FormPurpose = 'contact' | 'booking' | 'newsletter' | 'search' | 'login' | 'order' | 'other';

export interface SourceFormField {
  name: string;
  type: string;
  label: string | null;
  required: boolean;
}

export interface SourceForm {
  /** Aufgelöstes Ziel (absolute URL ohne Fragment) oder `null` ohne Ziel. */
  action: string | null;
  method: 'get' | 'post';
  fields: SourceFormField[];
  purpose: FormPurpose;
  /** Checkbox oder Hinweis mit Bezug auf Datenschutz/Einwilligung. */
  hasConsent: boolean;
  submitLabel: string | null;
  /** Ziel auf demselben Host, fremdem Host, per mailto oder ohne Ziel. */
  targetKind: 'same-host' | 'other-host' | 'mailto' | 'none';
  ev: string;
}

export interface SourceImage {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isLogoCandidate: boolean;
  ev: string;
}

export type TrustKind =
  | 'certification'
  | 'membership'
  | 'review-widget'
  | 'rating'
  | 'testimonial'
  | 'years'
  | 'award'
  | 'client-logos'
  | 'guarantee'
  | 'imprint-link'
  | 'privacy-link';

export interface TrustSignal {
  kind: TrustKind;
  /** Wortlaut wie auf der Quelle — gekürzt, nie umformuliert. */
  value: string;
  /** Zusatz (z. B. Autor eines Zitats), sofern vorhanden. */
  detail: string | null;
  ev: string;
}

export type ThirdPartyCategory =
  | 'analytics'
  | 'ads'
  | 'fonts'
  | 'maps'
  | 'video'
  | 'booking'
  | 'payment'
  | 'form'
  | 'consent'
  | 'reviews'
  | 'chat'
  | 'cdn'
  | 'social'
  | 'other';

export interface ThirdPartyResource {
  host: string;
  category: ThirdPartyCategory;
  /** Über welches Element eingebunden (`script`, `iframe`, `link`, `img`, `a`). */
  via: string;
  ev: string;
}

export interface SourceLink {
  label: string;
  href: string;
  ev: string;
}

export interface ColorUse {
  /** Normalisiert `#rrggbb`. */
  hex: string;
  count: number;
  /** Gewichtete Bedeutung als Markenfarbe (Buttons, Variablen, theme-color). */
  weight: number;
  ev: string;
}

export interface FontUse {
  family: string;
  count: number;
  /** Deklarationen in Überschriften-Selektoren (h1–h3, .title …). */
  headingUses: number;
  source: 'css' | 'google-fonts' | 'typekit' | 'font-face';
  ev: string;
}

export interface CssSignals {
  /** Gelesene CSS-Menge (Inline + abgerufene Stylesheets) in Zeichen. */
  observedChars: number;
  mediaQueryCount: number;
  /** Größte feste Breite (`width`/`min-width` in px ≥ 600) außerhalb von Media Queries. */
  maxFixedWidthPx: number | null;
  /** Kleinste deklarierte Schriftgröße in px. */
  minFontPx: number | null;
  usesFlexOrGrid: boolean;
  /** Deklarierte `border-radius`-Werte in px. */
  radiiPx: number[];
  /** Hintergrundfarbe von `html`/`body`, falls deklariert. */
  pageBackground: string | null;
  ev: string | null;
}

export interface TextStats {
  words: number;
  sentences: number;
  avgWordsPerSentence: number | null;
  /** Anteil der Sätze mit mehr als 25 Wörtern. */
  longSentenceShare: number | null;
  /** Lesbarkeitsindex nach Amstad (Flesch, deutsch), Näherung; `null` unter 80 Wörtern. */
  fleschDe: number | null;
  paragraphs: number;
  longestParagraphWords: number;
  /** Zählung förmlicher (Sie) und informeller (du) Ansprache. */
  formalAddress: number;
  informalAddress: number;
  /** Anfang des Haupttextes für Positionierung und Copy (gekürzt). */
  sample: string;
  ev: string;
}

export interface JsonLdFacts {
  types: string[];
  name: string | null;
  telephone: string | null;
  email: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  locality: string | null;
  openingHours: string | null;
  sameAs: string[];
  ratingValue: number | null;
  reviewCount: number | null;
  faq: { question: string; answer: string }[];
  ev: string | null;
}

export interface SourceHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  ev: string;
}

export interface SourceFaq {
  question: string;
  answer: string;
  ev: string;
}

export interface SourceSection {
  /** Überschrift des Abschnitts (h2/h3). */
  heading: string;
  /** Erster aussagekräftiger Absatz darunter. */
  text: string | null;
  /** Aufzählungspunkte bzw. Unterüberschriften (Ablaufschritte, Referenzen). */
  items: string[];
  ev: string;
}

export interface SourcePrice {
  /** Preisangabe im Wortlaut der Quelle. */
  text: string;
  /** Bezeichnung, auf die sich der Preis bezieht, falls erkennbar. */
  label: string | null;
  ev: string;
}

export interface SourceContact {
  /** `source`: anklickbarer Link, sichtbarer Text oder nur strukturierte Daten (unsichtbar). */
  phones: { value: string; href: string | null; source: 'link' | 'text' | 'json-ld'; ev: string }[];
  emails: { value: string; ev: string }[];
  address: { value: string; ev: string } | null;
  openingHours: { value: string; ev: string } | null;
}

export interface SourcePage {
  url: string;
  fetchedAt: string;
  statusCode: number;
  /** SHA-256 des vollständigen abgerufenen Dokuments. Das HTML selbst wird nicht gespeichert. */
  documentSha256: string | null;
  bytes: number;
  /**
   * Nur teilweise gelesen (Größengrenze des Abrufs oder Knotengrenze des
   * Parsers). Was danach stand, ist nicht gesehen — der Backend-Vergleich
   * führt die Seite deshalb als ungeprüft.
   */
  truncated: boolean;
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  themeColor: string | null;
  generator: string | null;
  ogSiteName: string | null;
  ogImage: string | null;
  headings: SourceHeading[];
  hero: { headline: string; subline: string | null; ev: string } | null;
  ctas: SourceCta[];
  navigation: SourceLink[];
  forms: SourceForm[];
  images: SourceImage[];
  logo: SourceImage | null;
  colors: ColorUse[];
  fonts: FontUse[];
  css: CssSignals;
  trust: TrustSignal[];
  prices: SourcePrice[];
  contact: SourceContact;
  jsonLd: JsonLdFacts;
  faqs: SourceFaq[];
  /** Abschnitte mit Überschrift — Grundlage für Ablauf, Referenzen, Über uns. */
  sections: SourceSection[];
  thirdParty: ThirdPartyResource[];
  internalLinks: string[];
  socialLinks: SourceLink[];
  /** Links auf Zahlungs-, Buchungs- und Shop-Strecken (Backend-Inventar). */
  backendLinks: { kind: 'payment' | 'booking' | 'shop'; href: string; label: string; ev: string }[];
  text: TextStats;
  /** Evidence für Seitenebene (Dokument, Zählungen). */
  documentEv: string;
  /**
   * Geprüfte Abwesenheiten mit Beleg, nach Schlüssel: `h1`, `viewport`,
   * `title`, `description`, `canonical`, `lang`, `navigation`, `cta`,
   * `contact`, `imprint-link`, `privacy-link`, `structured-data`,
   * `media-queries`, `img-alt` (erstes Bild ohne alt).
   */
  absences: Record<string, string>;
}

export interface SourceSnapshot {
  engineVersion: string;
  /** Vom Nutzer genannte, normalisierte Ausgangsadresse. */
  sourceUrl: string;
  /** Endgültige Adresse nach Weiterleitungen. */
  resolvedUrl: string;
  host: string;
  fetchedAt: string;
  pages: SourcePage[];
  robots: { found: boolean; sitemaps: string[]; disallowAll: boolean; ev: string | null };
  sitemap: { found: boolean; url: string | null; urlCount: number; ev: string | null };
  crawl: { planned: string[]; fetched: string[]; skipped: { url: string; reason: string }[] };
  evidence: EvidenceItem[];
  /** Wurden alle Belege gehasht? */
  sealed: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Positionierung
// ─────────────────────────────────────────────────────────────────────

export type ConversionGoal = 'anfrage' | 'termin' | 'anruf' | 'kauf' | 'demo';
export type Audience = 'b2b' | 'b2c' | 'beides';

export interface Positioning {
  companyName: Known<string>;
  /** Angebot: Leistungen/Produkte im Wortlaut der Quelle. */
  offer: Known<string[]>;
  industry: Known<IndustryKey>;
  audience: Known<Audience>;
  /** Zielgruppen-Wendung im Wortlaut (z. B. „für den Mittelstand"). */
  audiencePhrase: Known<string>;
  conversionGoal: Known<ConversionGoal>;
  locality: Known<string>;
  tone: Known<'sie' | 'du'>;
  /** Nutzenversprechen im Wortlaut der Quelle (Meta-Beschreibung, Hero-Unterzeile). */
  valueProposition: Known<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Bewertung
// ─────────────────────────────────────────────────────────────────────

export type Criterion =
  | 'hero-clarity'
  | 'cta-structure'
  | 'trust-signals'
  | 'mobile-ux'
  | 'readability'
  | 'visual-hierarchy'
  | 'seo-basics'
  | 'conversion-focus';

export type AssessmentSeverity = 'high' | 'medium' | 'low' | 'info';

export interface AssessmentFinding {
  /** Stabil, z. B. `rebuild.hero.missing-h1`. Nie umbenennen. */
  code: string;
  criterion: Criterion;
  severity: AssessmentSeverity;
  title: string;
  /** Was beobachtet wurde — sachlich, belegt. */
  detail: string;
  /** Was der Rebuild daraus macht. */
  recommendation: string;
  /** Mindestens ein Beleg. Ein Befund ohne Beleg wird nicht ausgegeben. */
  evidence: string[];
  pageUrl: string;
}

export interface CriterionResult {
  criterion: Criterion;
  label: string;
  /** 100 minus Abzüge der Befunde dieses Kriteriums (siehe ASSESSMENT_PENALTIES). */
  score: number;
  status: 'good' | 'fair' | 'poor';
  findingCodes: string[];
  /** Positive Beobachtungen, ebenfalls belegt. */
  strengths: { text: string; evidence: string[] }[];
  /** Grenze der Aussage (z. B. statische Prüfung ohne Rendering). */
  coverageNote: string | null;
}

export interface Assessment {
  engineVersion: string;
  assessedAt: string;
  criteria: CriterionResult[];
  findings: AssessmentFinding[];
  /** Mittel der Kriterien. Eine Heuristik aus benannten Befunden, keine Conversion-Prognose. */
  overall: number;
}
