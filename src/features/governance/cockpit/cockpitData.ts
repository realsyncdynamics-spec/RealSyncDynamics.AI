// CEO-Cockpit — gemeinsame Datenbeschaffung für View und Prüfer-Mappe.
//
// Lädt ausschliesslich über bestehende, RLS-gescopte APIs und verdichtet zu
// CockpitData. Resilient (allSettled): ein fehlschlagender Teil leert nicht
// das gesamte Cockpit.
import { getSupabase } from '../../../lib/supabase';
import { countOpenIncidents, fetchTenantIncidents } from '../incidentsApi';
import { countOpenDpias, listDpias } from '../dpiasApi';
import { countOpenDsrs, fetchTenantDsrs } from '../dsrApi';
import { countPendingApprovals } from '../approvalsApi';
import { countVendorsNoDpa } from '../vendorsApi';
import {
  countTenantEvidence, countTenantEvidenceHashed, fetchTenantAssets, fetchTenantEvents,
  type DbGovernanceEvent,
} from '../governanceApi';
import type { DbGovernanceKpiSnapshot } from '../analytics/types';
import {
  computeGovernanceScoreIfReliable, computeAuditReadiness,
  type CockpitCounts, type CockpitPosture,
} from './cockpitScore';
import { prioritizeActions, type PriorityAction } from './prioritizeActions';
import {
  computeAssetFlows, computeEvidenceHealth, computeOpenMeasures, computeRiskDistribution,
  computeRiskIndex, EMPTY_SUMMARY_24H,
  type AssetFlowItem, type EvidenceHealth, type OpenMeasures, type RiskBucket,
  type RiskIndex, type Summary24h,
} from '../dashboard/complianceStatus';

// KPI-Snapshots über das lazy getSupabase() (NICHT über analyticsApi, das den
// Client auf Modulebene erzeugt und ohne Env beim Import crasht). Aufrufe
// laufen in loadCockpitData unter Promise.allSettled — ein fehlender Snapshot
// (oder fehlende Env) leert das Cockpit nicht.
async function fetchLatestKpiSnapshot(tenantId: string): Promise<DbGovernanceKpiSnapshot | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_kpi_latest_snapshot', { p_tenant_id: tenantId });
  if (error) return null;
  return (data && data.length > 0 ? data[0] : null) as DbGovernanceKpiSnapshot | null;
}

async function fetchKpiSnapshotRange(tenantId: string, start: string, end: string): Promise<DbGovernanceKpiSnapshot[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_kpi_range', { p_tenant_id: tenantId, p_start_date: start, p_end_date: end });
  if (error) throw error;
  return (data || []) as DbGovernanceKpiSnapshot[];
}

async function fetch24hSummary(tenantId: string): Promise<Summary24h | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_24h_summary', { p_tenant_id: tenantId });
  if (error || data == null) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Partial<Summary24h> | undefined;
  if (!row || typeof row !== 'object') return null;
  return {
    ...EMPTY_SUMMARY_24H,
    new_risks: Number(row.new_risks) || 0,
    resolved_risks: Number(row.resolved_risks) || 0,
    new_evidence: Number(row.new_evidence) || 0,
    open_alerts: Number(row.open_alerts) || 0,
    new_alerts_24h: Number(row.new_alerts_24h) || 0,
    critical_alerts: Number(row.critical_alerts) || 0,
    failed_scans: Number(row.failed_scans) || 0,
    active_sources: Number(row.active_sources) || 0,
    pending_sources: Number(row.pending_sources) || 0,
    next_scan_at: typeof row.next_scan_at === 'string' ? row.next_scan_at : null,
  };
}

/** Schlanke Runtime-Events für den Command-Center-Stream (kein Payload). */
export interface CockpitRuntimeEvent {
  id: string;
  title: string;
  eventType: string;
  riskLevel: string;
  source: string;
  createdAt: string;
}

export interface CockpitData {
  counts: CockpitCounts;
  posture: CockpitPosture | null;
  score: number | null;
  readiness: number | null;
  readinessTrend: { direction: 'up' | 'down' | 'flat'; percent: number } | null;
  actions: PriorityAction[];
  lastUpdated: string | null;
  evidenceHealth: EvidenceHealth;
  riskIndex: RiskIndex;
  openMeasures: OpenMeasures;
  summary24h: Summary24h | null;
  /** Runtime-Event-Stream (neueste zuerst). Leer = keine Events oder Lade-Fehler. */
  recentEvents: CockpitRuntimeEvent[];
  /** Verteilung der Asset-Risk-Scores. Alle Zähler 0 wenn keine Assets. */
  riskDistribution: RiskBucket[];
  /** Asset-/KI-Flows nach Typ. Leer wenn keine Assets. */
  assetFlows: AssetFlowItem[];
  /** Abgelehnte Teillader — Dashboard darf das nicht als leeren Mandanten lesen. */
  partialFailures: string[];
}

function toRuntimeEvent(event: DbGovernanceEvent): CockpitRuntimeEvent {
  return {
    id: event.id,
    title: event.title,
    eventType: event.event_type,
    riskLevel: event.risk_level,
    source: event.event_source,
    createdAt: event.created_at,
  };
}

function val<T>(r: PromiseSettledResult<T>, fb: T): T {
  return r.status === 'fulfilled' ? r.value : fb;
}

function failureOf(name: string, result: PromiseSettledResult<unknown>): string | null {
  if (result.status !== 'rejected') return null;
  return `${name}: ${(result.reason as Error)?.message ?? 'fehlgeschlagen'}`;
}

