// Governance-Arbeitsbereich im Command Center (/app/dashboard).
//
// Übernimmt die Arbeitslisten des früheren `GovernanceDashboardView`
// (Assets, Policies, Ereignis-Verlauf, Framework-Controls, Inspector,
// Anlegen/Archivieren/Umschalten) in das eine Kunden-Dashboard (WP11).
// Bewusst NICHT übernommen:
//   - eigene Kopfzeile, Modul-Links und Mandantenwahl: liefert das
//     Governance-OS-Gehäuse (GovernanceBrowserShell, Sidebar, TopBar);
//   - DSGVO-Control-Pack mit Demo-Signalen: Demo-Daten gehören nicht
//     in ein Live-Dashboard;
//   - Upgrade-Kacheln und Lifecycle-Werbetext: Pläne stehen in der
//     Startansicht bzw. auf /pricing.
//
// Daten: dieselben RLS-Quellen wie zuvor (governance_events/_assets/_policies,
// framework_controls). Mutationen melden sich über notifyTenantDataChanged,
// damit auch Cockpit und Kachelreihe darüber neu laden.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Archive, Bot, Database, FileCheck2, Library, Loader2, Lock, Plus, ShieldCheck,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { notifyTenantDataChanged, useTenantDataVersion } from '../tenantDataEvents';
import {
  fetchFrameworkControls, fetchTenantAssets, fetchTenantEvents, fetchTenantPolicies,
  type DbFrameworkControl, type DbGovernanceAsset, type DbGovernanceEvent, type DbGovernancePolicy,
} from '../governanceApi';
import { archiveAsset, togglePolicy, type BareResult } from '../resourcesApi';
import { CreateAssetModal, CreatePolicyModal } from '../GovernanceResourceModals';
import { GovernanceTrendsPanel } from '../GovernanceTrendsPanel';
import { GovernanceInspectorPanel, type InspectorSelection } from '../GovernanceInspectorPanel';
import type { GovernanceRiskLevel } from '../types';
import { mutationError } from './governanceWorkbenchModel';

interface WorkbenchData {
  tenantId: string;
  events: DbGovernanceEvent[];
  assets: DbGovernanceAsset[];
  policies: DbGovernancePolicy[];
  controls: DbFrameworkControl[];
}

