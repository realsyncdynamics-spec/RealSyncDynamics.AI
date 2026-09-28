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
  countTenantControlMappings, countTenantEvidence, countTenantEvidenceHashed,
  fetchTenantAssets, fetchTenantEvents, fetchTenantEvidence, fetchTenantFindingEvents,
  type DbGovernanceEvent,
} from '../governanceApi';
import { listOpenFindingsForTenant, listScanRuns, type OpenFindingRow } from '../scans/scansApi';
import {
  elevatedAssetsOf, findingsFromTable, pairFindings, resolutionIndex, resolvesEventIdOf,
  type DashboardSignals, type Resolution, type ScanFinding,
} from '../dashboard/dashboardSignals';
import type { DbGovernanceKpiSnapshot } from '../analytics/types';
import {
  computeGovernanceScoreIfReliable, computeAuditReadiness,
  type CockpitCounts, type CockpitPosture, type GovernanceScoreStatus,
} from './cockpitScore';
import { isAiSystemAsset } from '../handoff/enforcementModel';
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
// leert das Cockpit nicht.
//
// `null` heisst ausschliesslich „kein Snapshot vorhanden“. Ein RPC-Fehler
// wirft: Früher wurde er zu `null` verschluckt und ergab zusammen mit dem
// Penalty-Score 100 — ohne Eintrag in `partialFailures`.
export async function fetchLatestKpiSnapshot(tenantId: string): Promise<DbGovernanceKpiSnapshot | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_kpi_latest_snapshot', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message || 'governance_kpi_latest_snapshot fehlgeschlagen');
  return (Array.isArray(data) && data.length > 0 ? data[0] : null) as DbGovernanceKpiSnapshot | null;
}

async function fetchKpiSnapshotRange(tenantId: string, start: string, end: string): Promise<DbGovernanceKpiSnapshot[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_kpi_range', { p_tenant_id: tenantId, p_start_date: start, p_end_date: end });
  if (error) throw error;
  return (data || []) as DbGovernanceKpiSnapshot[];
}

// `null` = RPC lieferte keine Zeile. Ein RPC-Fehler wirft und landet in
// `partialFailures` (früher still `null` — nicht unterscheidbar von „leer“).
export async function fetch24hSummary(tenantId: string): Promise<Summary24h | null> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('governance_24h_summary', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message || 'governance_24h_summary fehlgeschlagen');
  if (data == null) return null;
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

/**
 * governance-dpias antwortet bei Fehlern mit `{ ok: false }` statt zu werfen.
 * Ohne diese Umwandlung ergäbe ein Fehler eine leere DSFA-Liste — und damit
 * „keine offenen Pflichten“.
 */
async function listDpiasOrThrow(tenantId: string) {
  const result = await listDpias(tenantId);
  if (!result.ok) throw new Error(result.error?.message ?? 'governance-dpias list fehlgeschlagen');
  return result;
}

/**
 * Misst der KPI-Snapshot die Posture wirklich? Der Aggregator fällt bei
 * fehlenden Metrik-RPCs still auf 0 zurück (get_asset_metrics & Co. stehen in
 * keiner Migration). Ein Snapshot mit `asset_count` 0, während der Mandant
 * Assets hat, ist deshalb keine Messung — seine 0-%-Werte dürfen weder in den
 * Score noch in die Audit-Readiness eingehen.
 */
export function snapshotMeasuresPosture(
  snapshot: Pick<DbGovernanceKpiSnapshot, 'asset_count'>,
  liveAssetCount: number | null,
): boolean {
  if (liveAssetCount === null) return false;
  return !(liveAssetCount > 0 && Number(snapshot.asset_count) === 0);
}

/** Posture-Quelle: gemessen, kein Snapshot, Snapshot ohne Messung, Fehler. */
export type PostureStatus = 'measured' | 'missing' | 'not_measured' | 'error';

