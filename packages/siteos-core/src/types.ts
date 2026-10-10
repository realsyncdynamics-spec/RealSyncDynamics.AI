// RealSync SiteOS — Domänenmodell.
//
// Dieses Paket ist bewusst frei von Framework- und Laufzeit-Abhängigkeiten:
// es läuft unverändert im Browser (SPA), in Deno (Edge Functions) und in
// Node (Tests, Skripte). Einzige externe Abhängigkeit ist `crypto.subtle`,
// das in allen drei Umgebungen verfügbar ist.
//
// Terminologie folgt CLAUDE.md: „Prüfpfad" statt Audit Trail,
// „Herkunftsnachweis" statt Provenance.

// ─────────────────────────────────────────────────────────────────────
// Basistypen
// ─────────────────────────────────────────────────────────────────────

/** Unterstützte Sprachen. Default ist stets `de` (EU-souveräner Betrieb). */
export type Locale = 'de' | 'en' | 'fr' | 'it' | 'es' | 'nl' | 'pl';

/** Branchen mit hinterlegtem Compliance-Profil (siehe blueprint/industries). */
export type IndustryKey =
  | 'zahnarzt'
  | 'arztpraxis'
  | 'rechtsanwalt'
  | 'steuerberatung'
  | 'handwerk'
  | 'gastronomie'
  | 'immobilien'
  | 'agentur'
  | 'ecommerce'
  | 'sonstiges';

/**
 * Block-Typen der Component Library. Jeder Block ist eigenständig
 * renderbar und trägt seine eigenen Compliance-Implikationen
 * (z. B. `contact-form` ⇒ Art. 6 DSGVO Rechtsgrundlage erforderlich).
 */
export type BlockKind =
  | 'navigation'
  | 'hero'
  | 'features'
  | 'services'
  | 'about'
  | 'team'
  | 'testimonials'
  | 'faq'
  | 'contact-form'
  | 'booking'
  | 'map'
  | 'cta'
  | 'legal-text'
  | 'ai-disclosure'
  | 'footer'
  // Rebuild-Komponenten (2026-09-29). Jede trägt nur belegte Inhalte:
  // Trust-Leiste, Preise, Referenzen und Ablauf entstehen aus der
  // Ausgangsseite oder bleiben leer (und werden dann nicht ausgeliefert).
  | 'trust-bar'
  | 'problem-solution'
  | 'process'
  | 'pricing'
  | 'case-study'
  | 'contact-info'
  | 'governance'
  | 'automation';

/** Analyse-Dimensionen der Runtime. Deckt die acht Pflicht-Scans ab. */
export type Dimension =
  | 'gdpr'
  | 'eu-ai-act'
  | 'tdddg'
  | 'accessibility'
  | 'security'
  | 'performance'
  | 'seo'
  | 'content';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// ─────────────────────────────────────────────────────────────────────
// Site-Modell
// ─────────────────────────────────────────────────────────────────────

export interface SiteTheme {
  /** Basis-Palette. Hard-Edge-Industrial bleibt Default der Plattform. */
  mode: 'dark' | 'light';
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
  /** 0 = Hard Edge. Public-Sites dürfen abweichen (10–14px). */
  radiusPx: number;
}

export interface SiteBlock {
  id: string;
  kind: BlockKind;
  /**
   * Redaktioneller Inhalt. Absichtlich lose typisiert: der Content-Agent
   * befüllt Felder je Block-Typ, das Schema bleibt vorwärtskompatibel.
   */
  content: Record<string, unknown>;
  /**
   * Setzt der Block personenbezogene Daten um (Formular, Karte, Video)?
   * Steuert die DSGVO-/TDDDG-Analyse und die Consent-Kategorien.
   */
  processesPersonalData: boolean;
  /** Vom Block eingebundene Drittanbieter-Hosts (Maps, Fonts, Video). */
  thirdPartyHosts: string[];
  /** Wurde der Inhalt generativ erzeugt? Pflicht für Art. 50 EU AI Act. */
  aiGenerated: boolean;
}

export interface SitePage {
  /** Pfad ohne Locale-Präfix, immer mit führendem Slash. */
  path: string;
  title: string;
  description: string;
  blocks: SiteBlock[];
  /** Aus der Sitemap/Navigation ausgeschlossen (z. B. Danke-Seiten). */
  noindex: boolean;
}

