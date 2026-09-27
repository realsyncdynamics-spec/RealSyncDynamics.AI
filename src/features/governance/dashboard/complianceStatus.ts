// Ableitung von Compliance-Status, Residualrisiko und Evidence-Gesundheit.
//
// Rein, testbar, ohne Netzwerk. Eingaben kommen aus bestehenden RLS-Counts,
// KPI-Snapshots, Asset-Risk-Scores und Evidence-Hashes — keine Mock-Fallbacks.

import type { CockpitCounts, ScoreLevel } from '../cockpit/cockpitScore';
import {
  daysSince,
  ELEVATED_RISK_THRESHOLD,
  EVIDENCE_MIN_ENTRIES,
  EVIDENCE_STALE_DAYS,
  RISK_BUCKET_LABEL,
  RISK_BUCKET_ORDER,
  RISK_THRESHOLDS,
  riskBucketFor,
  type RiskBucketId,
} from './dashboardSignals';

export interface EvidenceSignal {
  content_hash: string | null;
}

export interface Summary24h {
  new_risks: number;
  resolved_risks: number;
  new_evidence: number;
  open_alerts: number;
  new_alerts_24h: number;
  critical_alerts: number;
  failed_scans: number;
  active_sources: number;
  pending_sources: number;
  next_scan_at: string | null;
}

export const EMPTY_SUMMARY_24H: Summary24h = {
  new_risks: 0,
  resolved_risks: 0,
  new_evidence: 0,
  open_alerts: 0,
  new_alerts_24h: 0,
  critical_alerts: 0,
  failed_scans: 0,
  active_sources: 0,
  pending_sources: 0,
  next_scan_at: null,
};

export interface EvidenceHealth {
  percent: number | null;
  hashedCount: number;
  totalCount: number;
  newEvidence24h: number;
  failedScans: number;
  level: ScoreLevel | 'unknown';
  label: string;
  /**
   * `insufficient` = weniger als EVIDENCE_MIN_ENTRIES Nachweise (kein Wert);
   * `stale` = letzter Nachweis älter als EVIDENCE_STALE_DAYS;
   * `fresh` = jünger; `unknown` = Alter nicht bekannt.
   */
  freshness?: 'fresh' | 'stale' | 'insufficient' | 'unknown';
  /** Alter des jüngsten Nachweises in Tagen; `null` = unbekannt. */
  latestAgeDays?: number | null;
}

export interface RiskIndex {
  score: number | null;
  assetCount: number;
  highRiskAssets: number;
  avgAssetRisk: number | null;
  newRisks24h: number;
  level: ScoreLevel | 'unknown';
  label: string;
}

export interface OpenMeasures {
  total: number;
  incidents: number;
  dpias: number;
  dsrOpen: number;
  dsrOverdue: number;
  approvals: number;
  vendorsNoDpa: number;
}

/**
 * Ab diesem Asset-Risk-Score zählt ein Asset als erhöht (Bucket Hoch oder
 * Kritisch) — dieselbe Schwelle wie die Risk Distribution
 * (dashboardSignals.RISK_THRESHOLDS). Vorher 70: Kachel („0 ≥ 70“) und
 * Verteilung („1 Hoch“) widersprachen sich.
 */
export const HIGH_RISK_ASSET_THRESHOLD = ELEVATED_RISK_THRESHOLD;

export function computeOpenMeasures(counts: CockpitCounts): OpenMeasures {
  return {
    total:
      counts.incidents +
      counts.dpias +
      counts.dsr.total +
      counts.approvals +
      counts.vendorsNoDpa,
    incidents: counts.incidents,
    dpias: counts.dpias,
    dsrOpen: counts.dsr.total,
    dsrOverdue: counts.dsr.overdue,
    approvals: counts.approvals,
    vendorsNoDpa: counts.vendorsNoDpa,
  };
}

/**
 * Evidence-Gesundheit 0..100. Ohne Coverage und ohne Vault-Einträge → null
 * (leerer Mandant sieht leer, nicht „0 % kritisch“).
 *
 * Mix: 70 % KPI-Abdeckung + 30 % Hash-Anteil, abzüglich 8 Punkte je
 * fehlgeschlagenem Scan (24 h).
 *
 * Alter und Menge zählen mit: unter EVIDENCE_MIN_ENTRIES Nachweisen kein
 * Wert („Zu wenig Daten“); ist der jüngste Nachweis älter als
 * EVIDENCE_STALE_DAYS, heißt es „Veraltet“ statt „Prüfbar“.
 */
