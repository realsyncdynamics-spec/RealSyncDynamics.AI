import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, UserCheck, Plus, Loader2, AlertTriangle, X, Check, Clock,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantDsrs, createDsr, updateDsr,
  type DbDsrRequest,
} from './dsrApi';
import type { DsrStatus, DsrRequestType } from './types';

const TYPES: DsrRequestType[] = ['access','erasure','portability','rectification','restriction','objection'];
const STATUSES: DsrStatus[] = ['received','in_progress','pending_verification','completed','rejected'];

const TYPE_LABEL: Record<DsrRequestType, string> = {
  access:        'Auskunft (Art. 15)',
  erasure:       'Löschung (Art. 17)',
  portability:   'Portabilität (Art. 20)',
  rectification: 'Berichtigung (Art. 16)',
  restriction:   'Einschränkung (Art. 18)',
  objection:     'Widerspruch (Art. 21)',
};

export function DsrTrackerView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<DbDsrRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DbDsrRequest | null>(null);

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    try { setItems(await fetchTenantDsrs(activeTenantId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const now = Date.now();
  const open = (items ?? []).filter((d) => !['completed', 'rejected'].includes(d.status));
  const overdue = open.filter((d) => new Date(d.deadline_at).getTime() < now);
  const dueThisWeek = open.filter((d) => {
    const ms = new Date(d.deadline_at).getTime() - now;
    return ms >= 0 && ms <= 7 * 24 * 3600 * 1000;
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center"><UserCheck className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSR Tracker</div>
              <div className="text-[11px] text-titanium-400">Betroffenenrechte · 30-Tage-Frist</div>
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
            <Plus className="h-4 w-4" /> Neue Anfrage
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Metric label="Gesamt" value={items?.length ?? 0} />
          <Metric label="Offen" value={open.length} />
          <Metric label="Überfällig" value={overdue.length} tone="danger" />
          <Metric label="Diese Woche" value={dueThisWeek.length} tone="warn" />
        </div>

        {!activeTenantId ? <div className="text-titanium-500 text-sm">Tenant wählen.</div>
          : items === null ? <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>
          : items.length === 0 ? <div className="text-center py-16"><UserCheck className="h-8 w-8 mx-auto text-titanium-600 mb-3" /><p className="text-sm text-titanium-400">Noch keine DSR-Anfragen.</p></div>
          : <ul className="space-y-2">{items.map((d) => <Row key={d.id} dsr={d} onClick={() => setEditing(d)} />)}</ul>}
      </main>

      {(creating || editing) && activeTenantId && (
        <Modal tenantId={activeTenantId} dsr={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void reload(); }} />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warn' }) {
  const color = tone === 'danger' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-titanium-50';
  return <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className={`text-2xl font-display font-bold tabular-nums ${color}`}>{value}</div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
  </div>;
}

function Row({ dsr, onClick }: { dsr: DbDsrRequest; onClick: () => void }) {
  const ms = new Date(dsr.deadline_at).getTime() - Date.now();
  const days = Math.round(ms / (24 * 3600 * 1000));
  const overdue = days < 0 && !['completed', 'rejected'].includes(dsr.status);
  const deadlineCls = overdue ? 'text-red-300 font-bold' : days <= 7 ? 'text-amber-300' : days <= 14 ? 'text-yellow-300' : 'text-titanium-300';

  return <li className="border border-titanium-900 bg-obsidian-900/60 p-3 hover:border-amber-500/40 transition-colors cursor-pointer" onClick={onClick}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-titanium-50 text-sm">{TYPE_LABEL[dsr.request_type]}</div>
        <div className="text-[11px] text-titanium-400 mt-0.5">{dsr.requester_name ?? dsr.requester_email}</div>
        {dsr.subject_description && <div className="text-[12px] text-titanium-300 mt-1 line-clamp-2">{dsr.subject_description}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[11px] font-mono ${deadlineCls}`}>
          <Clock className="h-3 w-3 inline mr-0.5" />
          {overdue ? `${Math.abs(days)} Tg. überfällig` : `${days} Tg. verbleibend`}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{dsr.status}</div>
      </div>
    </div>
  </li>;
}

function Modal({ tenantId, dsr, onClose, onSaved }: { tenantId: string; dsr: DbDsrRequest | null; onClose: () => void; onSaved: () => void; }) {
  const isNew = !dsr;
  const [type, setType] = useState<DsrRequestType>(dsr?.request_type ?? 'access');
  const [status, setStatus] = useState<DsrStatus>(dsr?.status ?? 'received');
  const [name, setName] = useState(dsr?.requester_name ?? '');
  const [email, setEmail] = useState(dsr?.requester_email ?? '');
  const [desc, setDesc] = useState(dsr?.subject_description ?? '');
  const [notes, setNotes] = useState(dsr?.response_notes ?? '');
  const [assignee, setAssignee] = useState(dsr?.assigned_to ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    const r = isNew
      ? await createDsr({ tenant_id: tenantId, request_type: type, requester_email: email.trim(), requester_name: name || null, subject_description: desc || null, assigned_to: assignee || null })
      : await updateDsr(dsr!.id, { status, response_notes: notes || null, assigned_to: assignee || null, subject_description: desc || null });
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Speichern fehlgeschlagen'); return; }
    onSaved();
  };

  return <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-titanium-900 sticky top-0 bg-obsidian-900">
        <h2 className="font-display font-bold text-titanium-50">{isNew ? 'Neue DSR-Anfrage' : 'DSR-Anfrage bearbeiten'}</h2>
        <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        {isNew && <>
          <Field label="Typ"><select value={type} onChange={(e) => setType(e.target.value as DsrRequestType)} className={inputCls}>{TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} /></Field>
          </div>
        </>}
        {!isNew && <Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as DsrStatus)} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>}
        <Field label="Beschreibung"><textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></Field>
        {!isNew && <Field label="Response-Notiz"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>}
        <Field label="Zuständig"><input type="text" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="z. B. dpo@example.com" className={inputCls} /></Field>
        {error && <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800">Abbrechen</button>
          <button onClick={save} disabled={busy || (isNew && !email.trim())} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
            {!isNew && status === 'completed' ? <><Check className="h-3.5 w-3.5 inline mr-1" />Erledigt markieren</> : busy ? 'Speichere…' : 'Speichern'}
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
