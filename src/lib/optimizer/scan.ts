/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Scanner-Adapter für den Cloud Code Optimizer.
 *
 * Verwendet die bestehende `gdpr-audit` Edge Function wieder (keine
 * Duplikat-Pipeline) und mappt deren Antwort auf die schlanke
 * `OptimizerScanResult`-Form, die der /optimizer-Flow rendert.
 */

import { postEdgeFunction } from '../edgeFunction';
import type { OptimizerIssue, OptimizerScanResult, OptimizerSeverity } from './types';
import { domainFromUrl, normalizeUrl } from './state';

/** Teilmenge der `gdpr-audit`-Antwort, die wir konsumieren. */
interface GdprAuditIssue {
  id?: string;
  severity?: string;
  title?: string;
  detail?: string;
}
interface GdprAuditReport {
  audit_id?: string;
  domain?: string;
  score?: number;
  issues?: GdprAuditIssue[];
  fetched?: boolean;
}

const VALID_SEVERITIES: OptimizerSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

function normalizeSeverity(value: string | undefined): OptimizerSeverity {
  const v = (value ?? '').toLowerCase();
  return (VALID_SEVERITIES as string[]).includes(v) ? (v as OptimizerSeverity) : 'info';
}

/**
 * Führt einen öffentlichen Scan aus. Wirft mit einer nutzerlesbaren
 * Meldung, falls das Backend nicht erreichbar ist oder ablehnt.
 *
 * @param rawUrl  Nutzereingabe (mit oder ohne Protokoll)
 * @param scannedAt  ISO-Zeitstempel (vom Aufrufer injiziert → testbar)
 */
export async function runOptimizerScan(rawUrl: string, scannedAt: string): Promise<OptimizerScanResult> {
  const url = normalizeUrl(rawUrl);

  const report = await postEdgeFunction<GdprAuditReport>('gdpr-audit', {
    url,
    // Öffentlicher Erst-Scan: keine E-Mail nötig, Backend akzeptiert leer.
    email: '',
    source: 'optimizer',
  });

  const issues: OptimizerIssue[] = (report.issues ?? []).map((i, idx) => ({
    id: i.id ?? `issue-${idx}`,
    severity: normalizeSeverity(i.severity),
    title: i.title ?? 'Befund',
    detail: i.detail,
  }));

  return {
    auditId: report.audit_id,
    domain: report.domain ?? domainFromUrl(url),
    url,
    score: typeof report.score === 'number' ? Math.max(0, Math.min(100, Math.round(report.score))) : 0,
    issues,
    fetched: report.fetched ?? false,
    scannedAt,
  };
}