export function computeEvidenceHealth(input: {
  coveragePercent: number | null;
  evidence?: EvidenceSignal[];
  hashedCount?: number;
  totalCount?: number;
  newEvidence24h: number;
  failedScans: number;
  /** created_at des jüngsten Nachweises; fehlt ⇒ Alter unbekannt. */
  latestEvidenceAt?: string | null;
  now?: number;
}): EvidenceHealth {
  const rows = input.evidence ?? [];
  const totalCount = input.totalCount ?? rows.length;
  const hashedCount = input.hashedCount ?? rows.filter(
    (row) => typeof row.content_hash === 'string' && row.content_hash.length >= 16,
  ).length;
  const hashedShare =
    totalCount === 0 ? null : Math.round((hashedCount / totalCount) * 100);

  if (input.coveragePercent === null && totalCount === 0) {
    return {
      percent: null,
      hashedCount: 0,
      totalCount: 0,
      newEvidence24h: input.newEvidence24h,
      failedScans: input.failedScans,
      level: 'unknown',
      label: 'Keine Evidence',
      freshness: 'unknown',
      latestAgeDays: null,
    };
  }

  const latestAgeDays = daysSince(input.latestEvidenceAt ?? null, input.now);

  if (totalCount > 0 && totalCount < EVIDENCE_MIN_ENTRIES) {
    return {
      percent: null,
      hashedCount,
      totalCount,
      newEvidence24h: input.newEvidence24h,
      failedScans: input.failedScans,
      level: 'unknown',
      label: 'Zu wenig Daten',
      freshness: 'insufficient',
      latestAgeDays,
    };
  }

  const coverage = input.coveragePercent ?? hashedShare ?? 0;
  const hashPart = hashedShare ?? coverage;
  const blended = Math.round(0.7 * coverage + 0.3 * hashPart);
  const percent = clamp(blended - input.failedScans * 8);
  const stale = latestAgeDays !== null && latestAgeDays > EVIDENCE_STALE_DAYS;
  const level = healthLevel(percent);

  return {
    percent,
    hashedCount,
    totalCount,
    newEvidence24h: input.newEvidence24h,
    failedScans: input.failedScans,
    // Veraltete Nachweise nie grün: höchstens „medium“.
    level: stale && (level === 'passed' || level === 'low') ? 'medium' : level,
    label: stale ? 'Veraltet' : evidenceLabel(percent, totalCount),
    freshness: stale ? 'stale' : latestAgeDays === null ? 'unknown' : 'fresh',
    latestAgeDays,
  };
}

/**
 * Residualrisiko 0..100 (höher = schlechter). Mix: 60 % mittlerer
 * Asset-Risk-Score + 40 % operative Last (Vorfälle, überfällige DSR, neue Risiken 24 h).
 * Ohne Assets und ohne operative Last → null.
 */