export function GovernanceWorkbench() {
  const { activeTenantId } = useTenant();
  const dataVersion = useTenantDataVersion(activeTenantId);
  const [data, setData] = useState<WorkbenchData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [inspectorSelection, setInspectorSelection] = useState<InspectorSelection | null>(null);
  const closeInspector = useCallback(() => setInspectorSelection(null), []);
  const loadGen = useRef(0);

  useEffect(() => {
    const gen = ++loadGen.current;
    setData(null);
    setLoadError(null);
    setActionError(null);
    if (!activeTenantId) return;
    const tenantId = activeTenantId;
    void Promise.allSettled([
      fetchTenantEvents(tenantId),
      fetchTenantAssets(tenantId),
      fetchTenantPolicies(tenantId),
      fetchFrameworkControls(),
    ]).then(([e, a, p, c]) => {
      // Mandantenwechsel oder neuere Ladung: Ergebnis verwerfen.
      if (gen !== loadGen.current) return;
      const failed = [e, a, p, c].find((r) => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        setLoadError((failed.reason as Error)?.message ?? 'Governance-Daten nicht verfügbar');
      }
      setData({
        tenantId,
        events: e.status === 'fulfilled' ? e.value : [],
        assets: a.status === 'fulfilled' ? a.value : [],
        policies: p.status === 'fulfilled' ? p.value : [],
        controls: c.status === 'fulfilled' ? c.value : [],
      });
    });
    return () => { loadGen.current += 1; };
  }, [activeTenantId, dataVersion]);

  // Neu laden = Änderung melden; der Effekt oben hängt an dataVersion.
  const changed = useCallback(() => {
    if (activeTenantId) notifyTenantDataChanged(activeTenantId);
  }, [activeTenantId]);

  if (!activeTenantId) return null;
  // Nur Daten des aktiven Mandanten anzeigen (Schutz gegen den Wechsel-Frame).
  const current = data?.tenantId === activeTenantId ? data : null;
  const empty = current !== null
    && current.events.length === 0 && current.assets.length === 0 && current.policies.length === 0;

  return (
    <section
      className="border border-titanium-900 bg-obsidian-950 text-titanium-100 mt-6"
      aria-labelledby="governance-workbench-heading"
      data-testid="governance-workbench"
    >
      <header className="px-4 py-3 border-b border-titanium-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="governance-workbench-heading" className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">
            Assets, Policies und Ereignisse
          </h2>
          <p className="text-[11px] font-mono text-titanium-400 mt-0.5">
            governance_assets · governance_policies · governance_events (RLS)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton onClick={() => setCreatingAsset(true)} icon={<Plus className="h-4 w-4" />} label="Asset" />
          <ToolbarButton onClick={() => setCreatingPolicy(true)} icon={<Plus className="h-4 w-4" />} label="Policy" />
          <Link
            to="/app/policies/templates"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
          >
            <Library className="h-4 w-4" /> Templates
          </Link>
        </div>
      </header>

      {creatingAsset && (
        <CreateAssetModal
          tenantId={activeTenantId}
          onClose={() => setCreatingAsset(false)}
          onCreated={() => { setCreatingAsset(false); changed(); }}
        />
      )}
      {creatingPolicy && (
        <CreatePolicyModal
          tenantId={activeTenantId}
          onClose={() => setCreatingPolicy(false)}
          onCreated={() => { setCreatingPolicy(false); changed(); }}
        />
      )}
      <GovernanceInspectorPanel
        selection={inspectorSelection}
        onClose={closeInspector}
        onChange={changed}
        onSelect={setInspectorSelection}
      />

      <div className="p-4 space-y-6">
        {(loadError || actionError) && (
          <div role="alert" className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{actionError ?? loadError}</span>
          </div>
        )}

        {current === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Governance-Daten…
          </div>
        ) : empty && !loadError ? (
          <div className="text-center py-8 max-w-xl mx-auto" data-testid="governance-workbench-empty">
            <p className="text-titanium-300 text-sm leading-relaxed mb-4">
              Noch keine Assets, Policies oder Ereignisse für diesen Mandanten.
              Ereignisse kommen über die Ingest-API (<code className="font-mono text-amber-200">rsd_gov_…</code>-Key).
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <ToolbarButton onClick={() => setCreatingAsset(true)} icon={<Plus className="h-4 w-4" />} label="Erstes Asset anlegen" />
              <Link
                to="/app/keys"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
              >
                Ingest-Key erzeugen
              </Link>
            </div>
          </div>
        ) : (
          <WorkbenchBody
            data={current}
            onInspect={setInspectorSelection}
            onChanged={changed}
            onActionError={setActionError}
          />
        )}
      </div>
    </section>
  );
}