/** Teillader, aus denen die Pflichten-/Maßnahmenliste (`actions`) entsteht. */
export const ACTION_SOURCES = ['incident-list', 'dpia-list', 'dsr-list'] as const;
/** Teillader der offenen Posten (`counts` / `openMeasures`). */
export const COUNT_SOURCES = ['incidents', 'dpias', 'dsr', 'approvals', 'vendors'] as const;
/** Teillader der Risiko-/Befundsignale. */
export const SIGNAL_SOURCES = ['assets', 'findings', 'findings-table'] as const;

/**
 * Sind alle genannten Teillader erfolgreich? Nur dann darf eine leere Liste
 * oder eine 0 als „nichts offen“ gelesen werden.
 */
export function sourcesOk(
  data: Pick<CockpitData, 'partialFailures'> | null | undefined,
  names: readonly string[],
): boolean {
  if (!data) return false;
  return !data.partialFailures.some((failure) => names.some((name) => failure.startsWith(`${name}:`)));
}

/**
 * Befunde aus beiden Speichern, ohne Doppelte. email-auth-rescan schreibt
 * denselben Befund als `findings`-Zeile und als governance_events-Befund
 * (payload.finding_id ↔ raw_payload.event_id). Die Tabellenzeile ist
 * kanonisch (Status, „behoben, wartet auf Nachprüfung“); ihr Event-Zwilling
 * fällt weg.
 */
export function mergeFindingSources(
  events: DbGovernanceEvent[],
  rows: readonly OpenFindingRow[],
): ScanFinding[] {
  const tableIds = new Set(rows.map((row) => row.id));
  const twinEventIds = new Set(rows.map((row) => row.event_id).filter((id): id is string => Boolean(id)));
  for (const event of events) {
    const findingId = event.payload?.finding_id;
    if (typeof findingId === 'string' && tableIds.has(findingId)) twinEventIds.add(event.id);
  }
  return [
    ...pairFindings(events).filter((finding) => !twinEventIds.has(finding.id)),
    ...findingsFromTable(rows),
  ];
}

/** Schlanke Runtime-Events für den Command-Center-Stream (kein Payload). */
export interface CockpitRuntimeEvent {
  id: string;
  title: string;
  eventType: string;
  riskLevel: string;
  source: string;
  createdAt: string;
  /** Behoben am (gepaartes `*_resolved`-Event); fehlt/`null` = nicht behoben. */
  resolvedAt?: string | null;
  /** Behebung manuell bestätigt (payload.source === 'manual_owner_approved'). */
  resolvedManually?: boolean;
  /** Bei Behebungs-Events: ID des behobenen Events. */
  resolvesEventId?: string | null;
}

export interface CockpitData {
  counts: CockpitCounts;
  posture: CockpitPosture | null;
  /** Nur bei `scoreStatus === 'ok'` eine Zahl (cockpitScore.ts). */
  score: number | null;
  scoreStatus: GovernanceScoreStatus;
  /** Datenbasis des Scores; `null` = Zähler nicht ladbar. */
  scoreBasis: { aiSystems: number | null; controlMappings: number | null };
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
  /**
   * Posture-Quelle (optional für bestehende Fixtures). `not_measured`: Snapshot
   * vorhanden, misst aber nichts — `posture` ist dann `null`.
   */
  postureStatus?: PostureStatus;
  /** Abgelehnte Teillader — Dashboard darf das nicht als leeren Mandanten lesen. */
  partialFailures: string[];
  /**
   * Risiko-/Befund-/Alterssignale (dashboardSignals). Optional, damit
   * bestehende Fixtures gültig bleiben; loadCockpitData setzt es immer.
   */
  signals?: DashboardSignals;
}

