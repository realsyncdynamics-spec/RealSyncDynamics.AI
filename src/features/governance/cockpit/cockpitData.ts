// CEO-Cockpit — gemeinsame Datenbeschaffung für View und Prüfer-Mappe.
//
// Lädt ausschliesslich über bestehende, RLS-gescopte APIs und verdichtet zu
// CockpitData. Resilient (allSettled): ein fehlschlagender Teil leert nicht
// das gesamte Cockpit.
import { countOpenIncidents, fetchTenantIncidents } from '../incidentsApi';
import { countOpenDpias, listDpias } from '../dpiasApi';
import { countOpenDsrs, fetchTenantDsrs } from '../dsrApi';
import { countPendingApprovals } from '../approvalsApi';
import { countVendorsNoDpa } from '../vendorsApi';
import { fetchLatestKpi, fetchKpiRange, snapshotToMetrics, calculateTrend } from '../analytics/analyticsApi';
import {
  computeGovernanceScore, computeAuditReadiness,
  type CockpitCounts, type CockpitPosture,
} from './cockpitScore';
import { prioritizeActions, type PriorityAction } from './prioritizeActions';

export interface CockpitData {
  counts: CockpitCounts;
  posture: CockpitPosture | null;
  score: number;
  readiness: number | null;
  readinessTrend: { direction: 'up' | 'down' | 'flat'; percent: number } | null;
  actions: PriorityAction[];
  lastUpdated: string | null;
}

function val<T>(r: PromiseSettledResult<T>, fb: T): T {
  return r.status === 'fulfilled' ? r.value : fb;
}

export async function loadCockpitData(tenantId: string): Promise<CockpitData> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [
    incidentsCount, dpiasCount, dsrCount, approvalsCount, vendorsCount,
    latestKpi, kpiRange, incidentList, dpiaList, dsrList,
  ] = await Promise.allSettled([
    countOpenIncidents(tenantId),
    countOpenDpias(tenantId),
    countOpenDsrs(tenantId),
    countPendingApprovals(tenantId),
    countVendorsNoDpa(tenantId),
    fetchLatestKpi(tenantId),
    fetchKpiRange(tenantId, since, today),
    fetchTenantIncidents(tenantId),
    listDpias(tenantId),
    fetchTenantDsrs(tenantId),
  ]);

  const counts: CockpitCounts = {
    incidents: val(incidentsCount, 0),
    dpias: val(dpiasCount, 0),
    dsr: val(dsrCount, { total: 0, overdue: 0 }),
    approvals: val(approvalsCount, 0),
    vendorsNoDpa: val(vendorsCount, 0),
  };

  const metrics = snapshotToMetrics(val(latestKpi, null));
  const posture: CockpitPosture | null = metrics
    ? {
        policiesEnabledPercent: metrics.policiesEnabledPercent,
        assetEvidencePercent: metrics.assetEvidencePercent,
        assetMappingsPercent: metrics.assetMappingsPercent,
      }
    : null;

  const range = val(kpiRange, []);
  let readinessTrend: CockpitData['readinessTrend'] = null;
  if (range.length >= 2) {
    const first = range[0];
    const last = range[range.length - 1];
    const t = calculateTrend(last.assets_with_mappings_percent, first.assets_with_mappings_percent);
    readinessTrend = { direction: t.direction, percent: Math.abs(t.percent) };
  }

  const actions = prioritizeActions({
    incidents: val(incidentList, []),
    dpias: val(dpiaList, { ok: false } as Awaited<ReturnType<typeof listDpias>>).dpias ?? [],
    dsrs: val(dsrList, []),
  });

  return {
    counts, posture,
    score: computeGovernanceScore(counts, posture),
    readiness: computeAuditReadiness(posture),
    readinessTrend, actions,
    lastUpdated: metrics?.lastUpdated ?? null,
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
  };
  const json = JSON.stringify(stable);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
