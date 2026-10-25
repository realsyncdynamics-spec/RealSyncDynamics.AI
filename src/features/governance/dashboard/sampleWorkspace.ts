/**
 * Beispielansicht (WP-4, „Beispieldaten“) — fester, erfundener Datenstand
 * eines fiktiven Unternehmens für /app/beispiel.
 *
 * Bewusst KEIN Beispiel-Workspace in der Datenbank: Beispiel-Assets im
 * Kundenmandanten flössen in Risk-Score, Freigaben und die append-only
 * Evidence-Kette; ein zweiter Mandant pro Nutzer brächte Edge Functions aus
 * dem Tritt, die den Mandanten aus der einzigen Mitgliedschaft ableiten
 * (audit-claim, seo-dashboard-data, marketing-event). Hier wird nichts
 * gelesen und nichts geschrieben.
 *
 * Die Werte sind fest (kein Zufall, siehe check:fabrication) und laufen durch
 * dieselben Rechenfunktionen wie loadCockpitData — Score, Risiko-Index,
 * Verteilung und Maßnahmen widersprechen sich deshalb nicht. Zeitpunkte sind
 * relativ zu `now`, damit „vor 2 Std.“ nicht mit der Zeit veraltet.
 */
import type { CockpitData, CockpitRuntimeEvent } from '../cockpit/cockpitData';
import {
  computeAuditReadiness,
  computeGovernanceScoreIfReliable,
  type CockpitCounts,
  type CockpitPosture,
} from '../cockpit/cockpitScore';
import { prioritizeActions } from '../cockpit/prioritizeActions';
import {
  computeAssetFlows,
  computeEvidenceHealth,
  computeOpenMeasures,
  computeRiskDistribution,
  computeRiskIndex,
  type Summary24h,
} from './complianceStatus';
import { elevatedAssetsOf, type ScanFinding } from './dashboardSignals';
import type { StartPanelInput } from './startPanelModel';
import type { ComplianceKpiRow } from '../../../lib/status/statusAdapter';

/** Fiktiver Name — trägt die Kennzeichnung selbst, auch in Überschriften. */
export const SAMPLE_TENANT_NAME = 'Muster Logistik GmbH (Beispiel)';
/** `.example` ist reserviert (RFC 2606) — kann keine echte Domain sein. */
export const SAMPLE_DOMAIN = 'muster-logistik.example';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface SampleAsset {
  id: string;
  name: string;
  asset_type: string;
  risk_score: number;
}

const SAMPLE_ASSETS: readonly SampleAsset[] = [
  { id: 'sample-asset-website', name: SAMPLE_DOMAIN, asset_type: 'website', risk_score: 35 },
  { id: 'sample-asset-recruiting', name: 'Bewerber-Vorauswahl', asset_type: 'ai_system', risk_score: 78 },
  { id: 'sample-asset-chatbot', name: 'Kundenservice-Chatbot', asset_type: 'ai_system', risk_score: 55 },
  { id: 'sample-asset-routing', name: 'Tourenplanung', asset_type: 'ai_system', risk_score: 42 },
  { id: 'sample-asset-telephony', name: 'Cloud-Telefonie', asset_type: 'vendor', risk_score: 20 },
  { id: 'sample-asset-customers', name: 'Kundenstammdaten', asset_type: 'dataset', risk_score: 48 },
  { id: 'sample-asset-invoices', name: 'Rechnungseingang', asset_type: 'workflow', risk_score: 25 },
];

const SAMPLE_COUNTS: CockpitCounts = {
  incidents: 1,
  dpias: 1,
  dsr: { total: 2, overdue: 0 },
  approvals: 2,
  vendorsNoDpa: 1,
};

const SAMPLE_POSTURE: CockpitPosture = {
  policiesEnabledPercent: 72,
  assetEvidencePercent: 64,
  assetMappingsPercent: 58,
};

const SAMPLE_CONTROL_MAPPINGS = 14;
const SAMPLE_EVIDENCE_TOTAL = 23;

