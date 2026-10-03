// RealSync SiteOS — AI Rebuild Workflow: Domänenmodell.
//
// DISCOVER → ASSESS → REBUILD → REFINE → PUBLISH → AUTOMATE → GOVERN
//
// Der Nutzer gibt eine bestehende Website-URL ein. Das System liest die
// reale Seite, bewertet sie mit Belegen, erzeugt zwei bis drei bewusst
// gestaltete Richtungen, lässt sie per Klartext verfeinern, prüft die
// Veröffentlichungsreife und schlägt danach die nächsten Schritte im
// RealSync-Betriebssystem vor.
//
// ## Drei Regeln, die dieses Modell trägt
//
//   1. **Keine erfundenen Daten.** Jedes Feld, das die Quelle nicht belegt,
//      ist `null` oder `'unknown'`. Ein Proof-Element ohne Beleg ist ein
//      Platzhalter (`placeholder: true`) und wird als solcher gerendert.
//   2. **Jeder Befund hat einen Beleg.** `Evidence` trägt Quelle, Auszug,
//      Zeitpunkt und Hash. Ein Befund ohne `evidenceIds` gibt es nicht.
//   3. **Nichts geht ohne Freigabe live.** `PublishApproval.approved` wird
//      nie abgeleitet, sondern nur durch ein ausdrückliches GO gesetzt —
//      serverseitig, an einen Artefakt-Hash gebunden.
//
// Wie der Rest des Kerns: keine Abhängigkeiten, läuft in Browser, Deno und
// Node unverändert.

import type { IndustryKey, Severity, SiteBlueprint } from '../types.ts';

// ─────────────────────────────────────────────────────────────────────
// Workflow-Stufen
// ─────────────────────────────────────────────────────────────────────

export type RebuildStage =
  | 'discover'
  | 'assess'
  | 'rebuild'
  | 'refine'
  | 'publish'
  | 'automate'
  | 'govern';

export const REBUILD_STAGES: readonly RebuildStage[] = Object.freeze([
  'discover',
  'assess',
  'rebuild',
  'refine',
  'publish',
  'automate',
  'govern',
]);

export const REBUILD_STAGE_LABEL: Readonly<Record<RebuildStage, string>> = Object.freeze({
  discover: 'Discover',
  assess: 'Assess',
  rebuild: 'Rebuild',
  refine: 'Refine',
  publish: 'Publish',
  automate: 'Automate',
  govern: 'Govern',
});

// ─────────────────────────────────────────────────────────────────────
// Belege
// ─────────────────────────────────────────────────────────────────────

/** Woraus der Auszug stammt. */
export type EvidenceKind = 'dom' | 'meta' | 'text' | 'header' | 'derived';

/**
 * Ein Beleg. Der Auszug ist gekürzt (siehe `MAX_EVIDENCE_EXCERPT`), der
 * Hash wird über den **ungekürzten** Fund gebildet, damit derselbe Fund
 * unabhängig von der Kürzung denselben Hash trägt.
 */
export interface Evidence {
  /** Stabil innerhalb eines Imports: `ev-<laufende Nummer>`. */
  id: string;
  /**
   * Wofür der Beleg steht: `h1`, `title`, `viewport`, `cta:3`, `form:1`,
   * `trust:2`. Die Bewertung findet Belege über diesen Schlüssel, nicht
   * über die laufende Nummer.
   */
  ref: string;
  /** URL, aus der der Auszug stammt. */
  source: string;
  kind: EvidenceKind;
  /** DOM-/Text-Auszug, gekürzt. */
  excerpt: string;
  /** Zeitpunkt der Beobachtung (ISO 8601). */
  observedAt: string;
  /** SHA-256 des ungekürzten Funds, hex. */
  sha256: string;
}

export const MAX_EVIDENCE_EXCERPT = 400;

// ─────────────────────────────────────────────────────────────────────
// DISCOVER — der Import
// ─────────────────────────────────────────────────────────────────────

export interface ImportedLink {
  href: string;
  label: string;
  /** Zeigt der Link auf dieselbe Site? */
  internal: boolean;
}

export type CtaKind = 'button' | 'link' | 'form-submit' | 'tel' | 'mailto';
export type CtaProminence = 'primary' | 'secondary' | 'unknown';

export interface ImportedCta {
  label: string;
  href: string | null;
  kind: CtaKind;
  prominence: CtaProminence;
  evidenceId: string;
}

export type FormPurpose = 'contact' | 'newsletter' | 'booking' | 'search' | 'login' | 'quote' | 'unknown';

export interface ImportedFormField {
  name: string | null;
  type: string;
  label: string | null;
  required: boolean;
}

