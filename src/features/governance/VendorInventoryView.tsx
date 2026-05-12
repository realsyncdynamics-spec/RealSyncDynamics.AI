import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Plus, Loader2, AlertTriangle, X, Trash2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantVendors, createVendor, updateVendor, deleteVendor,
  type DbVendor, type DpaStatus, type TransferMechanism,
} from './vendorsApi';

const DPA_LABEL: Record<DpaStatus, string> = {
  none: 'Kein DPA', requested: 'Angefragt', signed: 'Unterzeichnet', expired: 'Abgelaufen', not_required: 'Nicht erforderlich',
};
const DPA_CLS: Record<DpaStatus, string> = {
  none:         'bg-rose-500/15 text-rose-200 border-rose-500/40',
  requested:    'bg-amber-500/15 text-amber-200 border-amber-500/40',
  signed:       'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  expired:      'bg-rose-500/15 text-rose-200 border-rose-500/40',
  not_required: 'bg-titanium-800/30 text-titanium-300 border-titanium-700',
};

export function VendorInventoryView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<DbVendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DbVendor | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    try { setItems(await fetchTenantVendors(activeTenantId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const total = items?.length ?? 0;
  const noDpa = (items ?? []).filter((v) => ['none', 'requested', 'expired'].includes(v.dpa_status)).length;
  const sccUS = (items ?? []).filter((v) => v.country === 'US' && v.transfer_mechanism !== 'scc' && v.transfer_mechanism !== 'adequacy').length;
  const soonExpiring = (items ?? []).filter((v) => v.dpa_expires_at && new Date(v.dpa_expires_at).getTime() - Date.now() < 30 * 24 * 3600 * 1000 && v.dpa_status === 'signed').length;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center"><Building2 className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Vendor Inventory</div>
              <div className="text-[11px] text-titanium-400">Sub-Processor · DPA · Art. 28 GDPR</div>
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
            <Plus className="h-4 w-4" /> Neuer Vendor
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Metric label="Vendors" value={total} />
          <Metric label="Kein gültiger DPA" value={noDpa} tone={noDpa > 0 ? 'danger' : undefined} />
          <Metric label="US ohne SCC/Adequacy" value={sccUS} tone={sccUS > 0 ? 'danger' : undefined} />
          <Metric label="DPA läuft in 30 Tg." value={soonExpiring} tone={soonExpiring > 0 ? 'warn' : undefined} />
        </div>

        {!activeTenantId ? <div className="text-titanium-500 text-sm">Tenant wählen.</div>
          : items === null ? <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>
          : items.length === 0 ? <div className="text-center py-16"><Building2 className="h-8 w-8 mx-auto text-titanium-600 mb-3" /><p className="text-sm text-titanium-400">Keine Vendors erfasst.</p></div>
          : <ul className="space-y-2">{items.map((v) => <Row key={v.id} v={v} onClick={() => setEditing(v)} onReload={reload} />)}</ul>}
      </main>

      {(creating || editing) && activeTenantId && (
        <Modal tenantId={activeTenantId} vendor={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); void reload(); }} />
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

function Row({ v, onClick, onReload }: { v: DbVendor; onClick: () => void; onReload: () => void }) {
  return <li className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className="flex items-start justify-between gap-3">
      <div onClick={onClick} className="min-w-0 cursor-pointer flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-titanium-50 text-sm">{v.name}</span>
          {v.country && <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-400">{v.country}</span>}
        </div>
        <div className="text-[11px] text-titanium-400 mt-0.5">
          Transfer: <span className="font-mono uppercase">{v.transfer_mechanism}</span>
          {v.data_types_processed.length > 0 && <> · Data: {v.data_types_processed.slice(0, 3).join(', ')}</>}
        </div>
        {v.dpa_expires_at && <div className="text-[11px] text-titanium-500 mt-0.5">DPA bis {new Date(v.dpa_expires_at).toLocaleDateString('de-DE')}</div>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`shrink-0 border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${DPA_CLS[v.dpa_status]}`}>{DPA_LABEL[v.dpa_status]}</span>
        <button onClick={async () => { if (confirm(`Vendor "${v.name}" löschen?`)) { await deleteVendor(v.id); onReload(); } }}
          className="p-1.5 text-titanium-400 hover:text-red-300 hover:bg-obsidian-800 rounded-none" aria-label="Löschen">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </li>;
}

function Modal({ tenantId, vendor, onClose, onSaved }: { tenantId: string; vendor: DbVendor | null; onClose: () => void; onSaved: () => void; }) {
  const isNew = !vendor;
  const [name, setName] = useState(vendor?.name ?? '');
  const [country, setCountry] = useState(vendor?.country ?? '');
  const [website, setWebsite] = useState(vendor?.website ?? '');
  const [dpaStatus, setDpaStatus] = useState<DpaStatus>(vendor?.dpa_status ?? 'none');
  const [transferMechanism, setTransferMechanism] = useState<TransferMechanism>(vendor?.transfer_mechanism ?? 'unknown');
  const [riskLevel, setRiskLevel] = useState(vendor?.risk_level ?? 'medium');
  const [dataTypes, setDataTypes] = useState((vendor?.data_types_processed ?? []).join(', '));
  const [purposes, setPurposes] = useState((vendor?.processing_purposes ?? []).join(', '));
  const [subProc, setSubProc] = useState((vendor?.sub_processors ?? []).join(', '));
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    const payload = {
      name: name.trim(), country: country || null, website: website || null,
      dpa_status: dpaStatus, transfer_mechanism: transferMechanism, risk_level: riskLevel,
      data_types_processed: dataTypes.split(',').map((s) => s.trim()).filter(Boolean),
      processing_purposes: purposes.split(',').map((s) => s.trim()).filter(Boolean),
      sub_processors: subProc.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes || null,
    };
    const r = isNew
      ? await createVendor({ tenant_id: tenantId, ...payload })
      : await updateVendor(vendor!.id, payload);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Speichern fehlgeschlagen'); return; }
    onSaved();
  };

  return <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none w-full max-w-xl max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-titanium-900 sticky top-0 bg-obsidian-900">
        <h2 className="font-display font-bold text-titanium-50">{isNew ? 'Neuer Vendor' : 'Vendor bearbeiten'}</h2>
        <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <Field label="Name"><input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Land (ISO)"><input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="DE / US / IE" maxLength={3} className={inputCls} /></Field>
          <Field label="Website"><input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="DPA-Status">
            <select value={dpaStatus} onChange={(e) => setDpaStatus(e.target.value as DpaStatus)} className={inputCls}>
              {(Object.keys(DPA_LABEL) as DpaStatus[]).map((s) => <option key={s} value={s}>{DPA_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Transfer">
            <select value={transferMechanism} onChange={(e) => setTransferMechanism(e.target.value as TransferMechanism)} className={inputCls}>
              {(['adequacy','scc','bcr','derogation','none','unknown'] as TransferMechanism[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Risk">
            <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as DbVendor['risk_level'])} className={inputCls}>
              {(['low','medium','high','critical'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Verarbeitete Datentypen (kommagetrennt)"><input type="text" value={dataTypes} onChange={(e) => setDataTypes(e.target.value)} placeholder="customer_data, ip_address" className={inputCls} /></Field>
        <Field label="Zwecke (kommagetrennt)"><input type="text" value={purposes} onChange={(e) => setPurposes(e.target.value)} placeholder="analytics, ai_inference" className={inputCls} /></Field>
        <Field label="Sub-Processors (kommagetrennt)"><input type="text" value={subProc} onChange={(e) => setSubProc(e.target.value)} placeholder="Microsoft Azure" className={inputCls} /></Field>
        <Field label="Notizen"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></Field>
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
