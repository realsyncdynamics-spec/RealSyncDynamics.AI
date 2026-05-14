import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, FileCheck2, Plus, Loader2, AlertTriangle, X, Check,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  listDpias, createDpia, updateDpia, approveDpia,
  type DbDpia,
} from './dpiasApi';
import type { DpiaStatus } from './types';

const STATUS_LABEL: Record<DpiaStatus, string> = {
  draft: 'Entwurf', in_review: 'In Prüfung', approved: 'Genehmigt', rejected: 'Abgelehnt',
};
const STATUS_CLS: Record<DpiaStatus, string> = {
  draft:      'bg-titanium-800/30 text-titanium-300 border-titanium-700',
  in_review:  'bg-sky-500/15 text-sky-200 border-sky-500/40',
  approved:   'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  rejected:   'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

export function DpiasView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<DbDpia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbDpia | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    const r = await listDpias(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else setItems(r.dpias ?? []);
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance/admin" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
              <FileCheck2 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DPIAs</div>
              <div className="text-[11px] text-titanium-400 font-medium">Data Protection Impact Assessments (Art. 35 GDPR)</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select value={activeTenantId ?? ''} onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer max-w-[200px]">
              {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
            </select>
          )}
          <button onClick={() => setCreating(true)} disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Neue DPIA
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}
        {!activeTenantId ? <div className="text-titanium-500 text-sm">Tenant wählen.</div>
          : items === null ? <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> Lade…</div>
          : items.length === 0 ? <div className="text-center py-16"><FileCheck2 className="h-8 w-8 mx-auto text-titanium-600 mb-3" /><p className="text-sm text-titanium-400">Noch keine DPIAs.</p></div>
          : <ul className="space-y-2">{items.map((d) => <Row key={d.id} dpia={d} onClick={() => setEditing(d)} />)}</ul>}
      </main>

      {(creating || editing) && activeTenantId && (
        <EditModal
          tenantId={activeTenantId}
          dpia={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
}

function Row({ dpia, onClick }: { dpia: DbDpia; onClick: () => void }) {
  const overdue = dpia.review_due_at && new Date(dpia.review_due_at).getTime() < Date.now() && dpia.status !== 'approved';
  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-3 hover:border-amber-500/40 transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-titanium-50 text-sm">{dpia.title}</div>
          {dpia.asset && <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
            Asset: {dpia.asset.name} · {dpia.asset.asset_type} · {dpia.asset.ai_act_class}
          </div>}
          <div className="text-[11px] text-titanium-500 mt-1 flex gap-3">
            {dpia.dpo_consulted && <span>DPO konsultiert</span>}
            {dpia.review_due_at && <span className={overdue ? 'text-red-300' : ''}>Review fällig: {new Date(dpia.review_due_at).toLocaleDateString('de-DE')}</span>}
          </div>
        </div>
        <span className={`shrink-0 border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${STATUS_CLS[dpia.status]}`}>{STATUS_LABEL[dpia.status]}</span>
      </div>
    </li>
  );
}

function EditModal({ tenantId, dpia, onClose, onSaved }: { tenantId: string; dpia: DbDpia | null; onClose: () => void; onSaved: () => void; }) {
  const isNew = !dpia;
  const [title, setTitle] = useState(dpia?.title ?? '');
  const [status, setStatus] = useState<DpiaStatus>(dpia?.status ?? 'draft');
  const [risk, setRisk] = useState(dpia?.risk_description ?? '');
  const [mitigation, setMitigation] = useState(dpia?.mitigation_measures ?? '');
  const [necessity, setNecessity] = useState(dpia?.necessity_assessment ?? '');
  const [proportionality, setProportionality] = useState(dpia?.proportionality_assessment ?? '');
  const [dpoEmail, setDpoEmail] = useState(dpia?.dpo_email ?? '');
  const [dpoConsulted, setDpoConsulted] = useState(dpia?.dpo_consulted ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    const payload = {
      title: title.trim(), status, risk_description: risk, mitigation_measures: mitigation,
      necessity_assessment: necessity, proportionality_assessment: proportionality,
      dpo_consulted: dpoConsulted, dpo_email: dpoEmail || null,
    };
    const r = isNew
      ? await createDpia({ tenant_id: tenantId, ...payload })
      : await updateDpia(dpia!.id, payload);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Speichern fehlgeschlagen'); return; }
    onSaved();
  };

  const approve = async () => {
    if (!dpia) return;
    setBusy(true);
    const r = await approveDpia(dpia.id);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Genehmigen fehlgeschlagen'); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900 sticky top-0 bg-obsidian-900">
          <h2 className="font-display font-bold text-titanium-50">{isNew ? 'Neue DPIA' : 'DPIA bearbeiten'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Titel"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} /></Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as DpiaStatus)} className={inputCls}>
              {(['draft','in_review','approved','rejected'] as DpiaStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Risiko-Beschreibung (Art. 35 Abs. 7 lit. c)"><textarea rows={3} value={risk} onChange={(e) => setRisk(e.target.value)} className={inputCls} /></Field>
          <Field label="Abhilfemaßnahmen (Art. 35 Abs. 7 lit. d)"><textarea rows={3} value={mitigation} onChange={(e) => setMitigation(e.target.value)} className={inputCls} /></Field>
          <Field label="Notwendigkeitsbewertung (Art. 35 Abs. 7 lit. b)"><textarea rows={2} value={necessity} onChange={(e) => setNecessity(e.target.value)} className={inputCls} /></Field>
          <Field label="Verhältnismäßigkeitsbewertung (Art. 35 Abs. 7 lit. b)"><textarea rows={2} value={proportionality} onChange={(e) => setProportionality(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="DPO-Email"><input type="email" value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)} className={inputCls} /></Field>
            <label className="flex items-end gap-2 text-sm text-titanium-200 pb-2"><input type="checkbox" checked={dpoConsulted} onChange={(e) => setDpoConsulted(e.target.checked)} /> DPO konsultiert</label>
          </div>
          {error && <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}</div>}
          <div className="flex items-center justify-between pt-2">
            {!isNew && dpia!.status !== 'approved' && (
              <button onClick={approve} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-emerald-400 disabled:opacity-50">
                <Check className="h-3.5 w-3.5" /> Als genehmigt markieren
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none">Abbrechen</button>
              <button onClick={save} disabled={busy || !title.trim()} className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50">{busy ? 'Speichere…' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500';