export interface ImportedForm {
  action: string | null;
  method: 'get' | 'post' | 'unknown';
  fields: ImportedFormField[];
  purpose: FormPurpose;
  /** Enthält das Formular einen Einwilligungs-/Datenschutz-Hinweis? */
  hasConsentHint: boolean;
  evidenceId: string;
}

export interface ImportedImage {
  src: string;
  alt: string | null;
  isLogo: boolean;
  width: number | null;
  height: number | null;
}

export type TrustSignalKind =
  | 'rating'
  | 'certificate'
  | 'years'
  | 'customers'
  | 'membership'
  | 'award'
  | 'guarantee'
  | 'reference'
  | 'legal-badge'
  | 'unknown';

export interface ImportedTrustSignal {
  kind: TrustSignalKind;
  /** Wortlaut aus der Quelle, ungekürzt bis 200 Zeichen. */
  text: string;
  evidenceId: string;
}

export interface ImportedBrand {
  name: string | null;
  logo: ImportedImage | null;
  /** Hex-Farben in Reihenfolge ihrer Häufigkeit; nur was die Quelle nennt. */
  colors: string[];
  /** Schriftfamilien, wie sie in der Quelle stehen (bereinigt). */
  fonts: string[];
  /** `<meta name="theme-color">`, falls gesetzt. */
  themeColor: string | null;
}

export type ConversionGoal = 'contact' | 'booking' | 'purchase' | 'call' | 'lead' | 'newsletter' | 'unknown';

/**
 * Abgeleitete Positionierung. Alles hier ist eine Deutung des Imports —
 * deshalb sind alle Felder nullable und `confidence` sagt, wie belastbar.
 */
export interface ImportedPositioning {
  industry: IndustryKey | null;
  industryConfident: boolean;
  /** Das Angebot in einem Satz, aus H1/Title/Description — oder null. */
  offer: string | null;
  /** Zielgruppe, sofern die Quelle sie nennt („für Unternehmen", „Privatkunden"). */
  audience: string | null;
  conversionGoal: ConversionGoal;
  locality: string | null;
  /** `lang`-Attribut der Quelle oder null. */
  language: string | null;
}

export interface ImportedSeo {
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  robots: string | null;
  hasViewport: boolean;
  lang: string | null;
  jsonLdTypes: string[];
  /** Anzahl `<h1>` — mehr als eine ist ein Befund. */
  h1Count: number;
}

export interface ImportedTexts {
  paragraphs: string[];
  wordCount: number;
  /** Durchschnittliche Satzlänge in Wörtern; null ohne Sätze. */
  avgSentenceLength: number | null;
  /** Anteil Sätze über 25 Wörter, 0–1; null ohne Sätze. */
  longSentenceShare: number | null;
}

/**
 * Das Ergebnis von DISCOVER. Ein Import ist der Gegenstand, auf den alle
 * Belege zeigen — deshalb trägt er den Hash des rohen HTML.
 */
export interface SiteImport {
  schemaVersion: 1;
  sourceUrl: string;
  finalUrl: string;
  fetchedAt: string;
  statusCode: number | null;
  contentType: string | null;
  htmlSha256: string;
  htmlBytes: number;
  title: string | null;
  description: string | null;
  h1: string | null;
  headings: { level: 2 | 3; text: string }[];
  navigation: ImportedLink[];
  /** Interne Links über die Navigation hinaus — die beobachtbare Sitemap. */
  sitemap: ImportedLink[];
  texts: ImportedTexts;
  ctas: ImportedCta[];
  forms: ImportedForm[];
  images: ImportedImage[];
  trust: ImportedTrustSignal[];
  brand: ImportedBrand;
  positioning: ImportedPositioning;
  seo: ImportedSeo;
  /** Drittanbieter-Hosts, die die Quelle einbindet (Fonts, Maps, Tracking). */
  thirdPartyHosts: string[];
  evidence: Evidence[];
}

// ─────────────────────────────────────────────────────────────────────
// ASSESS — die Bewertung
// ─────────────────────────────────────────────────────────────────────

export type AssessmentCriterion =
  | 'hero-clarity'
  | 'cta-structure'
  | 'trust-signals'
  | 'mobile-ux'
  | 'text-clarity'
  | 'visual-hierarchy'
  | 'seo-basics'
  | 'conversion-focus';

export const ASSESSMENT_CRITERIA: readonly AssessmentCriterion[] = Object.freeze([
  'hero-clarity',
  'cta-structure',
  'trust-signals',
  'mobile-ux',
  'text-clarity',
  'visual-hierarchy',
  'seo-basics',
  'conversion-focus',
]);

