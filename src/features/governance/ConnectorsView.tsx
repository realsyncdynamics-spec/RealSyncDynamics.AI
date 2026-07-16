import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plug, Plus, Loader2, AlertTriangle, X, Trash2, ExternalLink,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantConnectors, fetchTenantRemediations,
  createConnector, updateConnector, deleteConnector,
  type DbConnector, type ConnectorType, type DbRemediationAction,
} from './connectorsApi';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

const TYPES: ConnectorType[] = ['jira','github','linear','servicenow','slack','teams'];

function _ConnectorsView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

export const ConnectorsView = withPerformanceMonitoring(
  _ConnectorsView,
  'ConnectorsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [tab, setTab] = useState<'connectors' | 'remediations'>('connectors');
  const [connectors, setConnectors] = useState<DbConnector[] | null>(null);
  const [remediations, setRemediations] = useState<DbRemediationAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbConnector | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setConnectors([]); setRemediations([]); return; }
    setError(null); setConnectors(null); setRemediations(null);
    try {
      const [c, r] = await Promise.all([
        fetchTenantConnectors(activeTenantId),
        fetchTenantRemediations(activeTenantId),
      ]);
      setConnectors(c); setRemediations(r);
    } catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center"><Plug className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Integration Connectors</div>
              <div className="text-[11px] text-titanium-400">Jira · GitHub · Linear · ServiceNow · Slack · Teams</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select value={activeTenantId ?? ''} onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none">
              {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
            </select>
          )}
          {tab === 'connectors' && (
            <button onClick={() => setCreating(true)} disabled={!activeTenantId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
              <Plus className="h-4 w-4" /> Neuer Connector
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-titanium-900 bg-obsidian-900/50 px-4 py-2 flex items-center gap-2">
        {(['connectors','remediations'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border rounded-none ${tab === t ? 'border-amber-500 bg-amber-500/10 text-amber-200' : 'border-titanium-900 text-titanium-400 hover:border-titanium-700'}`}>
            {t === 'connectors' ? 'Connectors' : 'Remediation Log'}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        {tab === 'connectors' && (
          !activeTenantId ? <div className="text-titanium-500 text-sm">Tenant wählen.</div>
          : connectors === null ? <Loading />
          : connectors.length === 0 ? <Empty icon={<Plug className="h-8 w-8 mx-auto text-titanium-600 mb-3" />} text="Keine Connectors konfiguriert." />
          : <ul className="space-y-2">{connectors.map((c) => <ConnectorRow key={c.id} c={c} onClick={() => setEditing(c)} onReload={reload} />)}</ul>
        )}

        {tab === 'remediations' && (
          remediations === null ? <Loading />
          : remediations.length === 0 ? <Empty icon={<ExternalLink className="h-8 w-8 mx-auto text-titanium-600 mb-3" />} text="Noch keine Remediation-Aktionen." />
          : <ul className="space-y-2">{remediations.map((r) => <RemediationRow key={r.id} r={r} />)}</ul>
        )}
      </main>

      {(creating || editing) && activeTenantId && (
        <Modal tenantId={activeTenantId} connector={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void reload(); }} />
      )}
    </div>
  );
}

const Loading = () => <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>;
const Empty = ({ icon, text }: { icon: React.ReactNode; text: string }) => <div className="text-center py-16">{icon}<p className="text-sm text-titanium-400">{text}</p></div>;

function ConnectorRow({ c, onClick, onReload }: { c: DbConnector; onClick: () => void; onReload: () => void }) {
  return <li className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className="flex items-start justify-between gap-3">
      <div onClick={onClick} className="min-w-0 cursor-pointer flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300">{c.connector_type}</span>
          <span className="font-semibold text-titanium-50 text-sm">{c.name}</span>
        </div>
        <div className="text-[11px] text-titanium-400 mt-1">
          Risk: {c.trigger_on_risk_level.join(', ') || 'any'} · Action: {c.trigger_on_policy_action.join(', ') || 'any'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={async () => { await updateConnector(c.id, { enabled: !c.enabled }); onReload(); }}
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-none ${c.enabled ? 'border-emerald-700 text-emerald-300' : 'border-titanium-700 text-titanium-400'}`}>
          {c.enabled ? '● aktiv' : '○ pausiert'}
        </button>
        <button onClick={async () => { if (confirm(`Connector "${c.name}" löschen?`)) { await deleteConnector(c.id); onReload(); } }}
          className="p-1.5 text-titanium-400 hover:text-red-300 hover:bg-obsidian-800 rounded-none" aria-label="Löschen">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </li>;
}

function RemediationRow({ r }: { r: DbRemediationAction }) {
  const cls = r.status === 'completed' ? 'border-emerald-500/40 text-emerald-300' : r.status === 'failed' ? 'border-red-500/40 text-red-300' : 'border-amber-500/40 text-amber-300';
  return <li className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[12px] font-mono text-titanium-300">
        {new Date(r.created_at).toLocaleString('de-DE')} · {r.action_type}
        {r.event_id && <span className="text-titanium-500"> · event {r.event_id.slice(0, 8)}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border ${cls}`}>{r.status}</span>
        {r.external_url && <a href={r.external_url} target="_blank" rel="noreferrer" className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 text-[11px]"><ExternalLink className="h-3 w-3" />Open</a>}
      </div>
    </div>
    {r.error_message && <div className="text-[11px] text-red-300 mt-1">{r.error_message}</div>}
  </li>;
}

function Modal({ tenantId, connector, onClose, onSaved }: { tenantId: string; connector: DbConnector | null; onClose: () => void; onSaved: () => void; }) {
  const isNew = !connector;
  const [type, setType] = useState<ConnectorType>(connector?.connector_type ?? 'jira');
  const [name, setName] = useState(connector?.name ?? '');
  const [configStr, setConfigStr] = useState(JSON.stringify(connector?.config ?? {}, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(configStr); if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object'); }
    catch { setError('config muss valides JSON-Objekt sein'); setBusy(false); return; }
    const r = isNew
      ? await createConnector({ tenant_id: tenantId, connector_type: type, name: name.trim(), config: parsed })
      : await updateConnector(connector!.id, { name: name.trim(), config: parsed });
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Speichern fehlgeschlagen'); return; }
    onSaved();
  };

  return <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none w-full max-w-lg">
      <div className="flex items-center justify-between p-4 border-b border-titanium-900">
        <h2 className="font-display font-bold text-titanium-50">{isNew ? 'Neuer Connector' : 'Connector bearbeiten'}</h2>
        <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        {isNew && <Field label="Typ"><select value={type} onChange={(e) => setType(e.target.value as ConnectorType)} className={inputCls}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>}
        <Field label="Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>
        <Field label="Config (JSON)"><textarea rows={6} value={configStr} onChange={(e) => setConfigStr(e.target.value)} className={`${inputCls} font-mono text-xs`} /></Field>
        <p className="text-[11px] text-titanium-500">Beispiel jira: {`{"baseUrl":"https://x.atlassian.net","project":"COMP","apiToken":"..."}`}</p>
        {error && <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800">Abbrechen</button>
          <button onClick={save} disabled={busy || !name.trim()} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">{busy ? 'Speichere…' : 'Speichern'}</button>
        </div>
      </div>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500';
