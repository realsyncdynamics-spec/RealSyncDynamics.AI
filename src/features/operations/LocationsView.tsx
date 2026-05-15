import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { Modal, Loader } from './InventoryItemsView';
import { listLocations, createLocation } from './api';
import type { InventoryLocation, LocationKind } from './types';

const KINDS: { value: LocationKind; label: string }[] = [
  { value: 'warehouse', label: 'Lager' },
  { value: 'shop',      label: 'Filiale' },
  { value: 'mobile',    label: 'Mobil' },
  { value: 'virtual',   label: 'Virtuell' },
];

export function LocationsView() {
  return (
    <OperationsShell title="Lagerorte" subtitle="Standorte & Bestände">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [locations, setLocations] = useState<InventoryLocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    listLocations(activeTenantId).then(setLocations).catch((e: Error) => setError(e.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (locations === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{locations.length} Lagerorte</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" /> Neuer Lagerort
        </button>
      </div>

      {locations.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Lagerorte angelegt.
        </p>
      ) : (
        <table className="w-full text-sm bg-obsidian-900 border border-titanium-900">
          <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Typ</th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">Adresse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {locations.map((l) => (
              <tr key={l.id} className="hover:bg-obsidian-950">
                <td className="px-3 py-2 font-mono text-xs text-titanium-200">{l.code}</td>
                <td className="px-3 py-2 text-titanium-100">{l.name}</td>
                <td className="px-3 py-2 text-titanium-400 text-xs hidden md:table-cell">{kindLabel(l.kind)}</td>
                <td className="px-3 py-2 text-titanium-400 text-xs hidden lg:table-cell">{l.address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <CreateLocationModal
          tenantId={activeTenantId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function kindLabel(k: LocationKind) {
  return KINDS.find((x) => x.value === k)?.label ?? k;
}

function CreateLocationModal({
  tenantId, onClose, onCreated,
}: {
  tenantId: string; onClose: () => void; onCreated: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('warehouse');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createLocation(tenantId, {
        code: code.trim(),
        name: name.trim(),
        kind,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-cyan-500 outline-none';

  return (
    <Modal onClose={onClose} title="Neuer Lagerort">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Code <span className="text-red-400">*</span></span>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className={input} placeholder="WH1" />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Typ</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as LocationKind)} className={input}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Name <span className="text-red-400">*</span></span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Adresse</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Notizen</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={input} />
        </label>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !code || !name}
            className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? 'Speichere…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