export const ASSESSMENT_CRITERION_LABEL: Readonly<Record<AssessmentCriterion, string>> = Object.freeze({
  'hero-clarity': 'Hero-Klarheit',
  'cta-structure': 'CTA-Struktur',
  'trust-signals': 'Trust-Signale',
  'mobile-ux': 'Mobile UX',
  'text-clarity': 'Textverständlichkeit',
  'visual-hierarchy': 'Visuelle Hierarchie',
  'seo-basics': 'SEO-Basics',
  'conversion-focus': 'Conversion-Fokus',
});

export interface AssessmentFinding {
  /** Stabile Kennung, z. B. `hero.missing-h1`. Nie umbenennen. */
  code: string;
  criterion: AssessmentCriterion;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  /** Mindestens ein Beleg. Leer ist kein gültiger Zustand. */
  evidenceIds: string[];
}

export interface CriterionResult {
  criterion: AssessmentCriterion;
  label: string;
  /** 0–100; 100 = keine Befunde. */
  score: number;
  summary: string;
  findings: AssessmentFinding[];
}

export interface SiteAssessment {
  schemaVersion: 1;
  sourceUrl: string;
  assessedAt: string;
  /** Hash des Imports, den diese Bewertung beschreibt. */
  importSha256: string;
  /** Gewichteter Gesamtindex 0–100. */
  overall: number;
  criteria: CriterionResult[];
  findings: AssessmentFinding[];
  /** Alle referenzierten Belege — Kopie aus dem Import, damit die Bewertung allein lesbar ist. */
  evidence: Evidence[];
}

// ─────────────────────────────────────────────────────────────────────
// Design-System
// ─────────────────────────────────────────────────────────────────────

export type TokenOrigin = 'brand' | 'derived' | 'fallback';

export interface ColorTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  foreground: string;
  muted: string;
  border: string;
  /** Woher die Primärfarbe stammt — sichtbar in der Oberfläche. */
  origin: TokenOrigin;
}

export interface TypographyTokens {
  display: { family: string; weight: number; letterSpacing: string; lineHeight: number };
  body: { family: string; weight: number; lineHeight: number };
  /** Modulare Skala in rem. */
  scale: { xs: number; sm: number; base: number; lg: number; xl: number; '2xl': number; '3xl': number; '4xl': number };
  origin: TokenOrigin;
}

export interface SpacingTokens {
  /** Basiseinheit in px. */
  unit: number;
  /** Vielfache der Einheit. */
  scale: number[];
  sectionY: { mobile: number; desktop: number };
  containerMax: number;
  gutter: number;
}

export interface ButtonTokens {
  radius: number;
  height: number;
  paddingX: number;
  weight: number;
  primary: { background: string; foreground: string; border: string };
  secondary: { background: string; foreground: string; border: string };
  ghost: { background: string; foreground: string; border: string };
}

export interface CardTokens {
  background: string;
  border: string;
  radius: number;
  shadow: 'none' | 'sm' | 'md';
  padding: number;
}

export interface SectionTokens {
  /** Wechselnde Hintergründe für Rhythmus — oder einfarbig. */
  alternate: boolean;
  altBackground: string;
  gap: number;
  /** Max. Textbreite in ch für Fließtext. */
  measure: number;
}

export interface FormTokens {
  inputBackground: string;
  inputBorder: string;
  inputRadius: number;
  inputHeight: number;
  labelWeight: number;
  focusRing: string;
}

export interface BreakpointTokens {
  sm: number;
  md: number;
  lg: number;
}

export interface MotionTokens {
  enabled: boolean;
  durationMs: number;
  easing: string;
  /** Erlaubte Effekte — bewusst kurz. */
  allow: ('fade-up' | 'fade')[];
}

/**
 * Kontrolliertes Design-System, aus der vorhandenen Marke abgeleitet.
 * Alle Farben sind Hex, alle Werte geprüft (siehe `design-system.ts`).
 */
export interface DesignSystem {
  schemaVersion: 1;
  mode: 'light' | 'dark';
  /** Warum dieser Modus — hell ist Default, dunkel nur mit Grund. */
  modeRationale: string;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: { sm: number; md: number; lg: number };
  buttons: ButtonTokens;
  cards: CardTokens;
  sections: SectionTokens;
  forms: FormTokens;
  breakpoints: BreakpointTokens;
  motion: MotionTokens;
}

// ─────────────────────────────────────────────────────────────────────
// REBUILD — Komponenten und Richtungen
// ─────────────────────────────────────────────────────────────────────

