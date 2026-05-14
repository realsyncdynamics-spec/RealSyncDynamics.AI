import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { Modal, Loader } from './InventoryItemsView';
import { listSuppliers, createSupplier } from './api';
import type { InventorySupplier } from './types';

export function SuppliersView() {
  return (
    <OperationsShell title="Lieferanten" subtitle="Beschaffungs-Stamm­daten">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [suppliers, setSuppliers] = useState<InventorySupplier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    listSuppliers(activeTenantId).then(setSuppliers).catch((e: Error) => setError(e.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (suppliers === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{suppliers.length} Lieferanten</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400"
        >
          <Plus className="h-4 w-4" /> Neuer Lieferant
        </button>
      </div>

      {suppliers.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Lieferanten angelegt.
        </p>
      ) : (
        <table className="w-full text-sm bg-obsidian-900 border border-titanium-900">
          <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Kontakt</th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-obsidian-950">
                <td className="px-3 py-2 font-mono text-xs text-titanium-200">{s.code}</td>
                <td className="px-3 py-2 text-titanium-100">{s.name}</td>
                <td className="px-3 py-2 text-titanium-400 text-xs hidden md:table-cell">{s.contact_name ?? '—'}</td>
                <td className="px-3 py-2 text-titanium-400 text-xs hidden lg:table-cell">{s.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <CreateSupplierModal
          tenantId={activeTenantId}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateSupplierModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createSupplier(tenantId, {
        code: code.trim(), name: name.trim(),
        contact_name: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-cyan-500 outline-none';

  return (
    <Modal onClose={onClose} title="Neuer Lieferant">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Code <span className="text-red-400">*</span></span>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className={input} />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Name <span className="text-red-400">*</span></span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Ansprechpartner</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={input} />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Telefon</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Adresse</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          </label>
        </div>
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
