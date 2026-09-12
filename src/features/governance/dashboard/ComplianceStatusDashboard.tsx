// ComplianceStatusDashboard — kanonische /app/dashboard-Fläche.
//
// Governance Command Center: KPI-Strip, Runtime-Stream, Risk-Distribution,
// Asset-/KI-Flows, Policy Coverage, rechte Alert-/Task-Rail und Framework-Strip.
// Daten aus denselben RLS-Quellen wie das CEO-Cockpit. Keine Mock-Fallbacks.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, Bot, Clock, ChevronRight, FileCheck2, Globe2, LayoutTemplate, Loader2,
  Minus, Radar, Rocket, ShieldCheck, Sparkles, TrendingDown, TrendingUp,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { ScoreGauge } from '../../../enterprise-os/components/ScoreGauge';
import { Button } from '../../../enterprise-os/components/Button';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import type { ScoreLevel } from '../cockpit/cockpitScore';
import { scoreLabel, scoreLevel } from '../cockpit/cockpitScore';
import { loadCockpitData, type CockpitData, type CockpitRuntimeEvent } from '../cockpit/cockpitData';
import { TrialBanner } from '../../workspace/TrialBanner';
import {
  HIGH_RISK_ASSET_THRESHOLD,
  type AssetFlowItem,
  type EvidenceHealth,
  type OpenMeasures,
  type RiskBucket,
  type RiskBucketId,
  type RiskIndex,
} from './complianceStatus';
import { AgentOsPanel } from '../agent-os/AgentOsPanel';

export function ComplianceStatusDashboard() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setData(null);
      setLoading(false);
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
  }, [activeTenantId]);

  return (
    <>
      <TrialBanner />
      {activeTenantId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <AgentOsPanel />
          <DashboardControlPlane />
        </div>
      )}
      <ComplianceStatusView
        tenantName={tenantName}
        activeTenantId={activeTenantId}
        data={data}
        loading={loading}
        error={error}
      />
    </>
  );
}

