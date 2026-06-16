/**
 * Governance Complexity Score (GCS) — Modell & Scoring.
 *
 * Kernidee: RealSyncDynamics.AI verkauft KEINE „Anzahl Webseiten", sondern
 * Governance-Abdeckung. Die passende Paketempfehlung leitet sich aus der
 * Governance-KOMPLEXITÄT eines Unternehmens ab, nicht aus der Domain-Anzahl.
 *
 * Ein Friseur mit fünf Webseiten hat i.d.R. weniger Governance-Aufwand als
 * eine Arztpraxis mit einer Webseite (Art. 9 Gesundheitsdaten, KI-Assistent,
 * Dokumentationspflichten). Der GCS bildet genau das ab.
 *
 * Acht Dimensionen → gewichteter Rohwert → Normalisierung auf 0–100 → Level
 * (low / moderate / elevated / high) → Governance Coverage, Risiken und
 * empfohlenes Paket.
 *
 * Die empfohlenen Pakete mappen auf die bestehenden, self-serve buchbaren
 * Pricing-Tiers (planKey / Stripe), damit der Checkout unverändert
 * funktioniert. Die Paket-NARRATIVE ist Governance-Coverage, nicht Domains.
 */
import type { TierId } from './pricing';

// ─── Dimensionen ──────────────────────────────────────────────────────

export type GcsDimensionId =
  | 'industry'                // Branche
  | 'sensitiveData'           // Sensible Daten / Art. 9
  | 'aiUsage'                 // KI-Nutzung (EU AI Act)
  | 'employees'               // Mitarbeiteranzahl
  | 'thirdParties'            // Drittanbieter / Auftragsverarbeiter
  | 'tracking'                // Tracking- & Cookie-Systeme
  | 'documentation'           // Dokumentationspflichten (VVT/DSFA/TOM)
  | 'internationalTransfers'; // Internationale Datenübertragungen

export interface GcsOption {
  value: string;
  label: string;
  /** Roh-Punkte dieser Antwort (vor Normalisierung). */
  weight: number;
  /** Optional: kennzeichnet Antworten, die ein Multi-Mandant-/Enterprise-Setup implizieren. */
  enterpriseSignal?: boolean;
}

export interface GcsDimension {
  id: GcsDimensionId;
  label: string;
  question: string;
  /** Höchstgewicht dieser Dimension (= Gewicht der „schwersten" Option). */
  max: number;
  options: GcsOption[];
}

