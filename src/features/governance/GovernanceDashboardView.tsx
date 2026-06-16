import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, AlertTriangle, ShieldCheck, Database,
  Bot, FileCheck2, Lock, Loader2, KeyRound, GitBranch, Plus, Archive, Webhook, Network, Gavel, ScrollText, Library, FileDown, UserCheck, ShieldAlert, Plug, Building2, DollarSign, Wrench, Sparkles,
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
import { DsgvoControlPackPanel } from './dsgvo-control-pack/DsgvoControlPackPanel';
import { DEMO_CONTROL_SIGNALS } from './dsgvo-control-pack/dsgvoControlPackDemo';
import { countPendingApprovals } from './approvalsApi';
import { countOpenDpias } from './dpiasApi';
import { countOpenDsrs } from './dsrApi';
import { countOpenIncidents } from './incidentsApi';
import { EnvironmentSwitcher, EnvironmentBanner } from './EnvironmentSwitcher';
import { AgentWidget } from './AgentWidget/AgentWidget';
import { GovernanceInspectorPanel, type InspectorSelection } from './GovernanceInspectorPanel';
import { ModuleStatusBadge } from './ModuleStatusBadge';
import { getModuleStatus } from './moduleConfig';

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
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);
  const closeInspector = useCallback(() => setInspectorSelection(null), []);

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
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Websites & Assets</div>
              <div className="text-[11px] text-titanium-400 font-medium">Telemetrie · Policy-Entscheidungen · Evidence</div>
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
            to="/app/policies/templates"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <Library className="h-4 w-4" /> Templates
          </Link>
          <ModuleLink icon={<KeyRound className="h-4 w-4" />} to="/app/keys" label="Keys" moduleId="keys" />
          <ModuleLink icon={<Gavel className="h-4 w-4" />} to="/app/approvals" label="Approvals" moduleId="approvals" badge={pendingApprovals} />
          <ModuleLink icon={<FileCheck2 className="h-4 w-4" />} to="/app/dpia" label="DPIAs" moduleId="dpias" badge={openDpias} />
          <ModuleLink icon={<UserCheck className="h-4 w-4" />} to="/app/dsr" label="DSR" moduleId="dsr" badge={openDsrs.overdue} />
          <ModuleLink icon={<ShieldAlert className="h-4 w-4" />} to="/app/incidents" label="Incidents" moduleId="incidents" badge={openIncidents} />
          <ModuleLink icon={<Building2 className="h-4 w-4" />} to="/app/vendors" label="Vendors" moduleId="vendors" />
          <ModuleLink icon={<Plug className="h-4 w-4" />} to="/app/connectors" label="Connectors" moduleId="connectors" />
          <ModuleLink icon={<DollarSign className="h-4 w-4" />} to="/app/costs" label="Costs" moduleId="costs" />
          <ModuleLink icon={<Wrench className="h-4 w-4" />} to="/app/remediation" label="Remediation" moduleId="remediation" />
          <ModuleLink icon={<Network className="h-4 w-4" />} to="/app/mappings" label="Matrix" moduleId="matrix" />
          <ModuleLink icon={<ScrollText className="h-4 w-4" />} to="/app/admin-log" label="Log" moduleId="log" />
          <ModuleLink icon={<FileDown className="h-4 w-4" />} to="/app/compliance" label="Report" moduleId="report" />
          <ModuleLink icon={<Webhook className="h-4 w-4" />} to="/app/webhooks" label="Webhooks" moduleId="webhooks" />
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

      <GovernanceInspectorPanel
        selection={inspectorSelection}
        onClose={closeInspector}
        onChange={reload}
        onSelect={setInspectorSelection}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus, um die Übersicht zu sehen.</div>
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
            onInspect={setInspectorSelection}
          />
        )}
      </main>
      <AgentWidget />
    </div>
  );
}