export async function loadCockpitData(tenantId: string): Promise<CockpitData> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [
    incidentsCount, dpiasCount, dsrCount, approvalsCount, vendorsCount,
    latestKpi, kpiRange, incidentList, dpiaList, dsrList,
    summary24hRaw, assets, evidenceTotal, evidenceHashed, eventsRaw,
  ] = await Promise.allSettled([
    countOpenIncidents(tenantId),
    countOpenDpias(tenantId),
    countOpenDsrs(tenantId),
    countPendingApprovals(tenantId),
    countVendorsNoDpa(tenantId),
    fetchLatestKpiSnapshot(tenantId),
    fetchKpiSnapshotRange(tenantId, since, today),
    fetchTenantIncidents(tenantId),
    listDpias(tenantId),
    fetchTenantDsrs(tenantId),
    fetch24hSummary(tenantId),
    fetchTenantAssets(tenantId),
    countTenantEvidence(tenantId),
    countTenantEvidenceHashed(tenantId),
    fetchTenantEvents(tenantId, 12),
  ]);

  const counts: CockpitCounts = {
    incidents: val(incidentsCount, 0),
    dpias: val(dpiasCount, 0),
    dsr: val(dsrCount, { total: 0, overdue: 0 }),
    approvals: val(approvalsCount, 0),
    vendorsNoDpa: val(vendorsCount, 0),
  };

  const snap = val(latestKpi, null);
  const posture: CockpitPosture | null = snap
    ? {
        policiesEnabledPercent: snap.policies_enabled_percent,
        assetEvidencePercent: snap.assets_with_evidence_percent,
        assetMappingsPercent: snap.assets_with_mappings_percent,
      }
    : null;

  const range = val(kpiRange, []);
  let readinessTrend: CockpitData['readinessTrend'] = null;
  if (range.length >= 2) {
    const a = range[0].assets_with_mappings_percent;
    const b = range[range.length - 1].assets_with_mappings_percent;
    const direction = b > a ? 'up' : b < a ? 'down' : 'flat';
    const percent = a === 0 ? (b > 0 ? 100 : 0) : Math.abs(Math.round(((b - a) / a) * 100));
    readinessTrend = { direction, percent };
  }

  const actions = prioritizeActions({
    incidents: val(incidentList, []),
    dpias: val(dpiaList, { ok: false } as Awaited<ReturnType<typeof listDpias>>).dpias ?? [],
    dsrs: val(dsrList, []),
  });

  const summary24h = val(summary24hRaw, null);
  const assetRows = val(assets, []);
  const assetScores = assetRows.map((asset) => asset.risk_score);
  const evidenceTotalCount = val(evidenceTotal, 0);
  const evidenceHashedCount = val(evidenceHashed, 0);
  const recentEvents = val(eventsRaw, []).map(toRuntimeEvent);

  const openMeasures = computeOpenMeasures(counts);
  const evidenceHealth = computeEvidenceHealth({
    coveragePercent: posture?.assetEvidencePercent ?? null,
    totalCount: evidenceTotalCount,
    hashedCount: evidenceHashedCount,
    newEvidence24h: summary24h?.new_evidence ?? 0,
    failedScans: summary24h?.failed_scans ?? 0,
  });
  const riskIndex = computeRiskIndex({
    assetScores,
    newRisks24h: summary24h?.new_risks ?? 0,
    openIncidents: counts.incidents,
    dsrOverdue: counts.dsr.overdue,
  });
  const riskDistribution = computeRiskDistribution(assetScores);
  const assetFlows = computeAssetFlows(assetRows);

  const partialFailures = [
    failureOf('incidents', incidentsCount),
    failureOf('dpias', dpiasCount),
    failureOf('dsr', dsrCount),
    failureOf('approvals', approvalsCount),
    failureOf('vendors', vendorsCount),
    failureOf('kpi', latestKpi),
    failureOf('kpi-range', kpiRange),
    failureOf('incident-list', incidentList),
    failureOf('dpia-list', dpiaList),
    failureOf('dsr-list', dsrList),
    failureOf('summary-24h', summary24hRaw),
    failureOf('assets', assets),
    failureOf('evidence-total', evidenceTotal),
    failureOf('evidence-hashed', evidenceHashed),
    failureOf('events', eventsRaw),
  ].filter((item): item is string => item !== null);

  const countsReliable = [
    incidentsCount, dpiasCount, dsrCount, approvalsCount, vendorsCount,
  ].every((result) => result.status === 'fulfilled');

  return {
    counts, posture,
    score: computeGovernanceScoreIfReliable(countsReliable, counts, posture),
    readiness: computeAuditReadiness(posture),
    readinessTrend, actions,
    lastUpdated: snap?.captured_date ?? null,
    evidenceHealth, riskIndex, openMeasures, summary24h,
    recentEvents, riskDistribution, assetFlows,
    partialFailures,
  };
}

/** Deterministischer SHA-256-Hex über einen stabilen Cockpit-Snapshot. */
export async function cockpitIntegrityHash(data: CockpitData, generatedDate: string): Promise<string> {
  const stable = {
    generated_date: generatedDate,
    score: data.score,
    readiness: data.readiness,
    counts: data.counts,
    posture: data.posture,
    actions: data.actions.map((a) => ({ id: a.id, kind: a.kind, level: a.level, weight: a.weight })),
    last_updated: data.lastUpdated,
    evidence_health: data.evidenceHealth.percent,
    risk_index: data.riskIndex.score,
    open_measures_total: data.openMeasures.total,
  };
  const json = JSON.stringify(stable);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
