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
import type { DbGovernanceKpiSnapshot } from '../analytics/types';
import {
  computeGovernanceScore, computeAuditReadiness,
  type CockpitCounts, type CockpitPosture,
} from './cockpitScore';
import { prioritizeActions, type PriorityAction } from './prioritizeActions';

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
    fetchLatestKpiSnapshot(tenantId),
    fetchKpiSnapshotRange(tenantId, since, today),
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

  return {
    counts, posture,
    score: computeGovernanceScore(counts, posture),
    readiness: computeAuditReadiness(posture),
    readinessTrend, actions,
    lastUpdated: snap?.captured_date ?? null,
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
