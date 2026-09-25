// Command Center entry for /app/dashboard.
// Uses ComplianceStatusView (Mandant / Lage / Jetzt). Does not mount
// the agent preview mesh or the build control plane — those live under /app/agents
// and /app/modules.

import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '../../../core/access/TenantProvider';
import { loadCockpitData, type CockpitData } from '../cockpit/cockpitData';
import { TrialBanner } from '../../workspace/TrialBanner';
import { listScanRuns, listWebsitesForTenant } from '../scans/scansApi';
import { loadGovernanceActivation } from '../../activation/activationApi';
import {
  computeWorkspaceBootstrapSteps,
  type ActivationBootstrapStatus,
  type BootstrapStep,
} from './workspaceBootstrapSteps';
import { ComplianceStatusView } from './ComplianceStatusDashboard';
import { DashboardExecuteStrip } from './DashboardExecuteStrip';
import { HandoffOverview } from '../handoff/HandoffOverview';

export function CommandCenterDashboard() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapSteps, setBootstrapSteps] = useState<BootstrapStep[]>([]);
  // „Erneut laden“ im Score-Fehlerzustand: erhöht den Schlüssel und lädt die
  // Cockpit-Daten neu (kein Seiten-Reload).
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setData(null);
      setLoading(false);
      setBootstrapSteps([]);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    loadCockpitData(activeTenantId)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((err) => { if (!cancelled) setError((err as Error)?.message ?? String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setBootstrapSteps([]);
      return;
    }
    void (async () => {
      const [websites, scans, activation] = await Promise.all([
        listWebsitesForTenant(activeTenantId).then((rows) => rows.length).catch(() => null),
        listScanRuns(activeTenantId, { limit: 1 }).then((rows) => rows.length).catch(() => null),
        loadGovernanceActivation(activeTenantId)
          .then((row): ActivationBootstrapStatus => (row?.status ?? 'none'))
          .catch(() => null),
      ]);
      if (cancelled) return;
      setBootstrapSteps(computeWorkspaceBootstrapSteps({
        websiteCount: websites,
        scanCount: scans,
        activationStatus: activation,
      }));
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  return (
    <>
      <TrialBanner />
      {/* Handoff v2 §6: Übersicht im Entwurfsraster — dieselben Cockpit-Daten
          (Score, Maßnahmen, Evidenz) plus Inventar/Policies/Connectoren. */}
      <HandoffOverview
        activeTenantId={activeTenantId}
        data={data}
        loading={loading}
        error={error}
        onRetry={retry}
      />
      <ComplianceStatusView
        tenantName={tenantName}
        activeTenantId={activeTenantId}
        data={data}
        loading={loading}
        error={error}
        bootstrapSteps={bootstrapSteps}
        onRetry={retry}
      />
      {activeTenantId && <DashboardExecuteStrip />}
    </>
  );
}