function DashboardControlPlane() {
  const tools = [
    { href: '/app/bots', label: 'AI Agents & Bots', text: 'Bots anlegen, Kanäle und Fähigkeiten verwalten.', icon: Bot, accent: 'text-cyan-300' },
    { href: '/app/agents', label: 'Agent Runtime', text: 'Enterprise-Agenten starten und Runs überwachen.', icon: Sparkles, accent: 'text-violet-300' },
    { href: '/build', label: 'Frontend & Landing Builder', text: 'Prompt → Website → Vorschau mit SiteOS.', icon: LayoutTemplate, accent: 'text-sky-300' },
    { href: '/app/siteos/builder', label: 'Web App Builder', text: 'SiteOS-Workspace für bestehende Projekte öffnen.', icon: Globe2, accent: 'text-emerald-300' },
  ];

  return (
    <section aria-label="Build and Agent Control Plane" data-testid="dashboard-control-plane" className="mt-4 rounded-2xl border border-titanium-800 bg-obsidian-900/90 overflow-hidden">
      <div className="px-5 py-4 border-b border-titanium-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e4cfa2]">Operate · Build · Automate</p>
          <h2 className="mt-1 text-base font-semibold text-titanium-50">AI Control Plane</h2>
          <p className="mt-1 text-xs text-titanium-400">Direkter Zugriff auf Bots, Agenten und die produktiven SiteOS-Build-Flows.</p>
        </div>
        <Link to="/app/overview" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-titanium-50">Alle Module →</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-titanium-900">
        {tools.map(({ href, label, text, icon: Icon, accent }) => (
          <Link key={href} to={href} className="group bg-obsidian-900 px-5 py-4 hover:bg-obsidian-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e4cfa2]">
            <div className="flex items-center justify-between gap-3">
              <Icon className={`h-5 w-5 ${accent}`} />
              <ArrowRight className="h-4 w-4 text-titanium-600 group-hover:text-[#e4cfa2] transition-colors" />
            </div>
            <p className="mt-4 text-sm font-semibold text-titanium-50">{label}</p>
            <p className="mt-1 text-xs leading-5 text-titanium-400">{text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export interface ComplianceStatusViewProps {
  tenantName: string | null;
  activeTenantId: string | null;
  data: CockpitData | null;
  loading: boolean;
  error: string | null;
}

export function ComplianceStatusView({
  tenantName,
  activeTenantId,
  data,
  loading,
  error,
}: ComplianceStatusViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postCheckoutPlan = searchParams.get('plan');
  const postCheckoutSub = searchParams.get('subscription');
  const showPostCheckout = Boolean(postCheckoutPlan || postCheckoutSub);
  const isEmptyTenant = Boolean(
    data &&
    data.partialFailures.length === 0 &&
    data.openMeasures.total === 0 &&
    data.actions.length === 0 &&
    data.evidenceHealth.percent === null &&
    data.riskIndex.score === null &&
    data.readiness === null,
  );

  return (
    <div
      data-testid="compliance-status-dashboard"
      className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-titanium-900 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#e4cfa2] flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e4cfa2] animate-pulse" aria-hidden />
            Governance Command Center
          </p>
          <h1 className="font-display font-bold text-titanium-50 tracking-tight mt-1 text-[clamp(1.25rem,1rem+1.2vw,1.75rem)]">
            {tenantName ? `Status · ${tenantName}` : 'Compliance-Status'}
          </h1>
          <p className="text-sm text-titanium-400 mt-1">
            Score, Residualrisiko, Evidence und Audit-Readiness — aus Ihren Mandantendaten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTenantId && (
            <Link to="/app/cockpit/brief">
              <Button variant="secondary" size="md">
                <FileCheck2 className="h-4 w-4" /> Prüfer-Mappe
              </Button>
            </Link>
          )}
          <Link to="/app/assistant">
            <Button variant="primary" size="md">
              Governance AI
            </Button>
          </Link>
        </div>
      </div>

      {showPostCheckout && activeTenantId && (
        <div
          className="border border-[#e4cfa2]/25 bg-[#e4cfa2]/5 p-5 space-y-3"
          data-testid="post-checkout-domain-cta"
        >
          <div className="flex items-start gap-3">
            <Globe2 className="h-5 w-5 text-[#e4cfa2] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-titanium-50">
                Abo aktiv{postCheckoutPlan ? ` · ${postCheckoutPlan}` : ''}
              </h2>
              <p className="text-sm text-titanium-300 mt-1">
                Nächster Schritt: Kunden-Domain unter Websites verbinden.
                Custom-DNS ist Preview, bis Cloudflare/Vault live ist — kein Fake-„active“.
              </p>
              {postCheckoutSub && (
                <p className="mt-2 font-mono text-[10px] text-titanium-600">
                  subscription={postCheckoutSub}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/websites')}
            className="inline-flex items-center justify-center gap-2 bg-[#e8ddc8] hover:bg-[#f0e6d4] text-obsidian-950 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
          >
            Domain verbinden <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {!activeTenantId && (
        <div className="py-12 text-center text-titanium-400">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-titanium-600" />
          <p className="text-sm">Workspace fehlt oder wird noch geladen.</p>
          <p className="mt-1 text-xs text-titanium-500">
            Ohne Tenant können keine Compliance-Daten geladen werden.
          </p>
          <Link
            to="/welcome?next=/app/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-[#e4cfa2] text-sm font-semibold"
          >
            Workspace einrichten <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {data && data.partialFailures.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3" data-testid="compliance-partial-failure">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Teil der Governance-Daten nicht verfügbar. Das ist kein leerer Mandant.
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-titanium-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Compliance-Status wird geladen …
        </div>
      )}

      {isEmptyTenant && (
        <div className="border border-titanium-800 bg-obsidian-900 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <Rocket className="h-6 w-6 text-[#e4cfa2] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-titanium-50">Noch keine Governance-Daten</h2>
              <p className="text-sm text-titanium-300 mt-1">
                Score und Ampeln bleiben leer, solange keine Assets, Evidence oder offenen Pflichten vorliegen.
                Starten Sie mit Onboarding oder einem Website-Audit.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/onboarding')}
              className="inline-flex items-center justify-center gap-2 bg-[#e8ddc8] hover:bg-[#f0e6d4] text-obsidian-950 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
            >
              Onboarding starten
            </button>
            <button
              type="button"
              onClick={() => navigate('/audit?source=dashboard')}
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-200 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
            >
              Website-Audit
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/websites')}
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-200 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
            >
              Domain verbinden
            </button>
          </div>
        </div>
      )}

      {data && !isEmptyTenant && (
        <>
          {/* Zone 1 — Top KPI strip */}
          <section aria-label="KPI-Strip">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900">
              <ScoreCard
                testId="governance-score"
                eyebrow="Governance-Score"
                score={data.score}
                hint="Self-Assessment aus offenen Pflichten und KPI-Abdeckung. Keine Zertifizierung."
              />
              <RiskCard risk={data.riskIndex} />
              <EvidenceCard health={data.evidenceHealth} />
              <ReadinessCard readiness={data.readiness} trend={data.readinessTrend} />
            </div>
          </section>

          {/* Zones 2–4 — Main canvas + right rail */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8 space-y-5">
              {/* Zone 2 — Runtime Event Stream + Risk Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <EventStreamPanel
                  events={data.recentEvents}
                  eventsFailed={data.partialFailures.some((f) => f.startsWith('events:'))}
                />
                <RiskDistributionPanel
                  buckets={data.riskDistribution}
                  assetCount={data.riskIndex.assetCount}
                  assetsFailed={data.partialFailures.some((f) => f.startsWith('assets:'))}
                />
              </div>

              {/* Zone 3 — Asset / KI flows + Policy Coverage */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <AssetFlowsPanel
                  flows={data.assetFlows}
                  assetsFailed={data.partialFailures.some((f) => f.startsWith('assets:'))}
                />
                <PolicyCoveragePanel posture={data.posture} />
              </div>

              {data.summary24h && (
                <section data-testid="summary-24h">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-[#e4cfa2]" />
                    <h2 className="font-display font-semibold text-titanium-50 text-sm">Letzte 24 Stunden</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900 border border-titanium-900">
                    <MiniStat label="Neue Risiken" value={data.summary24h.new_risks} href="/app/risks" danger={data.summary24h.new_risks > 0} />
                    <MiniStat label="Neue Evidence" value={data.summary24h.new_evidence} href="/app/evidence" />
                    <MiniStat label="Offene Alerts" value={data.summary24h.open_alerts} href="/app/alerts" danger={data.summary24h.critical_alerts > 0} />
                    <MiniStat label="Fehler-Scans" value={data.summary24h.failed_scans} href="/app/monitoring" danger={data.summary24h.failed_scans > 0} />
                  </div>
                </section>
              )}

              <OpenMeasuresCard measures={data.openMeasures} />
            </div>

            {/* Zone 4 — Right rail: Critical Findings / Alerts / Tasks */}
            <aside className="xl:col-span-4 space-y-5" aria-label="Findings und Aufgaben">
              <CriticalFindingsRail actions={data.actions} summary={data.summary24h} />
            </aside>
          </div>

          {/* Zone 5 — Framework strip */}
          <FrameworkStrip />

          <p className="text-[11px] text-titanium-600 font-mono">
            {data.lastUpdated
              ? `KPI-Stand: ${data.lastUpdated}`
              : 'KPI-Snapshot noch nicht verfügbar — Score aus Echtzeit-Zählern.'}
            {' · '}
            <Link to="/app/home" className="hover:text-titanium-300 underline">Workspace</Link>
            {' · '}
            <Link to="/app/overview" className="hover:text-titanium-300 underline">Module</Link>
          </p>
        </>
      )}
    </div>
  );
}

/* ─── Zone panels ───────────────────────────────────────────────────────── */

function EventStreamPanel({
  events,
  eventsFailed,
}: {
  events: CockpitRuntimeEvent[];
  eventsFailed: boolean;
}) {
  return (
    <Card data-testid="runtime-event-stream" className="bg-obsidian-900/80">
      <CardHeader
        eyebrow="Runtime"
        title="Event-Stream"
        subtitle="Neueste Governance-Events aus dem Mandanten."
        action={(
          <Link to="/app/monitoring" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-[#e4cfa2]">
            Monitoring →
          </Link>
        )}
      />
      <CardBody className="p-0">
        {eventsFailed ? (
          <EmptyPanel caption="Event-Stream vorübergehend nicht verfügbar." />
        ) : events.length === 0 ? (
          <EmptyPanel caption="Keine Runtime-Events vorhanden." />
        ) : (
          <ul className="divide-y divide-titanium-900 max-h-72 overflow-y-auto">
            {events.map((event) => (
              <li key={event.id} className="px-5 py-3 flex items-start gap-3">
                <Activity className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${riskLevelColor(event.riskLevel)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-titanium-100 truncate">{event.title}</p>
                  <p className="text-[10px] font-mono text-titanium-500 mt-0.5 truncate">
                    {event.eventType}
                    {' · '}
                    {event.source}
                    {' · '}
                    {formatRelativeTime(event.createdAt)}
                  </p>
                </div>
                <span className={`font-mono text-[9px] uppercase tracking-wider shrink-0 ${riskLevelColor(event.riskLevel)}`}>
                  {event.riskLevel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function RiskDistributionPanel({
  buckets,
  assetCount,
  assetsFailed,
}: {
  buckets: RiskBucket[];
  assetCount: number;
  assetsFailed: boolean;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card data-testid="risk-distribution" className="bg-obsidian-900/80">
      <CardHeader
        eyebrow="Residualrisiko"
        title="Risk Distribution"
        subtitle={assetsFailed
          ? 'Asset-Scores nicht verfügbar.'
          : assetCount === 0
            ? 'Noch keine Assets mit Risk-Score.'
            : `${assetCount} Assets nach Risk-Score.`}
        action={(
          <Link to="/app/risks" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-[#e4cfa2]">
            Risiken →
          </Link>
        )}
      />
      <CardBody>
        {assetsFailed || assetCount === 0 ? (
          <EmptyPanel caption={assetsFailed ? 'Verteilung nicht ladbar.' : 'Keine Verteilung — Preview wenn Assets erfasst sind.'} />
        ) : (
          <ul className="space-y-2.5">
            {buckets.map((bucket) => (
              <li key={bucket.id} className="flex items-center gap-3">
                <span className="w-16 font-mono text-[10px] uppercase tracking-wider text-titanium-500 shrink-0">
                  {bucket.label}
                </span>
                <div className="flex-1 h-2 bg-titanium-900">
                  <div
                    className={`h-full transition-all duration-500 ${bucketBarColor(bucket.id)}`}
                    style={{ width: `${Math.round((bucket.count / max) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-sm tabular-nums text-titanium-100 w-6 text-right">{bucket.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function AssetFlowsPanel({
  flows,
  assetsFailed,
}: {
  flows: AssetFlowItem[];
  assetsFailed: boolean;
}) {
  return (
    <Card data-testid="asset-flows" className="bg-obsidian-900/80">
      <CardHeader
        eyebrow="Register"
        title="Asset- & KI-Flows"
        subtitle="Erfasste Systeme nach Typ — echte Registerzählung."
      />
      <CardBody className="p-0">
        {assetsFailed ? (
          <EmptyPanel caption="Asset-Flows vorübergehend nicht verfügbar." />
        ) : flows.length === 0 ? (
          <EmptyPanel caption="Keine Assets erfasst. Coming Soon: Live-Flows nach Onboarding." />
        ) : (
          <ul className="divide-y divide-titanium-900">
            {flows.map((flow) => (
              <li key={flow.type}>
                <Link
                  to={flow.href}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-obsidian-800 transition-colors"
                >
                  <Radar className="h-3.5 w-3.5 text-[#e4cfa2] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-titanium-50">{flow.label}</p>
                    <p className="text-[10px] font-mono text-titanium-500 mt-0.5">
                      {flow.count} erfasst
                      {flow.highRisk > 0 ? ` · ${flow.highRisk} ≥ ${HIGH_RISK_ASSET_THRESHOLD}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-lg font-bold text-titanium-100 tabular-nums">{flow.count}</span>
                  <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function PolicyCoveragePanel({ posture }: { posture: CockpitData['posture'] }) {
  return (
    <Card data-testid="policy-coverage" className="bg-obsidian-900/80">
      <CardHeader
        eyebrow="Abdeckung"
        title="Policy Coverage"
        subtitle="Aus dem letzten KPI-Snapshot — keine Schätzung."
        action={(
          <Link to="/app/policy-packs" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-[#e4cfa2]">
            Packs →
          </Link>
        )}
      />
      <CardBody className="space-y-3">
        {!posture ? (
          <EmptyPanel caption="KPI-Snapshot fehlt — Coverage erscheint nach dem nächsten Snapshot." />
        ) : (
          <>
            <CoverageRow label="Richtlinien aktiv" percent={posture.policiesEnabledPercent} />
            <CoverageRow label="Evidence-Abdeckung" percent={posture.assetEvidencePercent} />
            <CoverageRow label="Kontroll-Mapping" percent={posture.assetMappingsPercent} />
          </>
        )}
      </CardBody>
    </Card>
  );
}

function CriticalFindingsRail({
  actions,
  summary,
}: {
  actions: CockpitData['actions'];
  summary: CockpitData['summary24h'];
}) {
  const critical = actions.filter((a) => a.level === 'critical' || a.level === 'high');

  return (
    <>
      <Card data-testid="critical-findings" className="bg-obsidian-900/80">
        <CardHeader
          eyebrow="Findings"
          title="Kritische Befunde"
          subtitle="Priorisierte Pflichten aus Incidents, DSFA und DSR."
        />
        <CardBody className="p-0">
          {critical.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-titanium-400" data-testid="no-critical-findings">
              <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-emerald-400" />
              Keine kritischen oder hohen Befunde offen.
            </div>
          ) : (
            <ul className="divide-y divide-titanium-900" data-testid="critical-findings-list">
              {critical.slice(0, 6).map((action) => (
                <li key={action.id}>
                  <Link
                    to={action.href}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-obsidian-800 transition-colors"
                  >
                    <StatusBadge level={action.level} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-titanium-50 truncate">{action.title}</p>
                      <p className="text-xs text-titanium-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3" /> {action.detail}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0 mt-1" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card data-testid="alerts-rail" className="bg-obsidian-900/80">
        <CardHeader
          eyebrow="Alerts"
          title="Offene Alerts"
          subtitle={summary ? 'Aus dem 24h-Summary.' : '24h-Summary noch nicht verfügbar.'}
          action={(
            <Link to="/app/alerts" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-[#e4cfa2]">
              Alle →
            </Link>
          )}
        />
        <CardBody>
          {!summary ? (
            <EmptyPanel caption="Alert-Zähler erscheinen, sobald das 24h-Summary geliefert wird." />
          ) : (
            <div className="grid grid-cols-2 gap-px bg-titanium-900 border border-titanium-900">
              <AlertStat label="Offen" value={summary.open_alerts} danger={summary.open_alerts > 0} />
              <AlertStat label="Kritisch" value={summary.critical_alerts} danger={summary.critical_alerts > 0} />
              <AlertStat label="Neu / 24h" value={summary.new_alerts_24h} />
              <AlertStat label="Scan-Fehler" value={summary.failed_scans} danger={summary.failed_scans > 0} />
            </div>
          )}
        </CardBody>
      </Card>

      <Card data-testid="tasks-rail" className="bg-obsidian-900/80">
        <CardHeader
          eyebrow="Aufgaben"
          title="Nächste Schritte"
          subtitle="Nach Schweregrad und Fristnähe."
        />
        <CardBody className="p-0">
          {actions.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-titanium-400" data-testid="no-open-actions">
              <ShieldCheck className="h-5 w-5 mx-auto mb-2 text-emerald-400" />
              Keine dringenden Pflichten offen.
            </div>
          ) : (
            <ul className="divide-y divide-titanium-900" data-testid="priority-actions">
              {actions.slice(0, 8).map((action, index) => (
                <li key={action.id}>
                  <Link
                    to={action.href}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-obsidian-800 transition-colors"
                  >
                    <span className="font-mono text-xs text-titanium-600 w-4 shrink-0">{index + 1}</span>
                    <StatusBadge level={action.level} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-titanium-50 truncate">{action.title}</p>
                      <p className="text-xs text-titanium-400 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3" /> {action.detail}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

type FrameworkMaturity = 'live' | 'beta' | 'roadmap';

const FRAMEWORK_STRIP: Array<{
  id: string;
  label: string;
  path: string | null;
  maturity: FrameworkMaturity;
}> = [
  { id: 'dsgvo', label: 'DSGVO', path: '/app/governance/dsgvo-directory', maturity: 'live' },
  { id: 'eu-ai-act', label: 'EU AI Act', path: '/app/governance/ai-act-assessment', maturity: 'beta' },
  { id: 'iso', label: 'ISO', path: '/app/governance/iso27001', maturity: 'beta' },
  { id: 'nis2', label: 'NIS2', path: '/app/governance/nis2-incidents', maturity: 'beta' },
  { id: 'tisax', label: 'TISAX', path: '/app/policy-packs', maturity: 'roadmap' },
  { id: 'dora', label: 'DORA', path: null, maturity: 'roadmap' },
];

const MATURITY_STYLE: Record<FrameworkMaturity, string> = {
  live: 'text-emerald-400 border-emerald-900/60 bg-emerald-950/40',
  beta: 'text-amber-400 border-amber-900/60 bg-amber-950/40',
  roadmap: 'text-titanium-500 border-titanium-800 bg-obsidian-950',
};

const MATURITY_LABEL: Record<FrameworkMaturity, string> = {
  live: 'Live',
  beta: 'Beta',
  roadmap: 'Roadmap',
};

function FrameworkStrip() {
  return (
    <section data-testid="framework-strip" aria-label="Compliance-Frameworks">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-[#e4cfa2]" />
        <h2 className="font-display font-semibold text-titanium-50 text-sm">Frameworks</h2>
        <div className="flex-1 h-px bg-titanium-900" />
        <Link to="/app/governance/frameworks" className="text-[10px] font-mono uppercase tracking-wider text-[#e4cfa2] hover:text-[#e4cfa2]">
          Übersicht →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-titanium-900 border border-titanium-900">
        {FRAMEWORK_STRIP.map((fw) => {
          const inner = (
            <div className="bg-obsidian-900 px-3 py-3.5 h-full flex flex-col gap-2 hover:bg-obsidian-800 transition-colors">
              <span className="font-mono text-sm font-bold text-titanium-50 tracking-wide">{fw.label}</span>
              <span className={`inline-flex self-start border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${MATURITY_STYLE[fw.maturity]}`}>
                {MATURITY_LABEL[fw.maturity]}
              </span>
            </div>
          );
          if (!fw.path) {
            return (
              <div key={fw.id} className="opacity-70 cursor-default" title="Noch ohne eigene Route">
                {inner}
              </div>
            );
          }
          return (
            <Link key={fw.id} to={fw.path} className="block">
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ─── KPI cards (preserved) ─────────────────────────────────────────────── */

function ScoreCard({
  testId,
  eyebrow,
  score,
  hint,
}: {
  testId: string;
  eyebrow: string;
  score: number | null;
  hint: string;
}) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6 border-0" data-testid={testId}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">{eyebrow}</p>
      {score === null ? (
        <EmptyMetric value="–" caption="Score nicht verfügbar" />
      ) : (
        <>
          <ScoreGauge score={score} size={112} tone="health" />
          <StatusBadge level={scoreLevel(score)} label={scoreLabel(score)} />
        </>
      )}
      <p className="px-4 text-center text-[11px] text-titanium-500">{hint}</p>
    </Card>
  );
}

function RiskCard({ risk }: { risk: RiskIndex }) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6 border-0" data-testid="risk-index">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Residualrisiko</p>
      {risk.score === null ? (
        <EmptyMetric value="–" caption={risk.label} />
      ) : (
        <>
          <ScoreGauge score={risk.score} size={112} tone="risk" label="Risiko-Index" />
          <LevelBadge level={risk.level} label={risk.label} />
        </>
      )}
      <p className="px-4 text-center text-[11px] text-titanium-500 font-mono">
        {risk.assetCount} Assets · {risk.highRiskAssets} ≥ {HIGH_RISK_ASSET_THRESHOLD}
        {risk.newRisks24h > 0 ? ` · +${risk.newRisks24h} / 24h` : ''}
      </p>
    </Card>
  );
}

function EvidenceCard({ health }: { health: EvidenceHealth }) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6 border-0" data-testid="evidence-health">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Evidence-Gesundheit</p>
      {health.percent === null ? (
        <EmptyMetric value="–" caption={health.label} />
      ) : (
        <>
          <ScoreGauge score={health.percent} size={112} tone="health" label="Health" />
          <LevelBadge level={health.level} label={health.label} />
        </>
      )}
      <p className="px-4 text-center text-[11px] text-titanium-500 font-mono">
        {health.hashedCount}/{health.totalCount} gehasht
        {health.failedScans > 0 ? ` · ${health.failedScans} Scan-Fehler` : ''}
      </p>
    </Card>
  );
}

function ReadinessCard({
  readiness,
  trend,
}: {
  readiness: number | null;
  trend: CockpitData['readinessTrend'];
}) {
  return (
    <Card className="bg-obsidian-900 border-0" data-testid="audit-readiness">
      <CardBody className="flex flex-col justify-center h-full gap-3 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Audit-Readiness</p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-5xl font-bold text-titanium-50">
            {readiness === null ? '–' : `${readiness}%`}
          </span>
          {trend && <TrendChip {...trend} />}
        </div>
        <p className="text-xs text-titanium-400">
          Anteil der Objekte mit Kontroll-Mapping. Indikativ, keine Bescheinigung.
        </p>
      </CardBody>
    </Card>
  );
}

function OpenMeasuresCard({ measures }: { measures: OpenMeasures }) {
  return (
    <Card data-testid="open-measures">
      <CardHeader
        eyebrow="Offene Maßnahmen"
        title={`${measures.total} offene Posten`}
        subtitle="Zähler aus Incidents, DSFA, DSR, Freigaben und Vendoren ohne AVV."
      />
      <CardBody className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-titanium-800">
          <MeasureLink href="/app/incidents" label="Vorfälle" value={measures.incidents} danger={measures.incidents > 0} />
          <MeasureLink href="/app/dsr" label="DSR überfällig" value={measures.dsrOverdue} danger={measures.dsrOverdue > 0} />
          <MeasureLink href="/app/dpia" label="Offene DSFA" value={measures.dpias} />
          <MeasureLink href="/app/approvals" label="Freigaben" value={measures.approvals} />
          <MeasureLink href="/app/vendors" label="Ohne AVV" value={measures.vendorsNoDpa} danger={measures.vendorsNoDpa > 0} />
          <MeasureLink href="/app/dsr" label="DSR offen" value={measures.dsrOpen} />
        </div>
      </CardBody>
    </Card>
  );
}

function MeasureLink({
  href, label, value, danger = false,
}: {
  href: string;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Link to={href} className="px-4 py-4 hover:bg-obsidian-800 transition-colors block">
      <p className={`font-mono text-2xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </Link>
  );
}

function MiniStat({
  label, value, href, danger = false,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link to={href} className="bg-obsidian-900 px-4 py-3 hover:bg-obsidian-800 transition-colors block">
      <p className={`font-mono text-xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </Link>
  );
}

function AlertStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-obsidian-900 px-3 py-3">
      <p className={`font-mono text-xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </div>
  );
}

function CoverageRow({ label, percent }: { label: string; percent: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono">{label}</p>
        <span className="font-mono text-sm font-bold text-titanium-50">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-titanium-900 w-full">
        <div className="h-full bg-[#e4cfa2] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendChip({ direction, percent }: { direction: 'up' | 'down' | 'flat'; percent: number }) {
  if (direction === 'flat' || percent === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-titanium-500"><Minus className="h-3 w-3" /> stabil</span>;
  }
  const up = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${up ? 'text-emerald-400' : 'text-orange-400'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {percent}%
    </span>
  );
}

function EmptyMetric({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-5xl font-bold text-titanium-600">{value}</p>
      <p className="mt-2 text-xs text-titanium-400">{caption}</p>
    </div>
  );
}

function EmptyPanel({ caption }: { caption: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-titanium-400">
      {caption}
    </div>
  );
}

function LevelBadge({ level, label }: { level: ScoreLevel | 'unknown'; label: string }) {
  if (level === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-titanium-700 bg-titanium-900/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-titanium-400">
        {label}
      </span>
    );
  }
  return <StatusBadge level={level} label={label} />;
}

function bucketBarColor(id: RiskBucketId): string {
  switch (id) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-sky-500';
    case 'passed': return 'bg-emerald-500';
  }
}

function riskLevelColor(level: string): string {
  switch (level) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-amber-400';
    case 'low': return 'text-sky-400';
    default: return 'text-titanium-400';
  }
}

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const deltaSec = Math.round((Date.now() - ts) / 1000);
  if (deltaSec < 60) return 'gerade eben';
  if (deltaSec < 3600) return `vor ${Math.floor(deltaSec / 60)} Min.`;
  if (deltaSec < 86400) return `vor ${Math.floor(deltaSec / 3600)} Std.`;
  return `vor ${Math.floor(deltaSec / 86400)} Tag(en)`;
}
