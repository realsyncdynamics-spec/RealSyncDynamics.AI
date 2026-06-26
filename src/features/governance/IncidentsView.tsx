import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldAlert, Plus, Loader2, AlertTriangle, X, Clock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantIncidents, createIncident, transitionIncident,
  type DbIncident,
} from './incidentsApi';
import type { IncidentStatus, IncidentSeverity } from './types';

const STATUSES: IncidentStatus[] = ['open','investigating','contained','resolved','reported_to_authority'];
const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: 'Offen', investigating: 'Untersuchung', contained: 'Eingedämmt',
  resolved: 'Gelöst', reported_to_authority: 'Gemeldet',
};
const STATUS_CLS: Record<IncidentStatus, string> = {
  open:                  'bg-red-500/15 text-red-200 border-red-500/40',
  investigating:         'bg-amber-500/15 text-amber-200 border-amber-500/40',
  contained:             'bg-sky-500/15 text-sky-200 border-sky-500/40',
  resolved:              'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  reported_to_authority: 'bg-purple-500/15 text-purple-200 border-purple-500/40',
};

export function IncidentsView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<DbIncident[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbIncident | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    try { setItems(await fetchTenantIncidents(activeTenantId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const open = (items ?? []).filter((i) => !['resolved','reported_to_authority'].includes(i.status));
  const critical72h = open.filter((i) => {
    const ms = new Date(i.notification_deadline_at).getTime() - Date.now();
    return ms < 12 * 3600 * 1000;
  });
  const breaches = (items ?? []).filter((i) => i.breach_confirmed).length;
  const resolved = (items ?? []).filter((i) => i.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center"><ShieldAlert className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Incidents</div>
              <div className="text-[11px] text-titanium-400">Breach-Response · 72h-Meldepflicht</div>
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
          <button onClick={() => setCreating(true)} disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Neuer Incident
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Metric label="Offen" value={open.length} tone={open.length > 0 ? 'danger' : undefined} />
          <Metric label="72h kritisch" value={critical72h.length} tone={critical72h.length > 0 ? 'danger' : undefined} />
          <Metric label="Breaches bestätigt" value={breaches} />
          <Metric label="Gelöst" value={resolved} />
        </div>

        {!activeTenantId ? <div className="text-titanium-500 text-sm">Tenant wählen.</div>
          : items === null ? <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>
          : items.length === 0 ? <div className="text-center py-16"><ShieldAlert className="h-8 w-8 mx-auto text-titanium-600 mb-3" /><p className="text-sm text-titanium-400">Keine Incidents.</p></div>
          : <ul className="space-y-2">{items.map((i) => <Row key={i.id} inc={i} onClick={() => setEditing(i)} />)}</ul>}
      </main>

      {(creating || editing) && activeTenantId && (
        <Modal tenantId={activeTenantId} incident={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void reload(); }} />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  const color = tone === 'danger' ? 'text-red-300' : 'text-titanium-50';
  return <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className={`text-2xl font-display font-bold tabular-nums ${color}`}>{value}</div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
  </div>;
}

function Row({ inc, onClick }: { inc: DbIncident; onClick: () => void }) {
  const open = !['resolved','reported_to_authority'].includes(inc.status);
  const ms = new Date(inc.notification_deadline_at).getTime() - Date.now();
  const hours = Math.round(ms / 3600_000);
  const cls = open && hours < 12 ? 'text-red-300 font-bold' : hours < 24 ? 'text-amber-300' : 'text-titanium-300';
  return <li className="border border-titanium-900 bg-obsidian-900/60 p-3 hover:border-amber-500/40 transition-colors cursor-pointer" onClick={onClick}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-titanium-50 text-sm">{inc.title}</div>
        <div className="text-[11px] text-titanium-400 mt-0.5 font-mono uppercase tracking-wider">
          severity · {inc.severity}{inc.personal_data_affected ? ' · PII affected' : ''}
        </div>
        {inc.description && <div className="text-[12px] text-titanium-300 mt-1 line-clamp-2">{inc.description}</div>}
      </div>
      <div className="text-right shrink-0">
        <span className={`inline-block border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${STATUS_CLS[inc.status]}`}>{STATUS_LABEL[inc.status]}</span>
        {open && (
          <div className={`text-[11px] font-mono mt-1 ${cls}`}>
            <Clock className="h-3 w-3 inline mr-0.5" />
            {hours < 0 ? `${Math.abs(hours)}h überfällig` : `${hours}h zur 72h-Frist`}
          </div>
        )}
      </div>
    </div>
  </li>;
}

function Modal({ tenantId, incident, onClose, onSaved }: { tenantId: string; incident: DbIncident | null; onClose: () => void; onSaved: () => void; }) {
  const isNew = !incident;
  const [title, setTitle] = useState(incident?.title ?? '');
  const [desc, setDesc] = useState(incident?.description ?? '');
  const [severity, setSeverity] = useState<IncidentSeverity>(incident?.severity ?? 'high');
  const [pii, setPii] = useState(incident?.personal_data_affected ?? false);
  const [assignee, setAssignee] = useState(incident?.assigned_to ?? '');
  const [transitionStatus, setTransitionStatus] = useState<IncidentStatus | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    if (isNew) {
      const r = await createIncident({
        tenant_id: tenantId, title: title.trim(), description: desc || null,
        severity, personal_data_affected: pii, assigned_to: assignee || null,
      });
      setBusy(false);
      if (!r.ok) { setError(r.error?.message ?? 'Erstellen fehlgeschlagen'); return; }
      onSaved();
    } else if (transitionStatus) {
      const r = await transitionIncident(incident!.id, transitionStatus, note || undefined);
      setBusy(false);
      if (!r.ok) { setError(r.error?.message ?? 'Statuswechsel fehlgeschlagen'); return; }
      onSaved();
    } else {
      setBusy(false);
      setError('Wähle einen Status zum Transitionen.');
    }
  };

  return <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none w-full max-w-xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-titanium-900 sticky top-0 bg-obsidian-900">
        <h2 className="font-display font-bold text-titanium-50">{isNew ? 'Neuer Incident' : 'Incident bearbeiten'}</h2>
        <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        {isNew ? <>
          <Field label="Titel"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} /></Field>
          <Field label="Beschreibung"><textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Severity">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} className={inputCls}>
                {(['low','medium','high','critical'] as IncidentSeverity[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <label className="flex items-end gap-2 text-sm text-titanium-200 pb-2">
              <input type="checkbox" checked={pii} onChange={(e) => setPii(e.target.checked)} /> Personenbezogene Daten betroffen
            </label>
          </div>
          <Field label="Zuständig"><input type="text" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="dpo@example.com" className={inputCls} /></Field>
        </> : <>
          <div className="border border-titanium-900 bg-obsidian-950/60 p-3 text-[13px] text-titanium-300">
            <div className="text-titanium-50 font-semibold">{incident!.title}</div>
            {incident!.description && <div className="mt-1 text-titanium-300">{incident!.description}</div>}
            <div className="mt-2 text-[10px] font-mono uppercase tracking-wider text-titanium-400">
              detected: {new Date(incident!.detected_at).toLocaleString('de-DE')} · 72h-Frist: {new Date(incident!.notification_deadline_at).toLocaleString('de-DE')}
            </div>
          </div>
          <Field label="Neuer Status">
            <select value={transitionStatus} onChange={(e) => setTransitionStatus(e.target.value as IncidentStatus)} className={inputCls}>
              <option value="">– wählen –</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Notiz (kommt in die Timeline)"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>

          {Array.isArray(incident!.timeline) && incident!.timeline.length > 0 && <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">Timeline</div>
            <ul className="border border-titanium-900 bg-obsidian-950/60 p-2 space-y-1.5 max-h-40 overflow-y-auto">
              {incident!.timeline.slice().reverse().map((t, i) => (
                <li key={i} className="text-[11px] font-mono">
                  <span className="text-titanium-500">{new Date(t.timestamp).toLocaleString('de-DE')}</span>{' '}
                  <span className="text-amber-300">{t.actor}</span>{' '}
                  <span className="text-titanium-300">{t.action}</span>
                  {t.note && <div className="text-titanium-400 ml-4 font-sans normal-case">{t.note}</div>}
                </li>
              ))}
            </ul>
          </div>}
        </>}
        {error && <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800">Abbrechen</button>
          <button onClick={save} disabled={busy || (isNew && !title.trim())} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
            {busy ? 'Speichere…' : isNew ? 'Erstellen' : 'Transitionen'}
          </button>
        </div>
      </div>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500';
