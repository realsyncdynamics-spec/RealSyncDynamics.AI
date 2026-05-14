import { useEffect, useState } from 'react';
import { Plus, ArrowDownToLine, ArrowUpFromLine, RefreshCcw } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { Modal, Loader } from './InventoryItemsView';
import {
  listMovements, bookMovement, listItems, listLocations,
} from './api';
import type {
  InventoryItem, InventoryLocation, InventoryMovement, MovementKind,
} from './types';

export function StockMovementsView() {
  return (
    <OperationsShell title="Lager­bewegungen" subtitle="Wareneingang · Warenausgang · Korrekturen">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<MovementKind | null>(null);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listMovements(activeTenantId, 200),
      listItems(activeTenantId),
      listLocations(activeTenantId),
    ])
      .then(([m, i, l]) => { setMovements(m); setItems(i); setLocations(l); })
      .catch((e: Error) => setError(e.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (movements === null) return <Loader />;

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-titanium-400">{movements.length} Bewegungen</p>
        <div className="flex gap-2">
          <Btn onClick={() => setBooking('inbound')}    icon={<ArrowDownToLine className="h-4 w-4" />} label="Wareneingang"  tone="emerald" />
          <Btn onClick={() => setBooking('outbound')}   icon={<ArrowUpFromLine className="h-4 w-4" />} label="Warenausgang"  tone="amber" />
          <Btn onClick={() => setBooking('adjustment')} icon={<RefreshCcw className="h-4 w-4" />}     label="Korrektur"     tone="cyan" />
        </div>
      </div>

      {movements.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Bewegungen gebucht.
        </p>
      ) : (
        <table className="w-full text-sm bg-obsidian-900 border border-titanium-900">
          <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
            <tr>
              <th className="text-left px-3 py-2">Zeit</th>
              <th className="text-left px-3 py-2">Typ</th>
              <th className="text-left px-3 py-2">Artikel</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">Lagerort</th>
              <th className="text-right px-3 py-2">Menge</th>
              <th className="text-left px-3 py-2 hidden lg:table-cell">Referenz</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-titanium-900">
            {movements.map((m) => {
              const item = itemMap.get(m.item_id);
              const loc = locMap.get(m.location_id);
              return (
                <tr key={m.id} className="hover:bg-obsidian-950">
                  <td className="px-3 py-2 text-titanium-400 text-xs font-mono">{new Date(m.occurred_at).toLocaleString('de-DE')}</td>
                  <td className="px-3 py-2 text-titanium-300 text-xs">{m.kind}</td>
                  <td className="px-3 py-2 text-titanium-100">{item?.name ?? m.item_id}</td>
                  <td className="px-3 py-2 text-titanium-400 text-xs hidden md:table-cell">{loc?.name ?? m.location_id}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs ${m.quantity < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity} {item?.unit ?? ''}
                  </td>
                  <td className="px-3 py-2 text-titanium-400 text-xs hidden lg:table-cell">{m.reference ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {booking && (
        <BookMovementModal
          tenantId={activeTenantId}
          kind={booking}
          items={items}
          locations={locations}
          onClose={() => setBooking(null)}
          onBooked={() => { setBooking(null); reload(); }}
        />
      )}
    </div>
  );
}

function Btn({ onClick, icon, label, tone }: { onClick: () => void; icon: React.ReactNode; label: string; tone: 'emerald'|'amber'|'cyan' }) {
  const cls = tone === 'emerald'
    ? 'bg-emerald-500 hover:bg-emerald-400'
    : tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-400'
      : 'bg-cyan-500 hover:bg-cyan-400';
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${cls} text-obsidian-950 text-sm font-semibold rounded-none`}>
      {icon}{label}
    </button>
  );
}

function BookMovementModal({
  tenantId, kind, items, locations, onClose, onBooked,
}: {
  tenantId: string;
  kind: MovementKind;
  items: InventoryItem[];
  locations: InventoryLocation[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await bookMovement(tenantId, {
        item_id: itemId,
        location_id: locationId,
        kind,
        quantity,
        reason: reason.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Buchung fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-cyan-500 outline-none';
  const titleMap: Record<MovementKind, string> = {
    inbound: 'Wareneingang buchen',
    outbound: 'Warenausgang buchen',
    adjustment: 'Bestands­korrektur',
    transfer: 'Umlagerung',
  };

  if (items.length === 0 || locations.length === 0) {
    return (
      <Modal title={titleMap[kind]} onClose={onClose}>
        <p className="text-sm text-amber-300">
          Vorab erforderlich: mindestens ein Artikel und ein Lagerort.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title={titleMap[kind]} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Artikel <span className="text-red-400">*</span></span>
          <select required value={itemId} onChange={(e) => setItemId(e.target.value)} className={input}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}
          </select>
        </label>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Lagerort <span className="text-red-400">*</span></span>
          <select required value={locationId} onChange={(e) => setLocationId(e.target.value)} className={input}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Menge <span className="text-red-400">*</span></span>
            <input
              type="number" step="0.001" required value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Referenz (Beleg)</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={input} placeholder="PO-2025-0001" />
          </label>
        </div>
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Begründung</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
        </label>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !itemId || !locationId || !quantity}
            className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? 'Buche…' : 'Buchen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