export type RebuildComponentKind =
  | 'hero'
  | 'trust-bar'
  | 'problem-solution'
  | 'benefits'
  | 'process'
  | 'pricing'
  | 'faq'
  | 'contact'
  | 'lead-form'
  | 'case-study'
  | 'compliance-block'
  | 'automation-block';

export const REBUILD_COMPONENT_KINDS: readonly RebuildComponentKind[] = Object.freeze([
  'hero',
  'trust-bar',
  'problem-solution',
  'benefits',
  'process',
  'pricing',
  'faq',
  'contact',
  'lead-form',
  'case-study',
  'compliance-block',
  'automation-block',
]);

export const REBUILD_COMPONENT_LABEL: Readonly<Record<RebuildComponentKind, string>> = Object.freeze({
  hero: 'Hero',
  'trust-bar': 'Trust Bar',
  'problem-solution': 'Problem / Lösung',
  benefits: 'Nutzen',
  process: 'Ablauf',
  pricing: 'Preise',
  faq: 'FAQ',
  contact: 'Kontakt',
  'lead-form': 'Lead-Formular',
  'case-study': 'Referenz',
  'compliance-block': 'Compliance / Governance',
  'automation-block': 'Automatisierung',
});

export interface RebuildCta {
  label: string;
  /** Ziel: interner Anker (`#kontakt`), URL, `tel:` oder `mailto:`. */
  href: string;
  /** Woher das Ziel stammt — Import (belegt) oder Vorschlag. */
  origin: 'import' | 'proposed';
}

export interface RebuildItem {
  title: string;
  text: string;
  /** Beleg aus dem Import, falls die Aussage dort stand. */
  evidenceId: string | null;
}

export interface RebuildMedia {
  src: string | null;
  alt: string | null;
  origin: 'import' | 'none';
}

/**
 * Eine Komponente des Rebuilds. Jedes Feld ist redaktionell änderbar —
 * Text, Reihenfolge (Position im Array), Sichtbarkeit, Stilvariante, CTA,
 * Bild/Media, Formularziel.
 */
export interface RebuildComponent {
  id: string;
  kind: RebuildComponentKind;
  visible: boolean;
  variant: string;
  text: Record<string, string>;
  items: RebuildItem[];
  cta: RebuildCta | null;
  media: RebuildMedia | null;
  /** Nur bei `lead-form` und `contact` belegt; sonst null. */
  formTarget: string | null;
  /**
   * Der Inhalt braucht echte Daten (z. B. Referenzen, Preise), die die
   * Quelle nicht hergab. Wird sichtbar gerendert, nie als Behauptung.
   */
  placeholder: boolean;
}

export type RebuildDirectionKey =
  | 'clean-enterprise'
  | 'conversion-focus'
  | 'local-trust'
  | 'premium-advisory'
  | 'governance-first';

export const REBUILD_DIRECTION_LABEL: Readonly<Record<RebuildDirectionKey, string>> = Object.freeze({
  'clean-enterprise': 'Clean Enterprise',
  'conversion-focus': 'Conversion Focus',
  'local-trust': 'Local Trust',
  'premium-advisory': 'Premium-Beratung',
  'governance-first': 'Governance First',
});

export interface RebuildSeo {
  title: string;
  description: string;
  keywords: string[];
}

export interface LeadFlow {
  /** Formularziel — aus dem Import übernommen oder null (muss konfiguriert werden). */
  formTarget: string | null;
  fields: { name: string; label: string; type: 'text' | 'email' | 'tel' | 'textarea' | 'select'; required: boolean }[];
  successMessage: string;
  /** Rechtsgrundlage und Einwilligungshinweis — Pflicht, nicht optional. */
  consentNote: string;
  requiresConfiguration: boolean;
}

export interface ProofItem {
  kind: TrustSignalKind;
  text: string;
  evidenceId: string | null;
  placeholder: boolean;
}

export interface RebuildDirection {
  key: RebuildDirectionKey;
  label: string;
  tagline: string;
  /** Warum diese Richtung für diese Marke — in zwei Sätzen. */
  rationale: string;
  designSystem: DesignSystem;
  components: RebuildComponent[];
  seo: RebuildSeo;
  primaryCta: RebuildCta;
  secondaryCta: RebuildCta | null;
  leadFlow: LeadFlow;
  proof: ProofItem[];
  /** Tonalität als Zahl 0–100: 0 = nüchtern/institutionell, 100 = nahbar/lokal. */
  tone: number;
}

// ─────────────────────────────────────────────────────────────────────
// REFINE — Revisionen
// ─────────────────────────────────────────────────────────────────────

export type RevisionScope = 'copy' | 'structure' | 'design';

export interface RevisionChange {
  code: string;
  summary: string;
  scope: RevisionScope;
}