function iso(now: number, offsetMs: number): string {
  return new Date(now + offsetMs).toISOString();
}

function sampleSummary24h(now: number): Summary24h {
  return {
    new_risks: 1,
    resolved_risks: 1,
    new_evidence: 3,
    open_alerts: 2,
    new_alerts_24h: 1,
    critical_alerts: 0,
    failed_scans: 0,
    active_sources: 3,
    pending_sources: 0,
    next_scan_at: iso(now, 18 * HOUR),
  };
}

function sampleEvents(now: number): CockpitRuntimeEvent[] {
  return [
    {
      id: 'sample-event-tracking',
      title: 'Analyse-Skript lädt vor der Einwilligung',
      eventType: 'consent_finding',
      riskLevel: 'high',
      source: 'website_scanner',
      createdAt: iso(now, -2 * HOUR),
    },
    {
      id: 'sample-event-approval',
      title: 'Freigabe angefragt: Chatbot darf Bestellstatus nennen',
      eventType: 'approval_requested',
      riskLevel: 'medium',
      source: 'agent_runtime',
      createdAt: iso(now, -5 * HOUR),
    },
    {
      id: 'sample-event-dmarc-resolved',
      title: 'DMARC-Richtlinie gesetzt',
      eventType: 'email_auth_resolved',
      riskLevel: 'info',
      source: 'website_scanner',
      createdAt: iso(now, -20 * HOUR),
      resolvesEventId: 'sample-event-dmarc',
    },
    {
      id: 'sample-event-dmarc',
      title: 'DMARC-Richtlinie fehlt',
      eventType: 'email_auth_finding',
      riskLevel: 'medium',
      source: 'website_scanner',
      createdAt: iso(now, -3 * DAY),
      resolvedAt: iso(now, -20 * HOUR),
    },
    {
      id: 'sample-event-classified',
      title: 'Bewerber-Vorauswahl als Hochrisiko-System eingestuft',
      eventType: 'ai_act_classification',
      riskLevel: 'high',
      source: 'manual',
      createdAt: iso(now, -4 * DAY),
    },
  ];
}

function sampleFindings(now: number): ScanFinding[] {
  return [
    {
      id: 'sample-event-tracking',
      title: 'Analyse-Skript lädt vor der Einwilligung',
      level: 'high',
      eventType: 'consent_finding',
      source: 'website_scanner',
      createdAt: iso(now, -2 * HOUR),
      assetId: 'sample-asset-website',
      resolvedAt: null,
    },
    {
      id: 'sample-finding-imprint',
      title: 'Chatbot weist nicht darauf hin, dass er eine KI ist',
      level: 'medium',
      eventType: 'transparency_finding',
      source: 'website_scanner',
      createdAt: iso(now, -2 * HOUR),
      assetId: 'sample-asset-website',
      resolvedAt: null,
    },
    {
      id: 'sample-event-dmarc',
      title: 'DMARC-Richtlinie fehlt',
      level: 'medium',
      eventType: 'email_auth_finding',
      source: 'website_scanner',
      createdAt: iso(now, -3 * DAY),
      assetId: 'sample-asset-website',
      resolvedAt: iso(now, -20 * HOUR),
    },
  ];
}

/**
 * Cockpit-Daten des Beispiel-Unternehmens. Gleiche Form und gleiche
 * Ableitungen wie `loadCockpitData`, nur ohne Datenbank.
 */
