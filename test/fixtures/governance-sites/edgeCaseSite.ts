/**
 * Fixture: Edge-Case-Profil — testet bewusst die Schwachstellen der
 * Scoring-Logik:
 *
 *  - 'fixed'-Status zählt mit 50 % der Strafe
 *  - 'false_positive' / 'ignored' / 'resolved' zählen GAR NICHT
 *  - 'acknowledged' zählt voll
 *  - 'info'-Schweregrad reduziert nie
 *  - Score wird auf 0 gefloort (kein negatives Ergebnis)
 *  - Evidence-Catalog dedupliziert gleiche evidence_ref
 *
 * Score-Math (reine Strafen-Summe):
 *   critical/open       -20
 *   critical/fixed      -10   (= 20 × 0.5)
 *   critical/fp         0
 *   critical/ignored    0
 *   critical/resolved   0
 *   high/acknowledged   -10
 *   medium/fixed        -2.5  (= 5 × 0.5)
 *   low/open            -2
 *   info/open           0
 *  ─────────────────────────
 *  Σ                    -44.5 → 100 - 44.5 = 55.5 → Math.round → 56 → grade D
 *
 * Evidence-Catalog: f1 + f2 teilen sich denselben URL-Ref → Catalog
 * hat einen Eintrag dafür mit zwei `supports`. f3 / f8 haben null →
 * werden im Catalog ignoriert. Erwartete Catalog-Größe: 6 Einträge.
 */
import type { Finding, FindingStatus, FindingSeverity, FindingCategory } from '../../../src/types/governance/finding';
import type { GoldenFixture } from './types';

const TENANT_ID  = '00000000-0000-0000-0000-000000000003';
const WEBSITE_ID = '00000000-0000-0000-0000-0000000000a3';
const SCAN_ID    = '00000000-0000-0000-0000-0000000000b3';
const CORR_ID    = '00000000-0000-0000-0000-0000000000c3';

const T0 = '2026-03-01T10:00:00.000Z';
const T1 = '2026-03-01T10:00:30.000Z';
const TC = '2026-03-01T10:00:10.000Z';

interface FArgs {
  idx:          number;
  category:     FindingCategory;
  severity:     FindingSeverity;
  status:       FindingStatus;
  summary:      string;
  evidence_ref: string | null;
}

function f(a: FArgs): Finding {
  const id = `00000000-0000-0000-0000-00000000e${a.idx.toString(16).padStart(3, '0')}`;
  return {
    id,
    tenant_id:      TENANT_ID,
    website_id:     WEBSITE_ID,
    scan_run_id:    SCAN_ID,
    category:       a.category,
    severity:       a.severity,
    status:         a.status,
    detector:       'governance-agent',
    evidence_ref:   a.evidence_ref,
    summary:        a.summary,
    raw_payload:    null,
    confidence_score:    0.80,
    evidence_level:      'observed',
    verification_status: 'unverified',
    correlation_id: CORR_ID,
    created_at:     TC,
    updated_at:     TC,
  };
}

const SHARED_EVIDENCE = 'url:https://edge.example.de/track.js';

export const edgeCaseSiteFixture: GoldenFixture = {
  name: 'edge-case-site',
  description:
    'Synthetischer Mix mit allen Status-Werten, einem 50%-fixed-Befund, ' +
    'einem geteilten Evidence-Ref (Dedup), null-Evidence und reinem info-Befund.',
  scanRun: {
    id:             SCAN_ID,
    tenant_id:      TENANT_ID,
    website_id:     WEBSITE_ID,
    detector:       'governance-agent',
    status:         'completed',
    started_at:     T0,
    completed_at:   T1,
    duration_ms:    30_000,
    finding_count:  9,
    severity_max:   'critical',
    error_code:     null,
    error_message:  null,
    raw_payload:    null,
    correlation_id: CORR_ID,
    created_at:     T0,
    updated_at:     T1,
  },
  findings: [
    f({ idx: 1, category: 'tracker',  severity: 'critical', status: 'open',           summary: 'Tracker lädt ungebremst.',          evidence_ref: SHARED_EVIDENCE }),
    f({ idx: 2, category: 'tracker',  severity: 'critical', status: 'fixed',          summary: 'Tracker — Patch deployed, Re-Scan offen.', evidence_ref: SHARED_EVIDENCE }),
    f({ idx: 3, category: 'consent',  severity: 'critical', status: 'false_positive', summary: 'Banner war doch korrekt.',          evidence_ref: null }),
    f({ idx: 4, category: 'security', severity: 'critical', status: 'ignored',        summary: 'Bekanntes Restrisiko, akzeptiert.', evidence_ref: 'runtime-event:11111111-2222-3333-4444-555555555555' }),
    f({ idx: 5, category: 'dpa',      severity: 'critical', status: 'resolved',       summary: 'AVV nachgereicht, durch Re-Scan bestätigt.', evidence_ref: 'storage://evidence/avv-2026-03.pdf' }),
    f({ idx: 6, category: 'ai_act',   severity: 'high',     status: 'acknowledged',   summary: 'KI-Transparenz fehlt, Behebung in Q2.', evidence_ref: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' }),
    f({ idx: 7, category: 'tom',      severity: 'medium',   status: 'fixed',          summary: 'Backup-Plan dokumentiert, Re-Scan offen.', evidence_ref: 'inline:' }),
    f({ idx: 8, category: 'security', severity: 'low',      status: 'open',           summary: 'X-Content-Type-Options fehlt.',     evidence_ref: null }),
    f({ idx: 9, category: 'documentation', severity: 'info', status: 'open',          summary: 'DPIA-Vorlage könnte aktualisiert werden.', evidence_ref: 'url:https://edge.example.de/dpia' }),
  ],
  expected: {
    score: 56,
    grade: 'D',
    totalFindings: 9,
    severityBreakdown: { critical: 5, high: 1, medium: 1, low: 1, info: 1 },
    statusBreakdown:   {
      open: 3, acknowledged: 1, fixed: 2,
      false_positive: 1, ignored: 1, resolved: 1,
    },
    topFindingsCount: 9,
    evidenceCatalogSize: 6,
  },
};