export const GCS_DIMENSIONS: GcsDimension[] = [
  {
    id: 'industry',
    label: 'Branche',
    question: 'In welcher Branche ist Ihr Unternehmen tätig?',
    max: 20,
    options: [
      { value: 'local_services', label: 'Lokale Dienstleistung / Handwerk', weight: 5 },
      { value: 'retail_ecommerce', label: 'Handel / E-Commerce', weight: 10 },
      { value: 'agency', label: 'Agentur / IT / SaaS', weight: 11 },
      { value: 'finance_insurance', label: 'Finanzen / Versicherung', weight: 16 },
      { value: 'health', label: 'Gesundheit / Pflege / Praxis', weight: 20 },
      { value: 'legal', label: 'Recht / Kanzlei / Steuerberatung', weight: 20 },
    ],
  },
  {
    id: 'sensitiveData',
    label: 'Sensible Daten',
    question: 'Welche Datenkategorien verarbeiten Sie?',
    max: 20,
    options: [
      { value: 'none', label: 'Nur Kontaktdaten', weight: 4 },
      { value: 'personal', label: 'Kunden- & Mitarbeiterdaten', weight: 9 },
      { value: 'financial', label: 'Finanz-/Vertragsdaten', weight: 14 },
      { value: 'special', label: 'Besondere Kategorien (Art. 9: Gesundheit, etc.)', weight: 20 },
    ],
  },
  {
    id: 'aiUsage',
    label: 'KI-Nutzung',
    question: 'Wie setzen Sie KI-Systeme ein?',
    max: 20,
    options: [
      { value: 'none', label: 'Keine KI', weight: 0 },
      { value: 'basic', label: 'Einfache KI-Tools (Textbausteine, Übersetzung)', weight: 8 },
      { value: 'customer', label: 'Kundengerichtete KI (Chatbot, Empfehlungen)', weight: 14 },
      { value: 'high_risk', label: 'KI in sensiblen Prozessen (Telefonassistent, Bewertung)', weight: 20 },
    ],
  },
  {
    id: 'employees',
    label: 'Mitarbeiteranzahl',
    question: 'Wie viele Mitarbeitende hat Ihr Unternehmen?',
    max: 16,
    options: [
      { value: 'micro', label: 'Bis 5', weight: 2 },
      { value: 'small', label: '6–50', weight: 6 },
      { value: 'medium', label: '51–250', weight: 12 },
      { value: 'large', label: 'Über 250', weight: 16, enterpriseSignal: true },
    ],
  },
  {
    id: 'thirdParties',
    label: 'Drittanbieter',
    question: 'Wie viele externe Dienste / Auftragsverarbeiter nutzen Sie?',
    max: 16,
    options: [
      { value: 'few', label: '0–3', weight: 3 },
      { value: 'some', label: '4–10', weight: 8 },
      { value: 'many', label: '11–25', weight: 12 },
      { value: 'lots', label: 'Über 25', weight: 16 },
    ],
  },
  {
    id: 'tracking',
    label: 'Tracking',
    question: 'Welche Tracking- & Cookie-Systeme setzen Sie ein?',
    max: 12,
    options: [
      { value: 'none', label: 'Keine', weight: 0 },
      { value: 'basic', label: 'Karten / Social Embeds', weight: 4 },
      { value: 'analytics', label: 'Analytics (z.B. Google Analytics)', weight: 8 },
      { value: 'marketing', label: 'Marketing / Remarketing / Ads', weight: 12 },
    ],
  },
  {
    id: 'documentation',
    label: 'Dokumentationspflichten',
    question: 'Welche Compliance-Dokumentation müssen Sie führen?',
    max: 14,
    options: [
      { value: 'minimal', label: 'Datenschutzerklärung', weight: 2 },
      { value: 'standard', label: 'VVT + AVV', weight: 6 },
      { value: 'extended', label: 'VVT + DSFA + TOM', weight: 11 },
      { value: 'regulated', label: 'Branchen-Audits / Aufsichtspflichten', weight: 14 },
    ],
  },
  {
    id: 'internationalTransfers',
    label: 'Internationale Übertragungen',
    question: 'Übertragen Sie Daten in Drittländer?',
    max: 12,
    options: [
      { value: 'none', label: 'Nur EU/EWR', weight: 0 },
      { value: 'us', label: 'EU + USA (Schrems II relevant)', weight: 8 },
      { value: 'global', label: 'Weltweit', weight: 12 },
    ],
  },
];

/** Summe aller Dimensions-Maxima — Basis für die Normalisierung auf 0–100. */
export const GCS_MAX_RAW = GCS_DIMENSIONS.reduce((sum, d) => sum + d.max, 0);

// ─── Pakete (Governance Coverage) ────────────────────────────────────

export type GcsPackageId = 'starter' | 'business' | 'professional' | 'enterprise';

export interface GcsPackage {
  id: GcsPackageId;
  name: string;
  /** Governance-Coverage-Tagline statt Domain-Anzahl. */
  coverage: string;
  /** Score-Fenster, das auf dieses Paket zeigt (inklusiv). */
  minScore: number;
  maxScore: number;
  /** Mapping auf bestehenden Pricing-Tier/planKey → Checkout bleibt intakt. */
  tierId: TierId;
  bullets: string[];
}

/**
 * Governance-Coverage-Pakete. Reihenfolge = aufsteigende Abdeckung.
 * `tierId` bindet an die bestehenden, buchbaren Pricing-Tiers (Stripe), damit
 * der Checkout ohne Migration funktioniert. Die Preise werden zur Laufzeit aus
 * `PRICING_TIERS` (Single Source of Truth) gezogen — hier KEINE Preis-Duplikate.
 */
export const GCS_PACKAGES: GcsPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    coverage: 'DSGVO-Monitoring & Evidence Vault für ein klares Governance-Fundament',
    minScore: 0,
    maxScore: 30,
    tierId: 'starter',
    bullets: ['Kontinuierliches DSGVO-Monitoring', 'Evidence Vault', 'Basis-Dokumente', '1 Organisation'],
  },
  {
    id: 'business',
    name: 'Business',
    coverage: 'KI-Governance & Continuous Monitoring für wachsende Datenflüsse',
    minScore: 31,
    maxScore: 55,
    tierId: 'growth',
    bullets: ['KI-Governance', 'AI Risk Register', 'Continuous Monitoring', 'Drift-Detection'],
  },
  {
    id: 'professional',
    name: 'Professional',
    coverage: 'Branchenbibliothek, Governance Agents & auditfähige Automatisierung',
    minScore: 56,
    maxScore: 100,
    tierId: 'agency',
    bullets: ['Branchenbibliothek', 'Governance Agents', 'Automatische Dokumentation', 'Audit-Trail'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    coverage: 'Multi-Mandant, White-Label & eigene Governance-Policies',
    minScore: 0,
    maxScore: 100,
    tierId: 'enterprise',
    bullets: ['Multi-Mandant', 'White-Label', 'API', 'Eigene Governance-Policies & Agenten'],
  },
];