export interface RevisionResult {
  direction: RebuildDirection;
  changes: RevisionChange[];
  understood: boolean;
  refusals: string[];
}

/** Gezielte Komponenten-Operation aus dem Editor. */
export type ComponentOperation =
  | { op: 'set-text'; id: string; field: string; value: string }
  | { op: 'set-item'; id: string; index: number; title: string; text: string }
  | { op: 'move'; id: string; to: number }
  | { op: 'set-visible'; id: string; visible: boolean }
  | { op: 'set-variant'; id: string; variant: string }
  | { op: 'set-cta'; id: string; cta: RebuildCta | null }
  | { op: 'set-media'; id: string; media: RebuildMedia | null }
  | { op: 'set-form-target'; id: string; formTarget: string | null };

export interface RevisionRecord {
  at: string;
  /** Klartext-Anweisung oder `null` bei Editor-Operationen. */
  instruction: string | null;
  operations: ComponentOperation[];
  changes: RevisionChange[];
  refusals: string[];
  understood: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// PUBLISH
// ─────────────────────────────────────────────────────────────────────

export type PublishCheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export interface PublishCheck {
  code: string;
  label: string;
  status: PublishCheckStatus;
  detail: string;
}

export type DeployPathKey = 'export-html' | 'cloudflare-pages' | 'custom-domain';

export interface DeployPath {
  key: DeployPathKey;
  label: string;
  status: 'available' | 'requires-setup' | 'coming-soon';
  detail: string;
}

export interface PublishReadiness {
  checks: PublishCheck[];
  /** Alle Pflichtprüfungen bestanden — sagt nichts über die Freigabe. */
  ready: boolean;
  blockers: string[];
  warnings: string[];
  deployPaths: DeployPath[];
  /** Immer true: Veröffentlichung braucht ein ausdrückliches GO. */
  approvalRequired: true;
  /** Hash des Artefakts, das geprüft wurde. */
  artifactSha256: string;
  evaluatedAt: string;
}

export interface PublishApproval {
  approved: boolean;
  approvedAt: string | null;
  /** Nutzer-ID der Freigabe; nie aus dem Client übernommen. */
  approvedBy: string | null;
  /** Nur gültig für genau diesen Hash. */
  artifactSha256: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// AUTOMATE — nächste Schritte
// ─────────────────────────────────────────────────────────────────────

export type NextStepKey =
  | 'lead-automation'
  | 'chatbot'
  | 'booking'
  | 'dsgvo-ai-act-check'
  | 'governance-scan'
  | 'local-ai'
  | 'form-to-workflow'
  | 'crm-email-stripe';

export interface NextStepSuggestion {
  key: NextStepKey;
  label: string;
  /** Warum dieser Schritt — bezieht sich auf Belege. */
  why: string;
  evidenceIds: string[];
  /** Immer true: keine Automation ohne Freigabe. */
  requiresApproval: true;
  status: 'proposed';
  /** Wohin der Schritt führt — null, wenn es noch keine Oberfläche gibt. */
  route: string | null;
  /** Ehrlich: Ist eine reale Verbindung vorhanden? Ohne Verbindung nur „vorbereiten". */
  connection: 'none' | 'requires-setup';
}

// ─────────────────────────────────────────────────────────────────────
// GOVERN
// ─────────────────────────────────────────────────────────────────────

export interface GovernanceSummary {
  /**
   * Woher Mandant und Policy stammen. Immer `server`: URL-Parameter und
   * localStorage sind niemals Autorität (siehe Handler).
   */
  tenantAuthority: 'server';
  evidenceCount: number;
  findingCount: number;
  /** Hashes, die den Prüfpfad verketten. */
  hashes: { import: string | null; assessment: string | null; artifact: string | null };
  /** Was noch eine menschliche Entscheidung braucht. */
  pendingApprovals: string[];
  /** Compliance-Profil des Rebuilds (aus dem Blueprint). */
  compliance: SiteBlueprint['compliance'] | null;
}

// ─────────────────────────────────────────────────────────────────────
// Der Workflow-Zustand
// ─────────────────────────────────────────────────────────────────────

export interface RebuildWorkflowState {
  schemaVersion: 1;
  stage: RebuildStage;
  sourceUrl: string;
  import: SiteImport | null;
  assessment: SiteAssessment | null;
  directions: RebuildDirection[];
  selectedDirection: RebuildDirectionKey | null;
  revisions: RevisionRecord[];
  readiness: PublishReadiness | null;
  approval: PublishApproval;
  suggestions: NextStepSuggestion[];
  governance: GovernanceSummary | null;
}
