import { useEffect, useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { listItems, createItem, listSuppliers, listStockLevels } from './api';
import type { InventoryItem, InventorySupplier, InventoryStockLevel } from './types';

export function InventoryItemsView() {
  return (
    <OperationsShell title="Artikel" subtitle="Inventar-Stamm­daten">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [levels, setLevels] = useState<InventoryStockLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listItems(activeTenantId),
      listSuppliers(activeTenantId),
      listStockLevels(activeTenantId),
    ])
      .then(([i, s, l]) => { setItems(i); setSuppliers(s); setLevels(l); })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (items === null) return <Loader />;

  const totalsByItem = new Map<string, number>();
  for (const l of levels) {
    totalsByItem.set(l.item_id, (totalsByItem.get(l.item_id) ?? 0) + Number(l.quantity));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{items.length} Artikel</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" /> Neuer Artikel
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyHint onCreate={() => setCreating(true)} />
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm bg-obsidian-900 border border-titanium-900 min-w-[360px]">
          <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
            <tr>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Bezeichnung</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Einheit</th>
              <th className="text-right px-3 py-2">Bestand</th>
              <th className="text-right px-3 py-2">Mindest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {items.map((it) => {
              const total = totalsByItem.get(it.id) ?? 0;
              const low = it.reorder_level > 0 && total <= it.reorder_level;
              return (
                <tr key={it.id} className="hover:bg-obsidian-950">
                  <td className="px-3 py-2 font-mono text-xs text-titanium-200">{it.sku}</td>
                  <td className="px-3 py-2 text-titanium-100">{it.name}</td>
                  <td className="px-3 py-2 text-titanium-400 text-xs hidden md:table-cell">{it.unit}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${low ? 'text-amber-300' : 'text-emerald-300'}`}>{total}</td>
                  <td className="px-3 py-2 text-right text-titanium-400 text-xs">{it.reorder_level}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {creating && (
        <CreateItemModal
          tenantId={activeTenantId}
          suppliers={suppliers}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateItemModal({
  tenantId, suppliers, onClose, onCreated,
}: {
  tenantId: string;
  suppliers: InventorySupplier[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [reorderLevel, setReorderLevel] = useState(0);
  const [supplierId, setSupplierId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createItem(tenantId, {
        sku: sku.trim(),
        name: name.trim(),
        unit: unit.trim() || 'pcs',
        reorder_level: reorderLevel,
        default_supplier_id: supplierId || null,
        description: description.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen');
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Neuer Artikel">
      <form onSubmit={submit} className="space-y-3">
        <FieldRow>
          <Field label="SKU" required>
            <input required value={sku} onChange={(e) => setSku(e.target.value)} className={INPUT} />
          </Field>
          <Field label="Einheit">
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs / kg / l" className={INPUT} />
          </Field>
        </FieldRow>
        <Field label="Bezeichnung" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <FieldRow>
          <Field label="Mindestbestand">
            <input
              type="number" min={0} value={reorderLevel}
              onChange={(e) => setReorderLevel(Number(e.target.value))}
              className={INPUT}
            />
          </Field>
          <Field label="Standard-Lieferant">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={INPUT}>
              <option value="">— kein —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </FieldRow>
        <Field label="Beschreibung (optional)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={INPUT} />
        </Field>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !sku || !name}
            className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? 'Speichere…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const INPUT = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-cyan-500 outline-none';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="block text-titanium-400 mb-1">{label}{required && <span className="text-red-400"> *</span>}</span>
      {children}
    </label>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-900 border border-titanium-900 w-full max-w-lg shadow-xl">
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-titanium-900">
          <h3 className="font-display font-bold text-sm text-titanium-50">{title}</h3>
          <button onClick={onClose} className="text-titanium-400 hover:text-titanium-200"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function Loader() {
  return <div className="flex items-center gap-2 text-titanium-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>;
}

function EmptyHint({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 p-6 text-center">
      <p className="text-sm text-titanium-400 mb-3">Noch keine Artikel angelegt.</p>
      <button onClick={onCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400">
        <Plus className="h-4 w-4" /> Ersten Artikel anlegen
      </button>
    </div>
  );
}