export function gcsPackageById(id: GcsPackageId): GcsPackage {
  return GCS_PACKAGES.find((p) => p.id === id)!;
}

// ─── Level ────────────────────────────────────────────────────────────

export type GcsLevel = 'low' | 'moderate' | 'elevated' | 'high';

export const GCS_LEVELS: Record<GcsLevel, { label: string; min: number; max: number }> = {
  low:      { label: 'Gering',  min: 0,  max: 30 },
  moderate: { label: 'Mittel',  min: 31, max: 55 },
  elevated: { label: 'Erhöht',  min: 56, max: 80 },
  high:     { label: 'Hoch',    min: 81, max: 100 },
};

export function levelForScore(score: number): GcsLevel {
  if (score <= 30) return 'low';
  if (score <= 55) return 'moderate';
  if (score <= 80) return 'elevated';
  return 'high';
}

// ─── Scoring ──────────────────────────────────────────────────────────

export type GcsAnswers = Partial<Record<GcsDimensionId, string>>;

export interface GcsRiskFlag {
  dimension: GcsDimensionId;
  label: string;
  /** Kurzbegründung, warum dies die Governance-Komplexität erhöht. */
  note: string;
}

export interface GcsResult {
  /** Normalisierter Score 0–100. */
  score: number;
  level: GcsLevel;
  /** Roh-Punkte je Dimension (für die Aufschlüsselung im UI). */
  breakdown: Record<GcsDimensionId, number>;
  /** Anteil abgedeckter Governance-Komplexität durch das empfohlene Paket. */
  coverage: number;
  /** Erkannte Risiko-/Komplexitätstreiber. */
  risks: GcsRiskFlag[];
  recommended: GcsPackage;
}

function optionFor(dim: GcsDimension, value: string | undefined): GcsOption | undefined {
  return dim.options.find((o) => o.value === value);
}

/**
 * Berechnet den Governance Complexity Score aus den Antworten.
 *
 * - Nicht beantwortete Dimensionen zählen als 0 Punkte.
 * - Score = round(rawSum / GCS_MAX_RAW * 100), geklemmt auf 0–100.
 * - Enterprise wird empfohlen, sobald ein Enterprise-Signal vorliegt
 *   (>250 Mitarbeitende) — unabhängig vom Score; Multi-Mandant-Bedarf wird
 *   über `multiTenant` separat berücksichtigt.
 */
export function computeGcs(answers: GcsAnswers, opts?: { multiTenant?: boolean }): GcsResult {
  const breakdown = {} as Record<GcsDimensionId, number>;
  let raw = 0;
  let enterpriseSignal = false;
  const risks: GcsRiskFlag[] = [];

  for (const dim of GCS_DIMENSIONS) {
    const opt = optionFor(dim, answers[dim.id]);
    const weight = opt?.weight ?? 0;
    breakdown[dim.id] = weight;
    raw += weight;
    if (opt?.enterpriseSignal) enterpriseSignal = true;
    // Risiko-Flag, wenn die gewählte Option mind. 70 % des Dimensions-Maximums erreicht.
    if (opt && dim.max > 0 && weight / dim.max >= 0.7) {
      risks.push({ dimension: dim.id, label: dim.label, note: opt.label });
    }
  }

  const score = Math.max(0, Math.min(100, Math.round((raw / GCS_MAX_RAW) * 100)));
  const level = levelForScore(score);

  let recommended: GcsPackage;
  if (opts?.multiTenant || enterpriseSignal) {
    recommended = gcsPackageById('enterprise');
  } else {
    recommended =
      GCS_PACKAGES.find((p) => p.id !== 'enterprise' && score >= p.minScore && score <= p.maxScore) ??
      gcsPackageById('professional');
  }

  // Coverage: Anteil der adressierten Governance-Komplexität. Höhere Pakete
  // decken mehr Komplexität ab; das Starter-Paket deckelt bei moderater Last.
  const coverageCeil: Record<GcsPackageId, number> = {
    starter: 40,
    business: 70,
    professional: 95,
    enterprise: 100,
  };
  const coverage = Math.min(100, Math.round((coverageCeil[recommended.id] / 100) * 100));

  return { score, level, breakdown, coverage, risks, recommended };
}