function EmptyState({ onAddAsset }: { onAddAsset: () => void }) {
  return (
    <div className="text-center py-20 max-w-2xl mx-auto">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto rounded-none bg-obsidian-900 border border-titanium-900 flex items-center justify-center mb-6">
        <Activity className="h-7 w-7 text-titanium-500" />
      </div>

      {/* Headline */}
      <h2 className="font-display text-2xl font-bold text-titanium-50 mb-3">
        Governance-Dashboard aufbauen
      </h2>

      {/* Subheadline */}
      <p className="text-titanium-300 leading-relaxed mb-8">
        Starten Sie mit der Registrierung Ihrer ersten Website oder KI-System. RealSyncDynamics.AI überwacht dann automatisch Compliance-Risiken, Datenflüsse, und Governance-Gaps — zentral, nachvollziehbar, mit auditfähiger Evidence.
      </p>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-none bg-obsidian-950 border border-titanium-800 mx-auto mb-3">
            <Database className="h-5 w-5 text-cyan-400" />
          </div>
          <h3 className="font-semibold text-titanium-100 text-sm mb-1">Assets erfassen</h3>
          <p className="text-xs text-titanium-400">Websites, KI-Systeme, Datenflüsse</p>
        </div>

        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-none bg-obsidian-950 border border-titanium-800 mx-auto mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <h3 className="font-semibold text-titanium-100 text-sm mb-1">Findings automatisch</h3>
          <p className="text-xs text-titanium-400">DSGVO, EU AI Act, Vendor-Risiken</p>
        </div>

        <div className="bg-obsidian-900 border border-titanium-900 rounded-none p-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-none bg-obsidian-950 border border-titanium-800 mx-auto mb-3">
            <FileCheck2 className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-titanium-100 text-sm mb-1">Evidence nachweisen</h3>
          <p className="text-xs text-titanium-400">SHA-256, Audit-Trail, auditierbar</p>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/app/onboarding"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 transition-colors"
        >
          <Plus className="h-4 w-4" /> 4-Schritte Onboarding starten
        </Link>
        <button
          onClick={onAddAsset}
          className="inline-flex items-center gap-2 px-6 py-3 border border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none hover:border-titanium-500 transition-colors"
        >
          <Database className="h-4 w-4" /> Asset direkt anlegen
        </button>
        <Link
          to="/runtime"
          className="inline-flex items-center gap-2 px-6 py-3 border border-titanium-700 text-titanium-200 text-sm font-semibold rounded-none hover:border-titanium-500 transition-colors"
        >
          <Sparkles className="h-4 w-4" /> Live-Beispiel anschauen
        </Link>
      </div>

      {/* Secondary Info */}
      <p className="text-[12px] text-titanium-500 mt-8">
        💡 <strong>Tipp:</strong> Der 4-Schritte Onboarding führt Sie durch API-Key-Setup, erste Website-Integration und erste Policies — perfekt zum Anfangen.
      </p>
    </div>
  );
}

