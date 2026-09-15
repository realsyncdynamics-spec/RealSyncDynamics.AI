// Ableitung von Compliance-Status, Residualrisiko und Evidence-Gesundheit.
//
// Rein, testbar, ohne Netzwerk. Eingaben kommen aus bestehenden RLS-Counts,
// KPI-Snapshots, Asset-Risk-Scores und Evidence-Hashes — keine Mock-Fallbacks.

import type { CockpitCounts, ScoreLevel } from '../cockpit/cockpitScore';

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

/** Asset-Risk-Score ≥ 70 gilt im Register als erhöht (siehe GovernanceDashboardView). */
export const HIGH_RISK_ASSET_THRESHOLD = 70;

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
 */
export function computeEvidenceHealth(input: {
  coveragePercent: number | null;
  evidence?: EvidenceSignal[];
  hashedCount?: number;
  totalCount?: number;
  newEvidence24h: number;
  failedScans: number;
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
    };
  }

  const coverage = input.coveragePercent ?? hashedShare ?? 0;
  const hashPart = hashedShare ?? coverage;
  const blended = Math.round(0.7 * coverage + 0.3 * hashPart);
  const percent = clamp(blended - input.failedScans * 8);

  return {
    percent,
    hashedCount,
    totalCount,
    newEvidence24h: input.newEvidence24h,
    failedScans: input.failedScans,
    level: healthLevel(percent),
    label: evidenceLabel(percent, totalCount),
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

function riskLevel(score: number): ScoreLevel {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  if (score >= 15) return 'low';
  return 'passed';
}

function riskLabel(score: number): string {
  if (score >= 70) return 'Kritisch';
  if (score >= 50) return 'Erhöht';
  if (score >= 30) return 'Moderat';
  if (score >= 15) return 'Gering';
  return 'Stabil';
}

/** Buckets für die Risk-Distribution (Asset-Risk-Scores). Höher = schlechter. */
export type RiskBucketId = 'critical' | 'high' | 'medium' | 'low' | 'passed';

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

const RISK_BUCKETS: Array<{ id: RiskBucketId; label: string; min: number }> = [
  { id: 'critical', label: 'Kritisch', min: 70 },
  { id: 'high', label: 'Hoch', min: 50 },
  { id: 'medium', label: 'Mittel', min: 30 },
  { id: 'low', label: 'Gering', min: 15 },
  { id: 'passed', label: 'Stabil', min: 0 },
];

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
    const bucket = RISK_BUCKETS.find((b) => score >= b.min) ?? RISK_BUCKETS[RISK_BUCKETS.length - 1];
    counts[bucket.id] += 1;
  }
  return RISK_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: counts[b.id] }));
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
