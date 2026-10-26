// Command Center entry for /app/dashboard.
// Uses ComplianceStatusView (Mandant / Lage / Jetzt). Does not mount
// the agent preview mesh or the build control plane — those live under /app/agents
// and /app/modules.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../core/access/TenantProvider';
import { useTenantDataVersion } from '../tenantDataEvents';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { getSupabase } from '../../../lib/supabase';
import {
  EMPTY_COMPLIANCE_KPI_ROW,
  loadComplianceKpiRow,
  type ComplianceKpiRow,
} from '../../../lib/status/statusAdapter';
import { loadCockpitData, type CockpitData } from '../cockpit/cockpitData';
import { useTrialStatus } from '../../workspace/TrialBanner';
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
import { decideNavLock } from '../../../components/governance-os/navAccess';
import { navLockTitle } from '../../../components/governance-os/useNavLock';
import { useLang } from '../../../i18n/useLang';
import { tenantDisplayName } from './dashboardSignals';
import { BrowserRuntimePanel } from './BrowserRuntimePanel';
import { OsControlStrip } from './OsControlStrip';
import { CustomerStartPanel } from './CustomerStartPanel';
import { AgentComposer } from './AgentComposer';
import { computeStartPanel } from './startPanelModel';
import './sample-workspace.css';

interface WorkspaceFacts {
  /** Mandant, zu dem die Fakten gehören — Schutz gegen den Wechsel-Frame. */
  tenantId: string | null;
  websiteCount: number | null;
  scanCount: number | null;
  activationStatus: ActivationBootstrapStatus | null;
  lastScanRunAt: string | null;
}

const UNKNOWN_FACTS: WorkspaceFacts = {
  tenantId: null,
  websiteCount: null,
  scanCount: null,
  activationStatus: null,
  lastScanRunAt: null,
};