export interface SiteSeo {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  /** schema.org-Typ für JSON-LD (z. B. `Dentist`, `LegalService`). */
  structuredDataType: string;
  /** Geo-Signal für lokale Suche. */
  locality: string | null;
  /**
   * Belegte Kontaktdaten für JSON-LD (Rebuild-Workflow). Optional: fehlt es,
   * bleibt das ausgelieferte JSON-LD unverändert.
   */
  organization?: {
    telephone?: string;
    email?: string;
    streetAddress?: string;
    postalCode?: string;
    sameAs?: string[];
  };
}

/**
 * Compliance-Profil der Site. Wird aus Branche + Blocks abgeleitet und ist
 * die Brücke in die bestehende Governance-Runtime: `policyPackIds` verweist
 * auf `policy_packs`, `controlRefs` auf `governance_controls`.
 */
export interface ComplianceProfile {
  /** Verarbeitet die Site besondere Kategorien (Art. 9 DSGVO)? */
  specialCategories: boolean;
  /** Rechtsgrundlagen, die durch die Blocks ausgelöst werden. */
  legalBases: string[];
  /** Erforderliche Consent-Kategorien nach TDDDG. */
  consentCategories: string[];
  policyPackIds: string[];
  controlRefs: string[];
  /** Ist eine DSFA (Art. 35 DSGVO) indiziert? */
  dpiaRequired: boolean;
}

export interface BlueprintOrigin {
  source: 'ai-builder' | 'manual' | 'import';
  /** Modell-ID, falls generativ erzeugt (Nachweis nach Art. 50 EU AI Act). */
  model: string | null;
  /** SHA-256 des Prompts — der Prompt selbst wird nicht dupliziert. */
  promptSha256: string | null;
  createdAt: string;
  /**
   * Nur Rebuild (`source: 'import'`): Analyse-Lauf und Snapshot-Hash der
   * Ausgangsseite, aus denen die Site abgeleitet wurde.
   *
   * Serverseitig beim Übernehmen einer Richtung gesetzt; Redaktion und
   * Überarbeitung tragen es unverändert weiter (sie ändern `origin` nicht).
   * Damit steht die Bindung im Hash jeder Version: Publish Gate, Status und
   * Export laden den Backend-Vergleich über genau diesen Lauf — nicht über
   * „den zuletzt bearbeiteten Lauf zu dieser Adresse".
   */
  rebuild?: { runId: string; snapshotSha256: string };
}

/**
 * Kontrolliertes Design-System einer Site (Rebuild-Workflow).
 *
 * Ergänzt `SiteTheme`, ersetzt es nicht: Das Theme bleibt die Quelle für die
 * Kontrastprüfung und das Kern-Stylesheet. Das Design-System legt fest, WIE
 * gestaltet wird — Schrift-Skala, Abstände, Kartenstil, Schaltflächen,
 * Hero-Variante — aus einer festen Menge von Varianten statt aus freiem CSS.
 *
 * Optional: Blueprints ohne `design` werden unverändert gerendert, ihre
 * Hashes bleiben byte-gleich (`undefined` fällt bei der Kanonisierung weg).
 */
export interface DesignSpec {
  version: 1;
  /** Gestaltungsrichtung, aus der das System abgeleitet wurde (z. B. `clean-enterprise`). */
  direction: string;
  mode: 'light' | 'dark';
  palette: {
    accent: string;
    /** Textfarbe auf dem Akzent (Schaltflächen), AA-geprüft. */
    accentText: string;
    surface: string;
    /** Zweite Fläche für abgesetzte Bänder und Karten. */
    surfaceAlt: string;
    foreground: string;
    muted: string;
    line: string;
  };
  typography: {
    display: string;
    body: string;
    displayWeight: 600 | 700 | 800;
    scale: 'compact' | 'regular' | 'expressive';
    tracking: 'normal' | 'tight';
  };
  radius: { control: number; card: number };
  spacing: 'compact' | 'regular' | 'airy';
  elevation: 'flat' | 'soft';
  cards: 'bordered' | 'elevated' | 'tinted';
  sections: 'plain' | 'banded';
  buttons: { primary: 'solid' | 'pill'; secondary: 'outline' | 'ghost' };
  hero: 'split' | 'centered' | 'editorial';
  ctaEmphasis: 'standard' | 'strong';
  /** Primäre Handlungsaufforderung zusätzlich im Kopfbereich. */
  headerCta: boolean;
  motion: 'none' | 'subtle';
  /** Herleitung in Sätzen — für Oberfläche und Prüfpfad. */
  notes: string[];
  /**
   * Markensignale der Ausgangsseite, aus denen das System abgeleitet wurde.
   * Erlaubt einer Verfeinerung („mehr wie Premium-Beratung"), die Richtung
   * neu abzuleiten, ohne die Ausgangsseite erneut zu lesen — und ohne dass
   * sich die Marke bei jedem Richtungswechsel ein Stück verschiebt.
   */
  brand?: {
    color: string | null;
    displayFamily: string | null;
    bodyFamily: string | null;
    radiusPx: number | null;
    pill: boolean;
    dark: boolean;
  };
}

