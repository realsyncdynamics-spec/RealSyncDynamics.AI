import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, AlertTriangle, ShieldCheck, Database,
  Bot, FileCheck2, Lock, Loader2, KeyRound, GitBranch, Plus, Archive, Webhook, Network, Gavel, ScrollText, Library, FileDown, UserCheck, ShieldAlert, Plug, Building2, DollarSign, Wrench,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantEvents, fetchTenantAssets, fetchTenantPolicies,
  fetchFrameworkControls,
  type DbGovernanceEvent, type DbGovernanceAsset, type DbGovernancePolicy,
  type DbFrameworkControl,
} from './governanceApi';
import { archiveAsset, togglePolicy } from './resourcesApi';
import { CreateAssetModal, CreatePolicyModal } from './GovernanceResourceModals';
import { GovernanceTrendsPanel } from './GovernanceTrendsPanel';
import { countPendingApprovals } from './approvalsApi';
import { countOpenDpias } from './dpiasApi';
import { countOpenDsrs } from './dsrApi';
import { countOpenIncidents } from './incidentsApi';
import { EnvironmentSwitcher, EnvironmentBanner } from './EnvironmentSwitcher';
import { AgentWidget } from './AgentWidget/AgentWidget';
import type { GovernanceRiskLevel } from './types';

/**
 * Authenticated, tenant-scoped Governance Dashboard.
 *
 * Counterpart to the public demo at `/governance-runtime`. Reads the
 * caller tenant's real `governance_*` rows directly from Supabase
 * (RLS gates by membership). If the tenant has no rows yet, an
 * onboarding panel points at /governance/keys to mint an API key.
 */
export function GovernanceDashboardView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [events, setEvents]     = useState<DbGovernanceEvent[] | null>(null);
  const [assets, setAssets]     = useState<DbGovernanceAsset[] | null>(null);
  const [policies, setPolicies] = useState<DbGovernancePolicy[] | null>(null);
  const [controls, setControls] = useState<DbFrameworkControl[] | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openDpias, setOpenDpias] = useState(0);
  const [openDsrs, setOpenDsrs] = useState({ total: 0, overdue: 0 });
  const [openIncidents, setOpenIncidents] = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const [creatingAsset, setCreatingAsset]   = useState(false);
  const [creatingPolicy, setCreatingPolicy] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    setEvents(null); setAssets(null); setPolicies(null); setControls(null);
    Promise.all([
      fetchTenantEvents(activeTenantId),
      fetchTenantAssets(activeTenantId),
      fetchTenantPolicies(activeTenantId),
      fetchFrameworkControls(),
      countPendingApprovals(activeTenantId),
      countOpenDpias(activeTenantId),
      countOpenDsrs(activeTenantId),
      countOpenIncidents(activeTenantId),
    ])
      .then(([e, a, p, c, pa, od, ds, oi]) => {
        setEvents(e); setAssets(a); setPolicies(p); setControls(c);
        setPendingApprovals(pa); setOpenDpias(od); setOpenDsrs(ds); setOpenIncidents(oi);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTenantId]);

  const empty =
    activeTenantId &&
    events !== null && assets !== null && policies !== null &&
    events.length === 0 && assets.length === 0 && policies.length === 0;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Runtime</div>
              <div className="text-[11px] text-titanium-400 font-medium">Echtzeit-Telemetrie · Policy-Decisions · Evidence</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
          <EnvironmentSwitcher />
          <button
            onClick={() => setCreatingAsset(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Asset
          </button>
          <button
            onClick={() => setCreatingPolicy(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Policy
          </button>
          <Link
            to="/governance/policies/templates"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <Library className="h-4 w-4" /> Templates
          </Link>
          <Link
            to="/governance/keys"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <KeyRound className="h-4 w-4" /> Keys
          </Link>
          <Link
            to="/governance/approvals"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors relative"
          >
            <Gavel className="h-4 w-4" /> Approvals
            {pendingApprovals > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-amber-500 text-obsidian-950 text-[10px] font-bold rounded-none">
                {pendingApprovals}
              </span>
            )}
          </Link>
          <Link
            to="/governance/dpias"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors relative"
          >
            <FileCheck2 className="h-4 w-4" /> DPIAs
            {openDpias > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-amber-500 text-obsidian-950 text-[10px] font-bold rounded-none">{openDpias}</span>
            )}
          </Link>
          <Link
            to="/governance/dsr"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors relative"
          >
            <UserCheck className="h-4 w-4" /> DSR
            {openDsrs.overdue > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-none">{openDsrs.overdue}</span>
            )}
          </Link>
          <Link
            to="/governance/incidents"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors relative"
          >
            <ShieldAlert className="h-4 w-4" /> Incidents
            {openIncidents > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-none">{openIncidents}</span>
            )}
          </Link>
          <Link to="/governance/vendors" className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors">
            <Building2 className="h-4 w-4" /> Vendors
          </Link>
          <Link to="/governance/connectors" className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors">
            <Plug className="h-4 w-4" /> Connectors
          </Link>
          <Link to="/governance/costs" className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors">
            <DollarSign className="h-4 w-4" /> Costs
          </Link>
          <Link to="/governance/remediation" className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors">
            <Wrench className="h-4 w-4" /> Remediation
          </Link>
          <Link
            to="/governance/mappings"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <Network className="h-4 w-4" /> Matrix
          </Link>
          <Link
            to="/governance/admin-log"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <ScrollText className="h-4 w-4" /> Log
          </Link>
          <Link
            to="/governance/reports"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <FileDown className="h-4 w-4" /> Report
          </Link>
          <Link
            to="/governance/webhooks"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <Webhook className="h-4 w-4" /> Webhooks
          </Link>
        </div>
      </header>
      <EnvironmentBanner />

      {creatingAsset && activeTenantId && (
        <CreateAssetModal
          tenantId={activeTenantId}
          onClose={() => setCreatingAsset(false)}
          onCreated={() => { setCreatingAsset(false); reload(); }}
        />
      )}
      {creatingPolicy && activeTenantId && (
        <CreatePolicyModal
          tenantId={activeTenantId}
          onClose={() => setCreatingPolicy(false)}
          onCreated={() => { setCreatingPolicy(false); reload(); }}
        />
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus, um die Governance Runtime zu sehen.</div>
        ) : events === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Tenant-Daten…
          </div>
        ) : empty ? (
          <EmptyState onAddAsset={() => setCreatingAsset(true)} />
        ) : (
          <Body
            events={events!}
            assets={assets!}
            policies={policies!}
            controls={controls ?? []}
            onChange={reload}
          />
        )}
      </main>
      <AgentWidget />
    </div>
  );
}

