import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldAlert, Plus, Loader2, AlertTriangle, X, Trash2, Pencil,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  listRiskInventory, createRiskInventory, updateRiskInventory, deleteRiskInventory,
  SEVERITY_LABEL, SEVERITY_ORDER,
  type InventoryItem, type Severity,
} from './aiActRiskInventoryApi';

const SEVERITY_CLS: Record<Severity, string> = {
  prohibited: 'bg-red-500/15 text-red-200 border-red-500/40',
  high:       'bg-orange-500/15 text-orange-200 border-orange-500/40',
  limited:    'bg-amber-500/15 text-amber-200 border-amber-500/40',
  minimal:    'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
};

export function AiActRiskInventoryView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Severity | 'all'>('all');

  const reload = async () => {
    if (!activeTenantId) { setItems([]); return; }
    setError(null); setItems(null);
    const r = await listRiskInventory(activeTenantId);
    if (!r.ok) setError(r.error?.message ?? 'Laden fehlgeschlagen');
    else       setItems(r.items ?? []);
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const list = filter === 'all' ? items : items.filter((it) => it.severity === filter);
    return [...list].sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || (b.created_at.localeCompare(a.created_at))
    );
  }, [items, filter]);

  const counts = useMemo(() => {
    const base: Record<Severity, number> = { prohibited: 0, high: 0, limited: 0, minimal: 0 };
    (items ?? []).forEach((it) => { base[it.severity] += 1; });
    return base;
  }, [items]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/governance/admin"
            className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-sm">
              <ShieldAlert className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
                KI-Risiko-Inventar
              </div>
              <div className="text-[11px] text-titanium-400 font-medium">
                EU-AI-Act-Klassifikation (Art. 5 / Annex III / Art. 50)
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer max-w-[200px]"
            >
              {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
            </select>
          )}
          <Link
            to="/ai-act-klassifikator"
            className="px-3 py-1.5 border border-titanium-700 text-titanium-200 text-xs font-mono uppercase tracking-wider hover:bg-obsidian-800"
            title="Wizard für deterministische Klassifikation"
          >
            Klassifikator öffnen
          </Link>
          <button
            onClick={() => setCreating(true)}
            disabled={!activeTenantId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-security-500 text-white text-sm font-semibold rounded-none hover:bg-security-400 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Neuer Eintrag
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Severity-Counters als Filter-Pyramide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {(['prohibited', 'high', 'limited', 'minimal'] as const).map((sev) => {
            const active = filter === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setFilter(active ? 'all' : sev)}
                className={`text-left p-3 border ${active ? 'border-security-500 bg-security-500/10' : 'border-titanium-900 bg-obsidian-900/40 hover:border-titanium-700'} transition-colors`}
              >
                <div className={`inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border ${SEVERITY_CLS[sev]}`}>
                  {SEVERITY_LABEL[sev]}
                </div>
                <div className="mt-2 font-display text-2xl text-titanium-50">{counts[sev]}</div>
              </button>
            );
          })}
        </div>

        {filter !== 'all' && (
          <div className="mb-4 flex items-center justify-between text-xs text-titanium-400">
            <span>Filter aktiv: <strong className="text-titanium-100">{SEVERITY_LABEL[filter]}</strong></span>
            <button onClick={() => setFilter('all')} className="text-security-400 hover:text-security-300 underline">Filter zurücksetzen</button>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : filtered === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-titanium-900 bg-obsidian-900/40">
            <ShieldAlert className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
            <p className="text-sm text-titanium-400 mb-3">
              {filter === 'all' ? 'Noch keine KI-Systeme klassifiziert.' : 'Keine Einträge mit diesem Risiko.'}
            </p>
            <Link
              to="/ai-act-klassifikator"
              className="inline-block px-4 py-2 bg-security-500 text-white text-sm font-semibold hover:bg-security-400"
            >
              Wizard starten →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((it) => (
              <Row
                key={it.id}
                item={it}
                onEdit={() => setEditing(it)}
                onDelete={async () => {
                  if (!confirm(`Eintrag "${it.name}" wirklich löschen?`)) return;
                  const r = await deleteRiskInventory(it.id);
                  if (!r.ok) setError(r.error?.message ?? 'Löschen fehlgeschlagen');
                  else void reload();
                }}
              />
            ))}
          </ul>
        )}
      </main>

      {(creating || editing) && activeTenantId && (
        <EditModal
          tenantId={activeTenantId}
          item={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
}

function Row({
  item, onEdit, onDelete,
}: {
  item: InventoryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="border border-titanium-900 bg-obsidian-900/60 p-3 hover:border-security-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-titanium-50 text-sm">{item.name}</span>
            <span className={`border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${SEVERITY_CLS[item.severity]}`}>
              {SEVERITY_LABEL[item.severity]}
            </span>
            {item.has_prohibited_overlay && (
              <span className="border border-orange-500/40 text-orange-200 px-1.5 py-0.5 text-[10px] font-mono uppercase">
                Art.5-Overlay
              </span>
            )}
          </div>
          {item.description && (
            <div className="text-xs text-titanium-400 mt-1 line-clamp-2">{item.description}</div>
          )}
          <div className="text-[11px] text-titanium-500 mt-1 flex gap-3 flex-wrap font-mono">
            {item.matched_use_cases.length > 0 && (
              <span>{item.matched_use_cases.length} Use-Case{item.matched_use_cases.length === 1 ? '' : 's'}</span>
            )}
            {item.confidence_score != null && <span>Confidence: {item.confidence_score}%</span>}
            {item.registry_version && <span>Registry: {item.registry_version}</span>}
            <span>Erfasst: {new Date(item.created_at).toLocaleDateString('de-DE')}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800" title="Bearbeiten">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-titanium-400 hover:text-red-300 hover:bg-obsidian-800" title="Löschen">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditModal({
  tenantId, item, onClose, onSaved,
}: {
  tenantId: string;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !item;
  const [name, setName]               = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [severity, setSeverity]       = useState<Severity>(item?.severity ?? 'minimal');
  const [notes, setNotes]             = useState(item?.notes ?? '');
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr('Name ist erforderlich'); return; }
    setSaving(true);
    try {
      const r = isNew
        ? await createRiskInventory({
            tenant_id: tenantId,
            name: name.trim(),
            description: description.trim() || undefined,
            severity,
            notes: notes.trim() || undefined,
          })
        : await updateRiskInventory({
            id: item.id,
            name: name.trim(),
            description: description.trim() || undefined,
            severity,
            notes: notes.trim() || undefined,
          });
      if (!r.ok) {
        setErr(r.error?.message ?? 'Speichern fehlgeschlagen');
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-obsidian-900 border border-titanium-800 w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-titanium-900 px-4 py-3">
          <h2 className="font-display font-bold text-sm text-titanium-50">
            {isNew ? 'Neues KI-System erfassen' : 'KI-System bearbeiten'}
          </h2>
          <button onClick={onClose} className="text-titanium-400 hover:text-titanium-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Field label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. ATS mit ML-CV-Ranking"
              className="w-full bg-obsidian-950 border border-titanium-800 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-security-500"
            />
          </Field>

          <Field label="Beschreibung">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Was tut das System? In welchem Kontext wird es eingesetzt?"
              className="w-full bg-obsidian-950 border border-titanium-800 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-security-500 resize-y"
            />
          </Field>

          <Field label="Risiko-Klasse *">
            <div className="grid grid-cols-2 gap-2">
              {(['prohibited', 'high', 'limited', 'minimal'] as const).map((s) => {
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`p-2 text-left border text-xs ${active ? `${SEVERITY_CLS[s]} border-current` : 'border-titanium-800 text-titanium-300 hover:border-titanium-600'}`}
                  >
                    <div className="font-mono uppercase tracking-wider text-[10px]">{SEVERITY_LABEL[s]}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notizen">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional: Begründung, DPIA-Verweis, interne Kennungen…"
              className="w-full bg-obsidian-950 border border-titanium-800 px-3 py-2 text-sm text-titanium-100 outline-none focus:border-security-500 resize-y"
            />
          </Field>

          {item?.matched_use_cases && item.matched_use_cases.length > 0 && (
            <div className="border-t border-titanium-900 pt-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-1">
                Snapshot aus Wizard ({item.matched_use_cases.length} Use-Cases)
              </div>
              <ul className="text-xs text-titanium-300 space-y-1">
                {item.matched_use_cases.map((uc) => (
                  <li key={uc.id}>· {uc.title}</li>
                ))}
              </ul>
            </div>
          )}

          {err && (
            <div className="text-xs text-red-300 bg-red-950/40 border border-red-900 p-2">{err}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-titanium-900 px-4 py-3">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 bg-security-500 text-white text-xs font-semibold hover:bg-security-400 disabled:opacity-50"
          >
            {saving ? 'Speichere…' : (isNew ? 'Anlegen' : 'Speichern')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