/**
 * Der SiteBlueprint ist die einzige Wahrheit über eine Site. Alles andere
 * (Rendering, Deployment, Scans, Nachweise) leitet sich daraus ab. Der
 * Blueprint wird kanonisiert gehasht — der Hash ist der Anker im
 * Evidence Vault und im Herkunftsnachweis.
 */
export interface SiteBlueprint {
  schemaVersion: 1;
  slug: string;
  name: string;
  industry: IndustryKey;
  locales: { default: Locale; supported: Locale[] };
  theme: SiteTheme;
  pages: SitePage[];
  seo: SiteSeo;
  compliance: ComplianceProfile;
  origin: BlueprintOrigin;
  /** Design-System aus dem Rebuild-Workflow; fehlt bei älteren Blueprints. */
  design?: DesignSpec;
}

// ─────────────────────────────────────────────────────────────────────
// Analyse + Scoring
// ─────────────────────────────────────────────────────────────────────

export interface RuntimeFinding {
  /** Stabile Kennung, z. B. `gdpr.missing-impressum`. Nie umbenennen. */
  code: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  /** Rechtsnorm oder Standard, auf den sich der Befund stützt. */
  reference: string;
  remediation: string;
  /** Betroffener Seitenpfad bzw. Block, sofern lokalisierbar. */
  locator: string | null;
}

/**
 * Beobachtung einer ausgelieferten Site. Wird vom Runtime-Scanner
 * (HTTP-Abruf am Edge) befüllt und ist die Eingabe der Live-Analysatoren.
 */
export interface SiteObservation {
  url: string;
  observedAt: string;
  statusCode: number;
  /** Response-Header, Schlüssel in Kleinbuchstaben. */
  headers: Record<string, string>;
  html: string;
  /** Vor jeder Einwilligung gesetzte Cookies (TDDDG § 25). */
  cookiesBeforeConsent: { name: string; host: string }[];
  /** Ohne Einwilligung kontaktierte Fremd-Hosts. */
  thirdPartyHosts: string[];
  /** Time to First Byte in Millisekunden. */
  ttfbMs: number;
  /** Übertragene Bytes des Dokuments inkl. Sub-Ressourcen. */
  transferBytes: number;
}

export interface ScoreSet {
  /** Gesamtindex 0–100, gewichtete Zusammenfassung aller Dimensionen. */
  health: number;
  /** 0–100, höher = riskanter. Inverse zu health, severity-gewichtet. */
  risk: number;
  compliance: number;
  performance: number;
  /** Risiko aus KI-Einsatz: Transparenzpflichten + generative Inhalte. */
  aiRisk: number;
}

export interface ScoreBreakdown extends ScoreSet {
  /** Teilscore je Dimension, 0–100. */
  dimensions: Record<Dimension, number>;
  findingCount: number;
  severityMax: Severity | null;
}

// ─────────────────────────────────────────────────────────────────────
// Agenten
// ─────────────────────────────────────────────────────────────────────

export type AgentKey =
  | 'compliance'
  | 'seo'
  | 'accessibility'
  | 'security'
  | 'performance'
  | 'content'
  | 'monitoring';

export interface AgentDefinition {
  key: AgentKey;
  label: string;
  /** Dimensionen, für die der Agent Befunde verantwortet. */
  dimensions: Dimension[];
  /** Darf der Agent den Blueprint selbstständig ändern? */
  canMutateBlueprint: boolean;
  /** Erfordert eine Änderung eine Freigabe in `governance_approvals`? */
  requiresApproval: boolean;
  /** Default-Intervall des Laufs in Minuten; `null` = nur auf Abruf. */
  cadenceMinutes: number | null;
}