function WorkbenchBody({
  data, onInspect, onChanged, onActionError,
}: {
  data: WorkbenchData;
  onInspect: (s: InspectorSelection) => void;
  onChanged: () => void;
  onActionError: (message: string | null) => void;
}) {
  const { events, assets, policies, controls } = data;
  const criticalEvents = events.filter((e) => e.risk_level === 'critical' || e.risk_level === 'high').length;
  const activePolicies = policies.filter((p) => p.enabled).length;
  const blockedActions = events.filter((e) => e.policy_action === 'block').length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric icon={<Database />} label="Assets" value={assets.length} />
        <Metric icon={<Activity />} label="Events" value={events.length} />
        <Metric icon={<AlertTriangle />} label="High / Critical" value={criticalEvents} tone="danger" />
        <Metric icon={<ShieldCheck />} label="Aktive Policies" value={activePolicies} />
        <Metric icon={<Lock />} label="Blockiert" value={blockedActions} tone="warn" />
      </div>

      <GovernanceTrendsPanel events={events} />

      {events.length > 0 && (
        <Panel icon={<Activity className="h-4 w-4" />} title="Ereignis-Verlauf">
          <ul className="space-y-2">
            {events.slice(0, 25).map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets.length > 0 && (
          <Panel icon={<Bot className="h-4 w-4" />} title="Governance Assets">
            <ul className="space-y-2">
              {assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  onInspect={() => onInspect({ type: 'asset', item: a })}
                  onChanged={onChanged}
                  onActionError={onActionError}
                />
              ))}
            </ul>
          </Panel>
        )}
        {policies.length > 0 && (
          <Panel icon={<ShieldCheck className="h-4 w-4" />} title="Policies">
            <ul className="space-y-2">
              {policies.map((p) => (
                <PolicyRow
                  key={p.id}
                  policy={p}
                  onInspect={() => onInspect({ type: 'policy', item: p })}
                  onChanged={onChanged}
                  onActionError={onActionError}
                />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {controls.length > 0 && (
        <details className="border border-titanium-900 bg-obsidian-900/60" data-testid="governance-workbench-controls">
          <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 text-titanium-200 font-display font-bold text-sm tracking-wider uppercase">
            <FileCheck2 className="h-4 w-4" /> Framework-Controls (Referenz, {controls.length})
          </summary>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
        </details>
      )}
    </>
  );
}

function ToolbarButton({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-titanium-900 hover:border-amber-500 text-titanium-200 hover:text-amber-200 text-sm font-semibold rounded-none transition-colors"
    >
      {icon} {label}
    </button>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone?: 'danger' | 'warn' }) {
  const valueColor = tone === 'danger' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-titanium-50';
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
      <div className="h-5 w-5 text-titanium-400">{icon}</div>
      <div className={`mt-2 text-2xl font-display font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2 text-titanium-200">
        {icon}
        <h3 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high' ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium' ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low' ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
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

interface RowProps {
  onInspect: () => void;
  onChanged: () => void;
  onActionError: (message: string | null) => void;
}

/** Mutation ausführen; Fehler (auch {ok:false}) sichtbar machen statt verschlucken. */
async function runMutation(
  action: () => Promise<BareResult>,
  fallback: string,
  { onChanged, onActionError }: Pick<RowProps, 'onChanged' | 'onActionError'>,
): Promise<void> {
  onActionError(null);
  try {
    const message = mutationError(await action(), fallback);
    if (message) { onActionError(message); return; }
    onChanged();
  } catch (err) {
    onActionError((err as Error)?.message ?? fallback);
  }
}

function AssetRow({ asset, ...props }: RowProps & { asset: DbGovernanceAsset }) {
  const [busy, setBusy] = useState(false);
  const isArchived = asset.status === 'archived';
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 hover:border-amber-500/40 transition-colors">
      <div className="flex items-stretch">
        <button type="button" onClick={props.onInspect} className="flex-1 min-w-0 p-3 block text-left">
          <div className="font-semibold text-titanium-50 text-sm">{asset.name}</div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
            {asset.asset_type} · {asset.ai_act_class} · {asset.status}
          </div>
          {asset.vendor && <div className="text-[11px] text-titanium-500 mt-0.5">Vendor: {asset.vendor}</div>}
        </button>
        <div className="flex items-center gap-2 p-3 shrink-0">
          <span className={`font-mono text-sm font-bold ${scoreClass(asset.risk_score)}`}>{asset.risk_score}/100</span>
          {!isArchived && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Asset "${asset.name}" archivieren?`)) return;
                setBusy(true);
                await runMutation(() => archiveAsset(asset.id), 'Asset konnte nicht archiviert werden.', props);
                setBusy(false);
              }}
              disabled={busy}
              className="p-1.5 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800 rounded-none disabled:opacity-50"
              aria-label={`Asset ${asset.name} archivieren`}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function PolicyRow({ policy, ...props }: RowProps & { policy: DbGovernancePolicy }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="border border-titanium-900 bg-obsidian-950/60 hover:border-amber-500/40 transition-colors">
      <div className="flex items-stretch">
        <button type="button" onClick={props.onInspect} className="flex-1 min-w-0 p-3 text-left block">
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
            type="button"
            onClick={async () => {
              setBusy(true);
              await runMutation(
                () => togglePolicy(policy.id, !policy.enabled),
                'Policy konnte nicht umgeschaltet werden.',
                props,
              );
              setBusy(false);
            }}
            disabled={busy}
            aria-pressed={policy.enabled}
            aria-label={`Policy ${policy.name} ${policy.enabled ? 'pausieren' : 'aktivieren'}`}
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
