import { useEffect, useState } from 'react';
import { AlertTriangle, ScrollText } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { Loader } from './InventoryItemsView';
import {
  listAuditEvents, listItems, listStockLevels,
} from './api';
import type {
  InventoryAuditEvent, InventoryItem, InventoryStockLevel,
} from './types';

export function OperationsReportsView() {
  return (
    <OperationsShell title="Reports" subtitle="Audit-Trail · Mindestbestand">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [events, setEvents] = useState<InventoryAuditEvent[] | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [levels, setLevels] = useState<InventoryStockLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listAuditEvents(activeTenantId, 200),
      listItems(activeTenantId),
      listStockLevels(activeTenantId),
    ])
      .then(([e, i, l]) => { setEvents(e); setItems(i); setLevels(l); })
      .catch((err: Error) => setError(err.message));
  }, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (events === null) return <Loader />;

  const totals = new Map<string, number>();
  for (const l of levels) totals.set(l.item_id, (totals.get(l.item_id) ?? 0) + Number(l.quantity));
  const lowStock = items
    .filter((i) => i.is_active && i.reorder_level > 0)
    .map((item) => ({ item, total: totals.get(item.id) ?? 0 }))
    .filter(({ item, total }) => total <= item.reorder_level)
    .sort((a, b) => a.total - b.total);

  return (
    <div className="space-y-6">
      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h2 className="font-display font-bold text-sm text-titanium-50">Mindestbestand-Report</h2>
        </header>
        {lowStock.length === 0 ? (
          <p className="px-4 py-3 text-sm text-emerald-300">Alle Artikel über Mindestbestand.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
              <tr>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Artikel</th>
                <th className="text-right px-3 py-2">Bestand</th>
                <th className="text-right px-3 py-2">Mindest</th>
                <th className="text-right px-3 py-2">Differenz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-900">
              {lowStock.map(({ item, total }) => (
                <tr key={item.id} className="hover:bg-obsidian-950">
                  <td className="px-3 py-2 font-mono text-xs text-titanium-200">{item.sku}</td>
                  <td className="px-3 py-2 text-titanium-100">{item.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">{total}</td>
                  <td className="px-3 py-2 text-right text-titanium-400 text-xs">{item.reorder_level}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-red-300">{total - item.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-cyan-400" />
          <h2 className="font-display font-bold text-sm text-titanium-50">Audit-Trail</h2>
        </header>
        {events.length === 0 ? (
          <p className="px-4 py-3 text-sm text-titanium-400">Noch keine Audit-Events.</p>
        ) : (
          <ul className="divide-y divide-titanium-900 text-sm max-h-[600px] overflow-y-auto">
            {events.map((ev) => (
              <li key={ev.id} className="px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-mono text-[11px] text-titanium-300">{ev.action}</div>
                  <div className="text-[11px] text-titanium-500 font-mono">
                    {new Date(ev.occurred_at).toLocaleString('de-DE')}
                  </div>
                </div>
                <div className="text-xs text-titanium-400 mt-0.5">
                  {ev.target_type}
                  {ev.target_id && <span className="text-titanium-600"> · {ev.target_id.slice(0, 8)}</span>}
                  {ev.reason && <span className="text-titanium-500"> · {ev.reason}</span>}
                  <span className="text-titanium-600"> · source={ev.source}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
