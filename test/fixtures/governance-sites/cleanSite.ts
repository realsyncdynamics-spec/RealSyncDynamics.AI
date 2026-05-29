/**
 * Fixture: a hypothetical site that passes a governance scan with
 * zero findings. Locks the "perfect score" boundary of the report
 * pipeline (score 100, grade A, empty top_findings, empty evidence
 * catalog).
 */
import type { GoldenFixture } from './types';

const TENANT_ID  = '00000000-0000-0000-0000-000000000001';
const WEBSITE_ID = '00000000-0000-0000-0000-0000000000a1';
const SCAN_ID    = '00000000-0000-0000-0000-0000000000b1';
const CORR_ID    = '00000000-0000-0000-0000-0000000000c1';

const T0 = '2026-01-01T08:00:00.000Z';
const T1 = '2026-01-01T08:00:42.000Z';

export const cleanSiteFixture: GoldenFixture = {
  name: 'clean-site',
  description:
    'Saubere Kontroll-Seite: Consent-Banner korrekt, alle Tracker post-consent, ' +
    'AVV vollständig, TLS- und Sicherheits-Header gesetzt. Kein Befund.',
  scanRun: {
    id:             SCAN_ID,
    tenant_id:      TENANT_ID,
    website_id:     WEBSITE_ID,
    detector:       'gdpr-audit',
    status:         'completed',
    started_at:     T0,
    completed_at:   T1,
    duration_ms:    42_000,
    finding_count:  0,
    severity_max:   null,
    error_code:     null,
    error_message:  null,
    raw_payload:    { url: 'https://clean.example.de', pages_scanned: 12 },
    correlation_id: CORR_ID,
    created_at:     T0,
    updated_at:     T1,
  },
  findings: [],
  expected: {
    score: 100,
    grade: 'A',
    totalFindings: 0,
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    statusBreakdown:   {
      open: 0, acknowledged: 0, fixed: 0,
      false_positive: 0, ignored: 0, resolved: 0,
    },
    topFindingsCount: 0,
    evidenceCatalogSize: 0,
  },
};
