// Kundenbericht des öffentlichen Scans.
//
// Die Analyse arbeitet auf acht Prüfdimensionen (`packages/siteos-core`).
// Der Bericht zeigt sechs Kategorien. Das ist Absicht: Die Dimensionen sind
// die auditierbare Rechengrundlage, die Kategorien die Sprache, in der ein
// Interessent sein Ergebnis liest. Die Abbildung steht deshalb an genau
// einer Stelle (`CATEGORY_DIMENSIONS`) und ist damit belegbar.
//
// ─── Sprachregel, verbindlich ──────────────────────────────────────────
// Dieser Bericht wird ohne Vertrag, ohne Mandat und ohne Kenntnis der
// Verarbeitungsvorgänge erstellt. Er darf deshalb **niemals** Konformität
// zusichern. Verboten sind Formulierungen wie „Website ist DSGVO-konform“.
// Zulässig sind Aussagen über das **Beobachtete**:
//   „Keine offensichtlichen Probleme erkannt“
//   „Potenzielle Compliance-Risiken erkannt“
// `test/public-scan/report.test.ts` nagelt das fest — die Regel ist ein
// Test, keine Bitte.

import {
  computeScores,
  type Dimension,
  type RuntimeFinding,
  type Severity,
} from '../../../../packages/siteos-core/src/index.ts';
import type { PublicScanSignals } from './detectors.ts';

/**
 * Version der Auswertung. Befund-Codes, Gewichte und die Abbildung unten
 * sind versionsrelevant: Sie erscheinen in Kundenberichten, die später
 * verglichen werden. Bei inhaltlicher Änderung hochzählen.
 */
export const PUBLIC_SCAN_ENGINE_VERSION = 'public-scan/1.0.0';

export type PublicScanCategoryId =
  | 'dsgvo'
  | 'eu_ai_act'
  | 'seo'
  | 'accessibility'
  | 'security'
  | 'ux';

/**
 * Abbildung Kategorie → Prüfdimensionen.
 *
 * `dsgvo` fasst `gdpr` und `tdddg` zusammen: Für den Betrachter ist beides
 * „Datenschutz“, juristisch sind es zwei Regelwerke (DSGVO und TDDDG).
 * `ux` fasst `performance` und `content` — Ladeverhalten und redaktionelle
 * Reife bestimmen gemeinsam, wie die Seite erlebt wird.
 */
export const CATEGORY_DIMENSIONS: Readonly<Record<PublicScanCategoryId, readonly Dimension[]>> =
  Object.freeze({
    dsgvo: ['gdpr', 'tdddg'],
    eu_ai_act: ['eu-ai-act'],
    seo: ['seo'],
    accessibility: ['accessibility'],
    security: ['security'],
    ux: ['performance', 'content'],
  });

export const CATEGORY_LABELS: Readonly<Record<PublicScanCategoryId, string>> = Object.freeze({
  dsgvo: 'DSGVO & Datenschutz',
  eu_ai_act: 'EU AI Act',
  seo: 'SEO & Auffindbarkeit',
  accessibility: 'Barrierefreiheit',
  security: 'Sicherheit',
  ux: 'Technik & Nutzererlebnis',
});

/**
 * Urteilsstufen. Bewusst als Zustand des **Befundbilds** formuliert, nicht
 * als Bewertung der Rechtslage.
 */
export type PublicScanVerdict =
  | 'no_obvious_issues'
  | 'minor_potential'
  | 'potential_risks'
  | 'significant_risks';

export const VERDICT_TEXT: Readonly<Record<PublicScanVerdict, string>> = Object.freeze({
  no_obvious_issues: 'Keine offensichtlichen Probleme erkannt',
  minor_potential: 'Kleinere Optimierungspotenziale erkannt',
  potential_risks: 'Potenzielle Risiken erkannt',
  significant_risks: 'Deutliche Risiken erkannt',
});

export interface PublicScanCategory {
  id: PublicScanCategoryId;
  label: string;
  /** 0–100, Mittel der zugeordneten Dimensionen. */
  score: number;
  verdict: PublicScanVerdict;
  verdictText: string;
  findingCount: number;
  criticalCount: number;
}

/** Ein Befund in der Darstellung — ohne interne Felder. */
export interface PublicScanFindingView {
  code: string;
  category: PublicScanCategoryId;
  severity: Severity;
  title: string;
  reference: string;
  remediation: string;
}

export interface PublicScanCounts {
  /** `critical` + `high` — das, was zuerst angefasst gehört. */
  critical: number;
  /** `medium`. */
  medium: number;
  /** `low` + `info` — Optimierungsmöglichkeiten. */
  opportunity: number;
  total: number;
}

export interface PublicScanReport {
  engineVersion: string;
  url: string;
  domain: string;
  scannedAt: string;
  httpStatus: number;
  /** Gesamtindex 0–100 (gewichtet, aus `computeScores`). */
  overallScore: number;
  categories: PublicScanCategory[];
  counts: PublicScanCounts;
  /** Frei sichtbare Befunde. */
  preview: PublicScanFindingView[];
  /** Anzahl der Befunde, die erst im Konto vollständig sichtbar sind. */
  lockedCount: number;
  /** Erkannte Technologien, Chat-Widgets und KI-Dienste. */
  technologies: string[];
  aiTools: string[];
  chatWidgets: string[];
  /**
   * `limited`, wenn der Abruf nur wenig auswertbares HTML geliefert hat —
   * dann ist ein gutes Ergebnis kein gutes Zeichen, sondern eine
   * unvollständige Messung.
   */
  coverage: 'full' | 'limited';
  disclaimer: string;
}

