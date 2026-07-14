/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Typen für den Cloud Code Optimizer Flow (/optimizer).
 *
 * Der Optimizer setzt auf die bestehende Scan-Pipeline (`gdpr-audit`
 * Edge Function) auf. `OptimizerScanResult` ist die schlanke Teilmenge
 * der `gdpr-audit`-Antwort, die der Flow tatsächlich rendert — bewusst
 * entkoppelt, damit die Optimizer-UI stabil bleibt, falls das
 * Audit-Backend zusätzliche Felder liefert.
 */

export type OptimizerSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Grobe Severity-Klasse für die gated Ergebnis-Übersicht (SEITE 4). */
export type SeverityBucket = 'kritisch' | 'wichtig' | 'info';

export interface OptimizerIssue {
  id: string;
  severity: OptimizerSeverity;
  title: string;
  /** Detail bleibt in der Übersicht bewusst ungenutzt (gated). */
  detail?: string;
}

export interface OptimizerScanResult {
  /** ID aus `gdpr-audit` — Brücke zum vollständigen Bericht (Phase 2). */
  auditId?: string;
  /** Gescannte Domain (host), z. B. "example.de". */
  domain: string;
  /** Original-URL wie vom Nutzer eingegeben/normalisiert. */
  url: string;
  /** 0–100. */
  score: number;
  issues: OptimizerIssue[];
  /** Konnte die Zielseite abgerufen werden? */
  fetched: boolean;
  scannedAt: string;
}

/** Aggregierte Zählung pro Severity-Bucket für die Ergebnis-Karten. */
export interface SeveritySummary {
  bucket: SeverityBucket;
  count: number;
}

/** Ordnet eine feingranulare Severity ihrem Anzeige-Bucket zu. */
export function bucketForSeverity(severity: OptimizerSeverity): SeverityBucket {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'kritisch';
    case 'medium':
    case 'low':
      return 'wichtig';
    case 'info':
    default:
      return 'info';
  }
}

/** Zählt Issues je Bucket — immer alle drei Buckets, auch bei count 0. */
export function summarizeSeverities(issues: OptimizerIssue[]): SeveritySummary[] {
  const order: SeverityBucket[] = ['kritisch', 'wichtig', 'info'];
  const counts: Record<SeverityBucket, number> = { kritisch: 0, wichtig: 0, info: 0 };
  for (const issue of issues) {
    counts[bucketForSeverity(issue.severity)] += 1;
  }
  return order.map((bucket) => ({ bucket, count: counts[bucket] }));
}