export function computeRiskIndex(input: {
  assetScores: number[];
  newRisks24h: number;
  openIncidents: number;
  dsrOverdue: number;
}): RiskIndex {
  const assetCount = input.assetScores.length;
  const highRiskAssets = input.assetScores.filter(
    (score) => score >= HIGH_RISK_ASSET_THRESHOLD,
  ).length;
  const avgAssetRisk =
    assetCount === 0
      ? null
      : Math.round(input.assetScores.reduce((sum, score) => sum + score, 0) / assetCount);

  const operational = clamp(
    input.openIncidents * 15 + input.dsrOverdue * 18 + input.newRisks24h * 8,
  );

  if (assetCount === 0 && operational === 0) {
    return {
      score: null,
      assetCount: 0,
      highRiskAssets: 0,
      avgAssetRisk: null,
      newRisks24h: input.newRisks24h,
      level: 'unknown',
      label: 'Kein Residualrisiko erfasst',
    };
  }

  const score =
    avgAssetRisk === null
      ? operational
      : Math.round(0.6 * avgAssetRisk + 0.4 * operational);

  return {
    score,
    assetCount,
    highRiskAssets,
    avgAssetRisk,
    newRisks24h: input.newRisks24h,
    level: riskLevel(score),
    label: riskLabel(score),
  };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function healthLevel(percent: number): ScoreLevel {
  if (percent >= 85) return 'passed';
  if (percent >= 65) return 'low';
  if (percent >= 40) return 'medium';
  return 'critical';
}

function evidenceLabel(percent: number, totalCount: number): string {
  if (totalCount === 0) return 'Abdeckung ohne Vault-Einträge';
  if (percent >= 85) return 'Prüfbar';
  if (percent >= 65) return 'Weitgehend prüfbar';
  if (percent >= 40) return 'Lückenhaft';
  return 'Nicht prüfbar';
}

// Residualrisiko und Risk Distribution nutzen dieselben Schwellen
// (dashboardSignals.RISK_THRESHOLDS) und dieselben Bucket-Bezeichnungen.
function riskLevel(score: number): ScoreLevel {
  return riskBucketFor(score);
}

function riskLabel(score: number): string {
  return RISK_BUCKET_LABEL[riskBucketFor(score)];
}

/** Buckets für die Risk-Distribution (Asset-Risk-Scores). Höher = schlechter. */
export type { RiskBucketId };

export interface RiskBucket {
  id: RiskBucketId;
  label: string;
  count: number;
}

export interface AssetFlowItem {
  type: string;
  label: string;
  count: number;
  highRisk: number;
  href: string;
}

/** Für Hinweise im UI („Hoch ab 50“) — aus derselben Quelle wie die Buckets. */
export const RISK_BUCKET_MIN: Record<RiskBucketId, number> = { ...RISK_THRESHOLDS, passed: 0 };

const ASSET_FLOW_META: Record<string, { label: string; href: string }> = {
  website: { label: 'Websites', href: '/app/websites' },
  ai_system: { label: 'KI-Systeme', href: '/app/ai-systems' },
  vendor: { label: 'Vendoren', href: '/app/vendors' },
  model: { label: 'Modelle', href: '/app/ai-systems' },
  agent: { label: 'Agenten', href: '/app/agents' },
  api: { label: 'APIs', href: '/app/monitoring' },
  dataset: { label: 'Datensätze', href: '/app/datasets' },
  repository: { label: 'Repos', href: '/app/monitoring' },
  workflow: { label: 'Workflows', href: '/app/workflows' },
};

/** Verteilt Asset-Risk-Scores in Ampel-Buckets. Ohne Scores → leere Zähler. */
export function computeRiskDistribution(assetScores: number[]): RiskBucket[] {
  const counts: Record<RiskBucketId, number> = {
    critical: 0, high: 0, medium: 0, low: 0, passed: 0,
  };
  for (const score of assetScores) {
    counts[riskBucketFor(score)] += 1;
  }
  return RISK_BUCKET_ORDER.map((id) => ({ id, label: RISK_BUCKET_LABEL[id], count: counts[id] }));
}

/** Aggregiert Asset-Typen für den Flow-Bereich. Unbekannte Typen werden übersprungen. */
export function computeAssetFlows(
  assets: Array<{ asset_type: string; risk_score: number }>,
): AssetFlowItem[] {
  const byType = new Map<string, { count: number; highRisk: number }>();
  for (const asset of assets) {
    const meta = ASSET_FLOW_META[asset.asset_type];
    if (!meta) continue;
    const prev = byType.get(asset.asset_type) ?? { count: 0, highRisk: 0 };
    prev.count += 1;
    if (asset.risk_score >= HIGH_RISK_ASSET_THRESHOLD) prev.highRisk += 1;
    byType.set(asset.asset_type, prev);
  }
  // Feste Reihenfolge: Websites und KI zuerst, dann Rest nach Count.
  const preferred = ['website', 'ai_system', 'vendor', 'agent', 'workflow', 'dataset', 'model', 'api', 'repository'];
  return preferred
    .filter((type) => byType.has(type))
    .map((type) => {
      const meta = ASSET_FLOW_META[type];
      const stats = byType.get(type)!;
      return { type, label: meta.label, count: stats.count, highRisk: stats.highRisk, href: meta.href };
    });
}