function Body({
  events, assets, policies, controls, onChange, onInspect,
}: {
  events: DbGovernanceEvent[];
  assets: DbGovernanceAsset[];
  policies: DbGovernancePolicy[];
  controls: DbFrameworkControl[];
  onChange: () => void;
  onInspect: (s: InspectorSelection) => void;
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
        <Panel icon={<Activity className="h-4 w-4" />} title="Ereignis-Verlauf">
          <ul className="space-y-2">
            {events.slice(0, 25).map((ev) => (
              <li key={ev.id}>
                <button
                  onClick={() => onInspect({ type: 'event', item: ev })}
                  className="w-full text-left block border border-titanium-900 bg-obsidian-950/60 p-3 hover:border-amber-500/40 transition-colors"
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
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <DsgvoControlPackPanel signals={DEMO_CONTROL_SIGNALS} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets.length > 0 && (
          <Panel icon={<Bot className="h-4 w-4" />} title="Governance Assets">
            <ul className="space-y-2">
              {assets.map((a) => <AssetRow key={a.id} asset={a} onChange={onChange} onInspect={() => onInspect({ type: 'asset', item: a })} />)}
            </ul>
          </Panel>
        )}

        {policies.length > 0 && (
          <Panel icon={<ShieldCheck className="h-4 w-4" />} title="Policies">
            <ul className="space-y-2">
              {policies.map((p) => <PolicyRow key={p.id} policy={p} onChange={onChange} onInspect={() => onInspect({ type: 'policy', item: p })} />)}
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

      {/* Monitoring → Evidence → Report Flow */}
      <div className="border border-titanium-900 bg-obsidian-950">
        <div className="px-4 py-3 border-b border-titanium-900">
          <p className="font-mono text-[10px] uppercase tracking-widest text-titanium-500">
            Compliance Lifecycle
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-titanium-900">
          {[
            { icon: <Activity className="h-4 w-4 text-cyan-400" />, step: '01', label: 'Monitoring', desc: 'Tägliche Scans erkennen Drift, neue Tracker, Consent-Brüche und Third-Party-Änderungen automatisch.' },
            { icon: <FileCheck2 className="h-4 w-4 text-emerald-400" />, step: '02', label: 'Evidence', desc: 'Jedes Finding wird SHA-256-versiegelt und mit Zeitstempel in den Audit-Trail geschrieben.' },
            { icon: <ScrollText className="h-4 w-4 text-amber-400" />, step: '03', label: 'Report', desc: 'Auditfähiger PDF-Report für Datenschutzbeauftragte, Behörden und interne Governance-Reviews.' },
          ].map((s) => (
            <div key={s.step} className="px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                {s.icon}
                <span className="font-mono text-[9px] text-titanium-600">{s.step}</span>
                <span className="font-semibold text-xs text-titanium-100">{s.label}</span>
              </div>
              <p className="text-[11px] text-titanium-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade-CTAs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { tier: 'Starter', price: '79 €/Monat', desc: '1 Domain · Monatlicher Re-Scan · DSE-Generator', href: '/checkout/starter?source=governance_dashboard', color: 'border-titanium-700 hover:border-titanium-400' },
          { tier: 'Growth', price: '249 €/Monat', desc: 'Tägliches Monitoring · Fix-Snippets · 3 Domains', href: '/checkout/growth?source=governance_dashboard', color: 'border-cyan-700 hover:border-cyan-400' },
          { tier: 'Agency', price: '699 €/Monat', desc: 'White-Label · 10 Domains · API + Webhooks', href: '/checkout/agency?source=governance_dashboard', color: 'border-titanium-700 hover:border-titanium-400' },
        ].map((plan) => (
          <a
            key={plan.tier}
            href={plan.href}
            className={`border ${plan.color} bg-obsidian-900 px-4 py-3 block transition-colors group`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-titanium-100">{plan.tier}</span>
              <span className="font-mono text-[10px] text-titanium-400">{plan.price}</span>
            </div>
            <p className="text-[11px] text-titanium-500 leading-relaxed mb-2">{plan.desc}</p>
            <span className="font-mono text-[10px] text-cyan-500 group-hover:text-cyan-300 transition-colors">
              14 Tage gratis testen →
            </span>
          </a>
        ))}
      </div>

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

function AssetRow({ asset, onChange, onInspect }: { asset: DbGovernanceAsset; onChange: () => void; onInspect: () => void }) {
  const [busy, setBusy] = useState(false);
  const isArchived = asset.status === 'archived';
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 hover:border-amber-500/40 transition-colors">
      <div className="flex items-stretch">
        <button onClick={onInspect} className="flex-1 min-w-0 p-3 block text-left">
          <div className="font-semibold text-titanium-50 text-sm">{asset.name}</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
            {asset.asset_type} · {asset.ai_act_class} · {asset.status}
          </div>
          {asset.vendor && (
            <div className="text-[11px] text-titanium-500 mt-0.5">Vendor: {asset.vendor}</div>
          )}
        </button>
        <div className="flex items-center gap-2 p-3 shrink-0">
          <span className={`font-mono text-sm font-bold ${scoreClass(asset.risk_score)}`}>
            {asset.risk_score}/100
          </span>
          {!isArchived && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
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

function PolicyRow({ policy, onChange, onInspect }: { policy: DbGovernancePolicy; onChange: () => void; onInspect: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 hover:border-amber-500/40 transition-colors">
      <div className="flex items-stretch">
        <button onClick={onInspect} className="flex-1 min-w-0 p-3 text-left block">
          <div className="font-semibold text-titanium-50 text-sm">{policy.name}</div>
          {policy.description && (
            <div className="text-[12px] text-titanium-300 mt-1 leading-relaxed line-clamp-2">{policy.description}</div>
          )}
          <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-500 mt-1">
            {policy.policy_type} · {policy.action}
          </div>
        </button>
        <div className="flex flex-col items-end justify-center gap-1.5 p-3 shrink-0">
          <RiskBadge level={policy.severity} />
          <button
            onClick={async (e) => {
              e.stopPropagation();
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

interface ModuleLinkProps {
  icon: React.ReactNode;
  to: string;
  label: string;
  moduleId: string;
  badge?: number;
}

function ModuleLink({ icon, to, label, moduleId, badge }: ModuleLinkProps) {
  const status = getModuleStatus(moduleId);
  const hasCountBadge = badge !== undefined && badge > 0;

  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors relative group"
      title={`${label} (${status})`}
    >
      {icon}
      <span className="flex items-center gap-1.5">
        {label}
        <ModuleStatusBadge status={status} compact={true} />
      </span>
      {hasCountBadge && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-amber-500 text-obsidian-950 text-[10px] font-bold rounded-none">
          {badge}
        </span>
      )}
    </Link>
  );
}