export function buildSampleCockpitData(now: number = Date.now()): CockpitData {
  const summary24h = sampleSummary24h(now);
  const assetScores = SAMPLE_ASSETS.map((asset) => asset.risk_score);
  const scoreBasis = {
    aiSystems: SAMPLE_ASSETS.filter((asset) => asset.asset_type === 'ai_system').length,
    controlMappings: SAMPLE_CONTROL_MAPPINGS,
  };
  const scoreResult = computeGovernanceScoreIfReliable(true, SAMPLE_COUNTS, SAMPLE_POSTURE, scoreBasis);
  const latestEvidenceAt = iso(now, -2 * HOUR);

  return {
    counts: SAMPLE_COUNTS,
    posture: SAMPLE_POSTURE,
    score: scoreResult.score,
    scoreStatus: scoreResult.status,
    scoreBasis,
    readiness: computeAuditReadiness(SAMPLE_POSTURE),
    readinessTrend: { direction: 'up', percent: 12 },
    actions: prioritizeActions({
      now: new Date(now),
      incidents: [{
        id: 'sample-incident-chatbot',
        title: 'Chatbot nannte Bestelldaten einer anderen Person',
        severity: 'medium',
        status: 'investigating',
        notification_deadline_at: iso(now, 30 * HOUR),
      }],
      dpias: [{
        id: 'sample-dpia-recruiting',
        title: 'DSFA Bewerber-Vorauswahl',
        status: 'in_review',
        review_due_at: iso(now, 9 * DAY),
      }],
      dsrs: [{
        id: 'sample-dsr-access',
        request_type: 'access',
        status: 'in_progress',
        deadline_at: iso(now, 12 * DAY),
        completed_at: null,
      }, {
        id: 'sample-dsr-erasure',
        request_type: 'erasure',
        status: 'received',
        deadline_at: iso(now, 25 * DAY),
        completed_at: null,
      }],
    }),
    lastUpdated: iso(now, 0).slice(0, 10),
    postureStatus: 'measured',
    evidenceHealth: computeEvidenceHealth({
      coveragePercent: SAMPLE_POSTURE.assetEvidencePercent,
      totalCount: SAMPLE_EVIDENCE_TOTAL,
      hashedCount: SAMPLE_EVIDENCE_TOTAL,
      latestEvidenceAt,
      newEvidence24h: summary24h.new_evidence,
      failedScans: summary24h.failed_scans,
      now,
    }),
    riskIndex: computeRiskIndex({
      assetScores,
      newRisks24h: summary24h.new_risks,
      openIncidents: SAMPLE_COUNTS.incidents,
      dsrOverdue: SAMPLE_COUNTS.dsr.overdue,
    }),
    openMeasures: computeOpenMeasures(SAMPLE_COUNTS),
    summary24h,
    recentEvents: sampleEvents(now),
    riskDistribution: computeRiskDistribution(assetScores),
    assetFlows: computeAssetFlows([...SAMPLE_ASSETS]),
    partialFailures: [],
    signals: {
      elevatedAssets: elevatedAssetsOf(SAMPLE_ASSETS),
      findings: sampleFindings(now),
      lastScanAt: iso(now, -2 * HOUR),
      latestEvidenceAt,
    },
  };
}

/** Einrichtungsstand des Beispiels: alle fünf Schritte erledigt. */
export function buildSampleStartFacts(data: CockpitData): StartPanelInput {
  return {
    websiteCount: 1,
    scanCount: 4,
    aiSystemCount: data.scoreBasis.aiSystems,
    activationStatus: 'activated',
  };
}

/** KPI-Zeile des Beispiels (Trend, Befunde, Fristen, Policies, Vendoren). */
export function buildSampleComplianceKpi(now: number = Date.now()): ComplianceKpiRow {
  return {
    score_overall: 74,
    score_breakdown: {
      score_gdpr: 78,
      score_nis2: null,
      score_dsa: null,
      score_ai_act: 66,
      policy_compliance: 72,
      vendor_risk: 61,
      incident_response: 80,
      data_governance: 70,
    },
    riskTrendDirection: 'improving',
    criticalFindings: 0,
    newIncidents: 1,
    resolvedIncidents: 2,
    upcomingDeadlines: [
      { id: 'sample-dpia-recruiting', title: 'DSFA Bewerber-Vorauswahl prüfen', due_at: iso(now, 9 * DAY) },
    ],
    policies: { documented: 9, pending: 3 },
    vendors: { active: 6, highRisk: 1 },
  };
}