/** Anzahl frei sichtbarer Befunde. Der Rest belegt den Nutzen des Kontos. */
export const PREVIEW_FINDING_LIMIT = 5;

export const PUBLIC_SCAN_DISCLAIMER =
  'Automatisierte Analyse des ausgelieferten HTML zum Zeitpunkt des Abrufs. ' +
  'Sie ersetzt keine Rechtsberatung und trifft keine Aussage über die ' +
  'Rechtskonformität der Website. Serverseitige Verarbeitung und Inhalte, ' +
  'die erst nach Einwilligung oder Anmeldung laden, sind von außen nicht sichtbar.';

// ── Aufbau ──────────────────────────────────────────────────────────────

export interface BuildReportInput {
  url: string;
  domain: string;
  scannedAt: string;
  httpStatus: number;
  htmlLength: number;
  findings: RuntimeFinding[];
  signals: PublicScanSignals;
}

export function buildPublicScanReport(input: BuildReportInput): PublicScanReport {
  const scores = computeScores(input.findings);

  const categories = (Object.keys(CATEGORY_DIMENSIONS) as PublicScanCategoryId[]).map((id) => {
    const dimensions = CATEGORY_DIMENSIONS[id];
    const score = round(
      dimensions.reduce((sum, d) => sum + scores.dimensions[d], 0) / dimensions.length,
    );
    const inCategory = input.findings.filter((f) => dimensions.includes(f.dimension));
    const criticalCount = inCategory.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
    const verdict = verdictFor(score, criticalCount);

    return {
      id,
      label: CATEGORY_LABELS[id],
      score,
      verdict,
      verdictText: VERDICT_TEXT[verdict],
      // `info`-Befunde sind Hinweise, keine Beanstandungen: Sie würden die
      // Zahl aufblähen, ohne dass es etwas zu tun gäbe.
      findingCount: inCategory.filter((f) => f.severity !== 'info').length,
      criticalCount,
    } satisfies PublicScanCategory;
  });

  const counts = countBySeverity(input.findings);
  const ranked = [...input.findings]
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  return {
    engineVersion: PUBLIC_SCAN_ENGINE_VERSION,
    url: input.url,
    domain: input.domain,
    scannedAt: input.scannedAt,
    httpStatus: input.httpStatus,
    overallScore: Math.round(scores.health),
    categories,
    counts,
    preview: ranked.slice(0, PREVIEW_FINDING_LIMIT).map(toView),
    lockedCount: Math.max(0, ranked.length - PREVIEW_FINDING_LIMIT),
    technologies: input.signals.technologies,
    aiTools: input.signals.aiTools,
    chatWidgets: input.signals.chatWidgets,
    // Unter 1 kB HTML ist praktisch nichts auswertbar (Weiterleitungsseite,
    // Schutzwall, leere Antwort).
    coverage: input.htmlLength < 1024 ? 'limited' : 'full',
    disclaimer: PUBLIC_SCAN_DISCLAIMER,
  };
}

/**
 * Urteilsstufe aus Score und Anzahl schwerer Befunde. Der zweite Teil ist
 * wichtig: Ein einzelner kritischer Befund darf in einem sonst guten
 * Mittelwert nicht untergehen.
 */
export function verdictFor(score: number, criticalCount: number): PublicScanVerdict {
  if (criticalCount > 0) return score >= 60 ? 'potential_risks' : 'significant_risks';
  if (score >= 90) return 'no_obvious_issues';
  if (score >= 75) return 'minor_potential';
  if (score >= 50) return 'potential_risks';
  return 'significant_risks';
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  critical: 4, high: 3, medium: 2, low: 1, info: 0,
});

function countBySeverity(findings: RuntimeFinding[]): PublicScanCounts {
  let critical = 0;
  let medium = 0;
  let opportunity = 0;

  for (const f of findings) {
    if (f.severity === 'critical' || f.severity === 'high') critical++;
    else if (f.severity === 'medium') medium++;
    else opportunity++;
  }

  return { critical, medium, opportunity, total: findings.length };
}

function toView(finding: RuntimeFinding): PublicScanFindingView {
  return {
    code: finding.code,
    category: categoryOf(finding.dimension),
    severity: finding.severity,
    title: finding.title,
    reference: finding.reference,
    remediation: finding.remediation,
  };
}

export function categoryOf(dimension: Dimension): PublicScanCategoryId {
  for (const [id, dimensions] of Object.entries(CATEGORY_DIMENSIONS) as [PublicScanCategoryId, readonly Dimension[]][]) {
    if (dimensions.includes(dimension)) return id;
  }
  // Nicht erreichbar, solange CATEGORY_DIMENSIONS alle Dimensionen abdeckt;
  // ein Test hält das fest. Der Fallback verhindert einen Absturz, falls
  // `siteos-core` eine neunte Dimension einführt.
  return 'ux';
}

function round(value: number): number {
  return Math.round(value);
}
