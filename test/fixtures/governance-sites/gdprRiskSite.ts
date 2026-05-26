/**
 * Fixture: realistic mittelständischer Web-Shop mit typischen DSGVO-
 * Verstößen. Genau der Befund-Mix, den ein gdpr-audit-Detector auf
 * einer schlecht konfigurierten WordPress-/Shopify-Seite emittieren
 * würde.
 *
 * Score-Math:
 *   100 -20 (consent) -10 -10 -10 (3× high) -5 -5 (2× medium)
 *       -2 (low) -0 (info) = 38 → grade F
 */
import type { Finding } from '../../../src/types/governance/finding';
import type { GoldenFixture } from './types';

const TENANT_ID  = '00000000-0000-0000-0000-000000000002';
const WEBSITE_ID = '00000000-0000-0000-0000-0000000000a2';
const SCAN_ID    = '00000000-0000-0000-0000-0000000000b2';
const CORR_ID    = '00000000-0000-0000-0000-0000000000c2';

const T0  = '2026-02-01T09:00:00.000Z';
const T1  = '2026-02-01T09:01:30.000Z';
const TC  = '2026-02-01T09:00:15.000Z';

function f(
  idx: number,
  category: Finding['category'],
  severity: Finding['severity'],
  summary: string,
  evidence_ref: string | null,
): Finding {
  const id = `00000000-0000-0000-0000-00000000d${idx.toString(16).padStart(3, '0')}`;
  return {
    id,
    tenant_id:      TENANT_ID,
    website_id:     WEBSITE_ID,
    scan_run_id:    SCAN_ID,
    category,
    severity,
    status:         'open',
    detector:       'gdpr-audit',
    evidence_ref,
    summary,
    raw_payload:    null,
    correlation_id: CORR_ID,
    created_at:     TC,
    updated_at:     TC,
  };
}

export const gdprRiskSiteFixture: GoldenFixture = {
  name: 'gdpr-risk-site',
  description:
    'Typischer DSGVO-Risk-Profil: Consent-Banner fehlt, Pre-Consent-Tracker ' +
    '(GA + Meta Pixel), AVV mit GA fehlt, veraltete Datenschutzerklärung, ' +
    'kein AI-Act-Hinweis, HSTS fehlt, CSP zu offen.',
  scanRun: {
    id:             SCAN_ID,
    tenant_id:      TENANT_ID,
    website_id:     WEBSITE_ID,
    detector:       'gdpr-audit',
    status:         'completed',
    started_at:     T0,
    completed_at:   T1,
    duration_ms:    90_000,
    finding_count:  8,
    severity_max:   'critical',
    error_code:     null,
    error_message:  null,
    raw_payload:    { url: 'https://shop.example.de', pages_scanned: 24 },
    correlation_id: CORR_ID,
    created_at:     T0,
    updated_at:     T1,
  },
  findings: [
    f(1, 'consent',      'critical', 'Kein Consent-Banner — Tracker laden vor Einwilligung (TTDSG §25).', 'url:https://shop.example.de/'),
    f(2, 'tracker',      'high',     'Google Analytics lädt vor Consent.', 'url:https://shop.example.de/scripts/ga.js'),
    f(3, 'tracker',      'high',     'Meta Pixel lädt vor Consent.', 'url:https://shop.example.de/scripts/pixel.js'),
    f(4, 'dpa',          'high',     'Kein AVV mit Google für GA dokumentiert.', 'inline:'),
    f(5, 'transparency', 'medium',   'Datenschutzerklärung > 24 Monate alt; Art. 13 unvollständig.', 'url:https://shop.example.de/datenschutz'),
    f(6, 'ai_act',       'medium',   'KI-gestützte Produktempfehlung ohne Transparenzhinweis (Art. 50).', 'url:https://shop.example.de/empfehlungen'),
    f(7, 'security',     'low',      'HSTS-Header fehlt.', 'sha256:ab12cd34ef5678901234567890abcdef0123456789abcdef0123456789abcdef'),
    f(8, 'security',     'info',     'CSP erlaubt unsafe-inline für Scripts.', 'url:https://shop.example.de/headers'),
  ],
  expected: {
    score: 38,
    grade: 'F',
    totalFindings: 8,
    severityBreakdown: { critical: 1, high: 3, medium: 2, low: 1, info: 1 },
    statusBreakdown:   {
      open: 8, acknowledged: 0, fixed: 0,
      false_positive: 0, ignored: 0, resolved: 0,
    },
    topFindingsCount: 8,
    evidenceCatalogSize: 8,
  },
};
