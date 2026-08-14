// RealSync SiteOS — Domänenmodell.
//
// Dieses Paket ist bewusst frei von Framework- und Laufzeit-Abhängigkeiten:
// es läuft unverändert im Browser (SPA), in Deno (Edge Functions) und in
// Node (Tests, Skripte). Einzige externe Abhängigkeit ist `crypto.subtle`,
// das in allen drei Umgebungen verfügbar ist. Einzige externe Abhängigkeit ist `crypto.subtle`,
// das in allen drei Umgebungen verfügbar ist.
//
// Terminologie folgt CLAUDE.md: „Prüfpfad“ statt Audit Trail,
// „Herkunftsnachweis“ statt Provenance.

export type Locale = 'de' | 'en' | 'fr' | 'it' | 'es' | 'nl' | 'pl';

export type IndustryKey =
  | 'zahnarzt' | 'arztpraxis' | 'rechtsanwalt' | 'steuerberatung'
  | 'handwerk' | 'gastronomie' | 'immobilien' | 'agentur' | 'ecommerce' | 'sonstiges';

export type BlockKind =
  | 'navigation' | 'hero' | 'features' | 'services' | 'about' | 'team'
  | 'testimonials' | 'faq' | 'contact-form' | 'booking' | 'map' | 'cta'
  | 'legal-text' | 'ai-disclosure' | 'footer';

export type Dimension =
  | 'gdpr' | 'eu-ai-act' | 'tdddg' | 'accessibility' | 'security'
  | 'performance' | 'seo' | 'content';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SiteTheme {
  mode: 'dark' | 'light';
  accent: string;
  surface: string;
  foreground: string;
  fontDisplay: string;
  fontBody: string;
  radiusPx: number;
}

export interface SiteBlock {
  id: string;
  kind: BlockKind;
  content: Record<string, unknown>;
  processesPersonalData: boolean;
  thirdPartyHosts: string[];
  aiGenerated: boolean;
}

export interface SitePage {
  path: string;
  title: string;
  description: string;
  blocks: SiteBlock[];
  noindex: boolean;
}

export interface SiteSeo {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  structuredDataType: string;
  locality: string | null;
}

export interface ComplianceProfile {
  specialCategories: boolean;
  legalBases: string[];
  consentCategories: string[];
  policyPackIds: string[];
  controlRefs: string[];
  dpiaRequired: boolean;
}

export interface BlueprintOrigin {
  source: 'ai-builder' | 'manual' | 'import';
  model: string | null;
  promptSha256: string | null;
  createdAt: string;
}

/**
 * Vertrag zwischen Evidence/AI Studio und dem deterministischen SiteOS-Kern.
 *
 * Der AI-Pfad darf nur die strukturierte PageSpec/Blueprint-Schicht erzeugen.
 * `backend_preservation` ist absichtlich fail-closed: SiteOS erzeugt und
 * veröffentlicht ausschließlich Frontend-Artefakte und mutiert niemals den
 * Kunden-Backend-Vertrag.
 */
export interface SiteTransformationContract {
  /** Die vier kanonischen visuellen Varianten aus demselben Evidence-Set. */
  variant: 'executive' | 'modern' | 'authority' | 'minimal';
  /** Ursprungsdomain der geprüften Website. */
  source_domain: string;
  /** SHA-256-Anker des Evidence-Snapshots, auf dem die Transformation basiert. */
  evidence_hash: string;
  /** Harte Sicherheitsinvariante: Backend bleibt vollständig erhalten. */
  backend_preservation: 'preserve_all';
}

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
  transformation: SiteTransformationContract;
  origin: BlueprintOrigin;
}

export interface RuntimeFinding {
  code: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  reference: string;
  remediation: string;
  locator: string | null;
}

export interface SiteObservation {
  url: string;
  observedAt: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  cookiesBeforeConsent: { name: string; host: string }[];
  thirdPartyHosts: string[];
  ttfbMs: number;
  transferBytes: number;
}

export interface ScoreSet {
  health: number;
  risk: number;
  compliance: number;
  performance: number;
  aiRisk: number;
}

export interface ScoreBreakdown extends ScoreSet {
  dimensions: Record<Dimension, number>;
  findingCount: number;
  severityMax: Severity | null;
}

export type AgentKey =
  | 'compliance' | 'seo' | 'accessibility' | 'security' | 'performance' | 'content' | 'monitoring';

export interface AgentDefinition {
  key: AgentKey;
  label: string;
  dimensions: Dimension[];
  canMutateBlueprint: boolean;
  requiresApproval: boolean;
  cadenceMinutes: number | null;
}