function toRuntimeEvent(event: DbGovernanceEvent, resolved?: Map<string, Resolution>): CockpitRuntimeEvent {
  return {
    id: event.id,
    title: event.title,
    eventType: event.event_type,
    riskLevel: event.risk_level,
    source: event.event_source,
    createdAt: event.created_at,
    resolvedAt: resolved?.get(event.id)?.resolvedAt ?? null,
    resolvedManually: resolved?.get(event.id)?.manual ?? false,
    resolvesEventId: resolvesEventIdOf(event),
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
    summary24hRaw, assets, evidenceTotal, evidenceHashed, eventsRaw, mappingsCount,
    findingEvents, latestEvidenceRows, latestScanRuns, openFindingRows,
  ] = await Promise.allSettled([
    countOpenIncidents(tenantId),
    countOpenDpias(tenantId),
    countOpenDsrs(tenantId),
    countPendingApprovals(tenantId),
    countVendorsNoDpa(tenantId),
    fetchLatestKpiSnapshot(tenantId),
    fetchKpiSnapshotRange(tenantId, since, today),
    fetchTenantIncidents(tenantId),
    listDpiasOrThrow(tenantId),
    fetchTenantDsrs(tenantId),
    fetch24hSummary(tenantId),
    fetchTenantAssets(tenantId),
    countTenantEvidence(tenantId),
    countTenantEvidenceHashed(tenantId),
    fetchTenantEvents(tenantId, 12),
    countTenantControlMappings(tenantId),
    fetchTenantFindingEvents(tenantId),
    fetchTenantEvidence(tenantId, 1),
    listScanRuns(tenantId, { limit: 1 }),
    // Kanonische Befunde des Website-Audits (tenant-audit schreibt `findings`,
    // nicht governance_events). In einer Promise-Kette, damit auch ein
    // synchroner Fehler als Teilausfall landet statt das Cockpit zu leeren.
    Promise.resolve().then(() => listOpenFindingsForTenant(tenantId)),
  ]);

  const counts: CockpitCounts = {
    incidents: val(incidentsCount, 0),
    dpias: val(dpiasCount, 0),
    dsr: val(dsrCount, { total: 0, overdue: 0 }),
    approvals: val(approvalsCount, 0),
    vendorsNoDpa: val(vendorsCount, 0),
  };

  const snap = val(latestKpi, null);
  const liveAssetCount = assets.status === 'fulfilled' ? assets.value.length : null;
  const postureStatus: PostureStatus =
    latestKpi.status === 'rejected' ? 'error'
      : snap === null ? 'missing'
        : snapshotMeasuresPosture(snap, liveAssetCount) ? 'measured'
          : 'not_measured';
  const posture: CockpitPosture | null = snap && postureStatus === 'measured'
    ? {
        policiesEnabledPercent: snap.policies_enabled_percent,
        assetEvidencePercent: snap.assets_with_evidence_percent,
        assetMappingsPercent: snap.assets_with_mappings_percent,
      }
    : null;

  const range = val(kpiRange, []);
  let readinessTrend: CockpitData['readinessTrend'] = null;
  // Trend nur aus messenden Snapshots — sonst wäre es ein Trend über Nullen.
  if (postureStatus === 'measured' && range.length >= 2) {
    const a = range[0].assets_with_mappings_percent;
    const b = range[range.length - 1].assets_with_mappings_percent;
    const direction = b > a ? 'up' : b < a ? 'down' : 'flat';
    const percent = a === 0 ? (b > 0 ? 100 : 0) : Math.abs(Math.round(((b - a) / a) * 100));
    readinessTrend = { direction, percent };
  }

  const actions = prioritizeActions({
    incidents: val(incidentList, []),
    dpias: val(dpiaList, { ok: false } as Awaited<ReturnType<typeof listDpiasOrThrow>>).dpias ?? [],
    dsrs: val(dsrList, []),
  });

  const summary24h = val(summary24hRaw, null);
  const assetRows = val(assets, []);
  const assetScores = assetRows.map((asset) => asset.risk_score);
  const evidenceTotalCount = val(evidenceTotal, 0);
  const evidenceHashedCount = val(evidenceHashed, 0);
  // Behebungs-Paarung über Stream- und Befund-Events (append-only,
  // payload.resolves_event_id) — das alte Event zeigt „behoben“.
  const eventRows = val(eventsRaw, []);
  const findingRows = val(findingEvents, []);
  const resolved = resolutionIndex([...eventRows, ...findingRows]);
  const recentEvents = eventRows.map((event) => toRuntimeEvent(event, resolved));

  const openMeasures = computeOpenMeasures(counts);
  const latestEvidenceAt = val(latestEvidenceRows, [])[0]?.created_at ?? null;
  const evidenceHealth = computeEvidenceHealth({
    coveragePercent: posture?.assetEvidencePercent ?? null,
    totalCount: evidenceTotalCount,
    hashedCount: evidenceHashedCount,
    latestEvidenceAt,
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
    failureOf('control-mappings', mappingsCount),
    failureOf('findings', findingEvents),
    failureOf('evidence-latest', latestEvidenceRows),
    failureOf('scan-latest', latestScanRuns),
    failureOf('findings-table', openFindingRows),
  ].filter((item): item is string => item !== null);

  const countsReliable = [
    incidentsCount, dpiasCount, dsrCount, approvalsCount, vendorsCount,
  ].every((result) => result.status === 'fulfilled');

  const scoreBasis = {
    aiSystems: assets.status === 'fulfilled' ? assets.value.filter(isAiSystemAsset).length : null,
    controlMappings: mappingsCount.status === 'fulfilled' ? mappingsCount.value : null,
  };
  const scoreResult = computeGovernanceScoreIfReliable(
    countsReliable, counts, posture, scoreBasis, latestKpi.status === 'fulfilled',
  );

  const signals: DashboardSignals = {
    elevatedAssets: assets.status === 'fulfilled' ? elevatedAssetsOf(assets.value) : null,
    // Beide Befund-Quellen oder keine Aussage: fehlt eine, wäre „keine
    // offenen Befunde“ unbelegt.
    findings: findingEvents.status === 'fulfilled' && openFindingRows.status === 'fulfilled'
      ? mergeFindingSources(findingEvents.value, openFindingRows.value)
      : null,
    // Nur scan_runs: Scanner-/Seed-Events sind kein Beleg für einen Audit-Lauf.
    lastScanAt: val(latestScanRuns, [])[0]?.created_at ?? null,
    latestEvidenceAt,
  };

  return {
    counts, posture,
    score: scoreResult.score,
    scoreStatus: scoreResult.status,
    scoreBasis,
    readiness: computeAuditReadiness(posture),
    readinessTrend, actions,
    lastUpdated: posture ? snap?.captured_date ?? null : null,
    postureStatus,
    evidenceHealth, riskIndex, openMeasures, summary24h,
    recentEvents, riskDistribution, assetFlows,
    partialFailures,
    signals,
  };
}

/**
 * Stabiler, gehashter Datenstand der Prüfer-Mappe. `score_status` geht immer
 * ein, `score` nur bei `ok` — sonst `null`. Nie ein Hash über einen
 * Schein-Score.
 */
export function cockpitIntegrityPayload(data: CockpitData, generatedDate: string) {
  return {
    generated_date: generatedDate,
    score_status: data.scoreStatus,
    score: data.scoreStatus === 'ok' ? data.score : null,
    readiness: data.readiness,
    counts: data.counts,
    posture: data.posture,
    actions: data.actions.map((a) => ({ id: a.id, kind: a.kind, level: a.level, weight: a.weight })),
    last_updated: data.lastUpdated,
    evidence_health: data.evidenceHealth.percent,
    risk_index: data.riskIndex.score,
    open_measures_total: data.openMeasures.total,
  };
}

/** Deterministischer SHA-256-Hex über einen stabilen Cockpit-Snapshot. */
export async function cockpitIntegrityHash(data: CockpitData, generatedDate: string): Promise<string> {
  const json = JSON.stringify(cockpitIntegrityPayload(data, generatedDate));
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
