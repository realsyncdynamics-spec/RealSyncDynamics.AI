/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Optimierungsplan-Logik (Phase 3).
 *
 * Reine Funktionen: priorisiert die realen Scan-Befunde und schätzt das
 * Score-Potenzial nach Behebung. Bewusst als **Schätzung** ausgewiesen —
 * es findet keine tatsächliche Remediation statt (der Optimizer hat nur
 * Lese-Zugriff via gdpr-audit).
 */

import type { OptimizerIssue, OptimizerSeverity } from './types';
import { bucketForSeverity, type SeverityBucket } from './types';

const SEVERITY_ORDER: Record<OptimizerSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

export interface PlanItem {
  id: string;
  title: string;
  severity: OptimizerSeverity;
  bucket: SeverityBucket;
}

/** Befunde nach Schwere absteigend (kritisch zuerst), stabil. */
export function prioritizedPlan(issues: OptimizerIssue[]): PlanItem[] {
  return issues
    .map((issue, idx) => ({ issue, idx }))
    .sort((a, b) => {
      const s = SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity];
      return s !== 0 ? s : a.idx - b.idx; // stabil bei Gleichstand
    })
    .map(({ issue }) => ({
      id: issue.id,
      title: issue.title,
      severity: issue.severity,
      bucket: bucketForSeverity(issue.severity),
    }));
}

// Geschätzter Score-Gewinn pro behobenem Befund je Schwere.
const SEVERITY_GAIN: Record<OptimizerSeverity, number> = {
  critical: 8, high: 5, medium: 3, low: 1, info: 0,
};

/**
 * Schätzt das Score-Potenzial nach Behebung aller Befunde.
 * Deckelt bei 100 und ist bewusst konservativ — reine Orientierung,
 * keine Zusage.
 */
export function projectedScore(currentScore: number, issues: OptimizerIssue[]): number {
  const gain = issues.reduce((sum, i) => sum + (SEVERITY_GAIN[i.severity] ?? 0), 0);
  return Math.max(0, Math.min(100, Math.round(currentScore + gain)));
}