function EmptyState({ onAddAsset }: { onAddAsset: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-4">
        <Activity className="h-6 w-6 text-titanium-600" />
      </div>
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Noch leer</h2>
      <p className="text-sm text-titanium-400 mb-6 max-w-md mx-auto leading-relaxed">
        4 geführte Schritte zur produktiven Runtime — oder direkt eigenes Asset anlegen.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Link
          to="/governance/onboarding"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" /> Onboarding starten
        </Link>
        <button
          onClick={onAddAsset}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-titanium-900 hover:border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none"
        >
          Nur Asset anlegen
        </button>
        <Link
          to="/governance-runtime"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-titanium-900 hover:border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none"
        >
          Beispiel-Ansicht
        </Link>
      </div>
    </div>
  );
}

function Body({
  events, assets, policies, controls, onChange,
}: {
  events: DbGovernanceEvent[];
  assets: DbGovernanceAsset[];
  policies: DbGovernancePolicy[];
  controls: DbFrameworkControl[];
  onChange: () => void;
}) {
  const criticalEvents = events.filter((e) => e.risk_level === 'critical' || e.risk_level === 'high').length;
  const highRiskAssets = assets.filter((a) => a.risk_score >= 70).length;
  const activePolicies = policies.filter((p) => p.enabled).length;
  const blockedActions = events.filter((e) => e.policy_action === 'block').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric icon={<Database />}  label="Assets" value={assets.length} />
        <Metric icon={<Activity />}  label="Events" value={events.length} />
        <Metric icon={<AlertTriangle />} label="High / Critical" value={criticalEvents} tone="danger" />
        <Metric icon={<ShieldCheck />} label="Aktive Policies" value={activePolicies} />
        <Metric icon={<Lock />}      label="Blockiert" value={blockedActions} tone="warn" />
      </div>

      <GovernanceTrendsPanel events={events} />

      {events.length > 0 && (
        <Panel icon={<Activity className="h-4 w-4" />} title="Runtime Event Stream">
          <ul className="space-y-2">
            {events.slice(0, 25).map((ev) => (
              <li key={ev.id}>
                <Link
                  to={`/governance/events/${ev.id}`}
                  className="block border border-titanium-900 bg-obsidian-950/60 p-3 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-titanium-50 text-sm leading-snug">{ev.title}</div>
                      <div className="text-[11px] font-mono text-titanium-400 mt-1">
                        {ev.event_type} · {ev.event_source}{ev.vendor ? ` · ${ev.vendor}` : ''}
                      </div>
                      {ev.summary && (
                        <div className="text-[13px] text-titanium-300 mt-1.5 leading-relaxed">{ev.summary}</div>
                      )}
                    </div>
                    <RiskBadge level={ev.risk_level} />
                  </div>
                  {ev.policy_action && (
                    <div className="mt-2 text-[11px] font-mono uppercase tracking-wider">
                      <span className={ev.policy_action === 'block' ? 'text-red-300' : ev.policy_action === 'warn' ? 'text-amber-300' : 'text-titanium-400'}>
                        policy · {ev.policy_action}
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets.length > 0 && (
          <Panel icon={<Bot className="h-4 w-4" />} title="Governance Assets">
            <ul className="space-y-2">
              {assets.map((a) => <AssetRow key={a.id} asset={a} onChange={onChange} />)}
            </ul>
          </Panel>
        )}

        {policies.length > 0 && (
          <Panel icon={<ShieldCheck className="h-4 w-4" />} title="Policies">
            <ul className="space-y-2">
              {policies.map((p) => <PolicyRow key={p.id} policy={p} onChange={onChange} />)}
            </ul>
          </Panel>
        )}
      </div>

      {controls.length > 0 && (
        <Panel icon={<FileCheck2 className="h-4 w-4" />} title="Framework Controls (Reference)">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {controls.map((c) => (
              <div key={c.id} className="border border-titanium-900 bg-obsidian-950/60 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400">
                  {c.framework} · {c.control_code}
                </div>
                <div className="font-semibold text-titanium-50 text-sm mt-1">{c.title}</div>
                {c.description && (
                  <div className="text-[12px] text-titanium-400 mt-1 leading-relaxed">{c.description}</div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="border border-amber-500/30 bg-amber-500/5 p-4 text-[13px] text-titanium-300 flex items-start gap-3">
        <GitBranch className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <div>
          <strong className="text-titanium-50">Hinweis:</strong> Assets und Policies werden aktuell
          direkt via Supabase verwaltet — UI-CRUD folgt. Events kommen über die Ingest-API
          (<code className="font-mono text-amber-200">rsd_gov_…</code>-Key) aus Browser-Extension,
          SDK, Agent-Runtime und CI/CD.
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'danger' | 'warn';
}) {
  const valueColor =
    tone === 'danger' ? 'text-red-300' :
    tone === 'warn'   ? 'text-amber-300' :
    'text-titanium-50';
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="h-5 w-5 text-titanium-400">{icon}</div>
      <div className={`mt-2 text-2xl font-display font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
    </div>
  );
}

function Panel({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2 text-titanium-200">
        {icon}
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}

function scoreClass(score: number) {
  if (score >= 80) return 'text-red-300';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-yellow-300';
  return 'text-emerald-300';
}

function AssetRow({ asset, onChange }: { asset: DbGovernanceAsset; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const isArchived = asset.status === 'archived';
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 hover:border-amber-500/40 transition-colors">
      <div className="flex items-stretch">
        <Link to={`/governance/assets/${asset.id}`} className="flex-1 min-w-0 p-3 block">
          <div className="font-semibold text-titanium-50 text-sm">{asset.name}</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
            {asset.asset_type} · {asset.ai_act_class} · {asset.status}
          </div>
          {asset.vendor && (
            <div className="text-[11px] text-titanium-500 mt-0.5">Vendor: {asset.vendor}</div>
          )}
        </Link>
        <div className="flex items-center gap-2 p-3 shrink-0">
          <span className={`font-mono text-sm font-bold ${scoreClass(asset.risk_score)}`}>
            {asset.risk_score}/100
          </span>
          {!isArchived && (
            <button
              onClick={async () => {
                if (!confirm(`Asset "${asset.name}" archivieren?`)) return;
                setBusy(true);
                await archiveAsset(asset.id);
                setBusy(false);
                onChange();
              }}
              disabled={busy}
              className="p-1.5 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 rounded-none disabled:opacity-50"
              aria-label="Archivieren"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function PolicyRow({ policy, onChange }: { policy: DbGovernancePolicy; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-titanium-50 text-sm">{policy.name}</div>
          {policy.description && (
            <div className="text-[12px] text-titanium-300 mt-1 leading-relaxed">{policy.description}</div>
          )}
          <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-500 mt-1">
            {policy.policy_type} · {policy.action}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RiskBadge level={policy.severity} />
          <button
            onClick={async () => {
              setBusy(true);
              await togglePolicy(policy.id, !policy.enabled);
              setBusy(false);
              onChange();
            }}
            disabled={busy}
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-none disabled:opacity-50 ${
              policy.enabled
                ? 'border-emerald-700 text-emerald-300 hover:bg-emerald-950/50'
                : 'border-titanium-700 text-titanium-400 hover:bg-titanium-900/50'
            }`}
          >
            {policy.enabled ? '● aktiv' : '○ pausiert'}
          </button>
        </div>
      </div>
    </li>
  );
}