export function CommandCenterDashboard() {
  const { activeTenantId, tenants, loading: tenantLoading, entitlements, hasFeature } = useTenant();
  const dataVersion = useTenantDataVersion(activeTenantId);
  // Schloss für „Packs →“ aus tenant_entitlements (policy.packs) — dieselbe
  // Quelle wie RouteEntitlementGate und die Sidebar. Plan nur Legacy-Fallback,
  // für /app/policy-packs nicht relevant (Route steht im Register).
  const packsLock = decideNavLock(
    { route: '/app/policy-packs', keys: ['policy.packs'] },
    { loading: tenantLoading, available: entitlements != null, hasFeature },
    null,
  );
  const packsLockTitle = packsLock.locked ? navLockTitle('Policy Packs', packsLock) : null;
  const { lang } = useLang();
  // Live-Plan für den Post-Checkout-Banner (sonst bliebe er ewig „Sync ausstehend“).
  const { tier, loading: entitlementsLoading } = useEntitlements();
  const rawTenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  // DE: „Workspace von …“ statt englischem Genitiv aus dem Signup-Trigger.
  const tenantName = rawTenantName === null ? null : tenantDisplayName(rawTenantName, lang);
  const [data, setData] = useState<CockpitData | null>(null);
  // Zu welchem Mandanten gehören die geladenen Cockpit-Daten? Beim Wechsel
  // rendert React einmal mit neuem activeTenantId, aber noch alten `data` —
  // Effekte laufen erst danach. Ohne diese Zuordnung zeigte die OS-Kachelreihe
  // in diesem einen Frame die Zahlen des vorigen Mandanten unter dem neuen.
  const [dataTenantId, setDataTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapSteps, setBootstrapSteps] = useState<BootstrapStep[]>([]);
  // Dieselben Fakten wie die Bootstrap-Schritte — speisen die Kunden-Startansicht.
  const [facts, setFacts] = useState<WorkspaceFacts>(UNKNOWN_FACTS);
  const trial = useTrialStatus();
  const [complianceKpi, setComplianceKpi] = useState<ComplianceKpiRow>(EMPTY_COMPLIANCE_KPI_ROW);
  // „Erneut laden“: erhöht den Schlüssel und lädt ALLE Dashboard-Quellen neu
  // (Cockpit, KPI-Zeile, Übersicht, Workspace-Schritte) — kein Seiten-Reload.
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setData(null);
      setDataTenantId(null);
      setLoading(false);
      setBootstrapSteps([]);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setDataTenantId(null);
    loadCockpitData(activeTenantId)
      .then((next) => { if (!cancelled) { setData(next); setDataTenantId(activeTenantId); } })
      .catch((err) => { if (!cancelled) setError((err as Error)?.message ?? String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey, dataVersion]);

  // Trend · Findings · Incidents (24h) — eigene Quelle, ein Fehler hier darf
  // den Score nicht blockieren; Fallback bleibt „keine Messung“.
  useEffect(() => {
    let cancelled = false;
    setComplianceKpi(EMPTY_COMPLIANCE_KPI_ROW);
    if (!activeTenantId) return;
    loadComplianceKpiRow(getSupabase(), activeTenantId)
      .then((kpi) => { if (!cancelled) setComplianceKpi(kpi); })
      .catch(() => { /* bleibt EMPTY_COMPLIANCE_KPI_ROW */ });
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey, dataVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setBootstrapSteps([]);
      setFacts(UNKNOWN_FACTS);
      return;
    }
    // Kein Zurücksetzen bei Neuladen/Datenänderung: Die Startansicht soll nicht
    // flackern. Mandantenwechsel deckt `tenantFacts` ab.
    void (async () => {
      const [websites, scans, activation] = await Promise.all([
        listWebsitesForTenant(activeTenantId).then((rows) => rows.length).catch(() => null),
        listScanRuns(activeTenantId, { limit: 1 }).catch(() => null),
        loadGovernanceActivation(activeTenantId)
          .then((row): ActivationBootstrapStatus => (row?.status ?? 'none'))
          .catch(() => null),
      ]);
      if (cancelled) return;
      const next: WorkspaceFacts = {
        tenantId: activeTenantId,
        websiteCount: websites,
        scanCount: scans === null ? null : scans.length,
        activationStatus: activation,
        lastScanRunAt: scans?.[0]?.created_at ?? null,
      };
      setFacts(next);
      setBootstrapSteps(computeWorkspaceBootstrapSteps(next));
    })();
    return () => { cancelled = true; };
  }, [activeTenantId, reloadKey, dataVersion]);

  // Nur Daten des aktiven Mandanten zählen (siehe dataTenantId): Beim Wechsel
  // rendert React einmal mit neuem Mandanten, aber noch alten Fakten.
  const tenantData = dataTenantId === activeTenantId ? data : null;
  const tenantFacts = facts.tenantId === activeTenantId ? facts : UNKNOWN_FACTS;
  const startFacts = useMemo(
    () => ({
      websiteCount: tenantFacts.websiteCount,
      scanCount: tenantFacts.scanCount,
      activationStatus: tenantFacts.activationStatus,
      aiSystemCount: tenantData?.scoreBasis.aiSystems ?? null,
    }),
    [tenantFacts, tenantData],
  );
  const startModel = useMemo(() => computeStartPanel(startFacts), [startFacts]);

  return (
    <>
      {/* Agent zuerst: eine Frage, `@` wählt den Agenten; übergeben wird an
          den Assistenten der Shell (rechts oben ausklappbar). */}
      <AgentComposer />
      {/* Kunden-Startansicht: eine Botschaft, ein nächster Schritt, Fortschritt,
          drei Kernbereiche, Ergebnisse, weitere Module. Testphase/Zahlung
          stehen dort als eine Zeile im Fortschritt (statt TrialBanner). */}
      {activeTenantId && (
        <CustomerStartPanel
          tenantName={tenantName}
          facts={startFacts}
          model={startModel}
          lastScanRunAt={tenantFacts.lastScanRunAt}
          trial={trial}
          data={tenantData}
        />
      )}
      {/* WP-4: Während der Einrichtung zeigt die Beispielansicht, wie das
          Dashboard mit Daten aussieht — ohne Beispieldaten im Mandanten.
          Erst bei einem nachweislich offenen Schritt, sonst blitzte der
          Hinweis bei eingerichteten Workspaces während des Ladens auf. */}
      {activeTenantId && startModel.steps.some((step) => step.state === 'open') && (
        <p className="rs-sample-entry" data-testid="sample-entry">
          So sieht es eingerichtet aus: <Link to="/app/beispiel">Dashboard mit erfundenen Beispieldaten ansehen</Link>
        </p>
      )}
      {/* Detailansicht: das bestehende Cockpit bleibt vollständig erhalten,
          ist aber nachgelagert. Während der Einrichtung zugeklappt — sonst
          dominieren Null- und Leerzustände den ersten Eindruck. */}
      <details
        className="rs-start-details"
        open={!activeTenantId || startModel.complete}
        data-testid="dashboard-details"
      >
        <summary>
          Detailansicht: Cockpit, Kontrollschicht und Betrieb
          <span className="rs-start-details__hint">
            Score-Herleitung, Rahmenwerke, Agenten, Browser-Runtime und Compliance-Lage im Detail.
          </span>
        </summary>
        {/* Handoff v2 §6: Übersicht im Entwurfsraster — dieselben Cockpit-Daten
            (Score, Maßnahmen, Evidenz) plus Inventar/Policies/Connectoren. */}
        <HandoffOverview
          activeTenantId={activeTenantId}
          data={data}
          loading={loading}
          error={error}
          onRetry={retry}
          reloadKey={reloadKey}
        />
        {/* WP4: Kontrollschicht sichtbar machen — KI-Inventar, Bots/Agenten,
            Residualrisiko, Freigaben, Evidence. Liest Risiko und Evidence aus
            denselben Cockpit-Daten wie die Übersicht (kein zweiter RPC).

            Zwei Vorkehrungen gegen falsch zugeordnete Zahlen beim
            Mandantenwechsel: `key` setzt die mandanteneigenen Zähler der Reihe
            synchron zurück (statt erst im Effekt nach dem ersten Render), und
            `data` wird nur durchgegeben, solange es zum aktiven Mandanten
            gehört. Ohne beides zeigte die Reihe in genau einem Frame die Zahlen
            des vorigen Mandanten unter dem neuen. */}
        <OsControlStrip
          key={activeTenantId ?? 'no-tenant'}
          activeTenantId={activeTenantId}
          data={dataTenantId === activeTenantId ? data : null}
          loading={loading}
          error={error}
          reloadKey={reloadKey}
          dataVersion={dataVersion}
        />
        <BrowserRuntimePanel activeTenantId={activeTenantId} />
        <ComplianceStatusView
          tenantName={tenantName}
          activeTenantId={activeTenantId}
          data={data}
          complianceKpi={complianceKpi}
          loading={loading}
          error={error}
          bootstrapSteps={bootstrapSteps}
          livePlanId={tier}
          entitlementsLoading={entitlementsLoading}
          onRetry={retry}
          packsLockTitle={packsLockTitle}
        />
        {activeTenantId && <DashboardExecuteStrip />}
      </details>
    </>
  );
}
