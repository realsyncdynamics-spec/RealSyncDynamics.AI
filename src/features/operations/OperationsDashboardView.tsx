import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, MapPin, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import {
  listItems, listLocations, listSuppliers, listStockLevels, listMovements,
} from './api';
import type {
  InventoryItem, InventoryLocation, InventorySupplier,
  InventoryStockLevel, InventoryMovement,
} from './types';

interface LowStockRow {
  item: InventoryItem;
  total: number;
}

export function OperationsDashboardView() {
  return (
    <OperationsShell title="Operations Runtime" subtitle="Inventar · Bewegungen · Audit">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[] | null>(null);
  const [suppliers, setSuppliers] = useState<InventorySupplier[] | null>(null);
  const [levels, setLevels] = useState<InventoryStockLevel[] | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([
      listItems(activeTenantId),
      listLocations(activeTenantId),
      listSuppliers(activeTenantId),
      listStockLevels(activeTenantId),
      listMovements(activeTenantId, 5),
    ])
      .then(([i, l, s, st, m]) => {
        setItems(i); setLocations(l); setSuppliers(s); setLevels(st); setMovements(m);
      })
      .catch((err: Error) => setError(err.message));
  }, [activeTenantId]);

  if (!activeTenantId) {
    return <p className="text-sm text-titanium-400">Bitte einen Tenant auswählen.</p>;
  }
  if (error) {
    return <p className="text-sm text-red-300">Fehler: {error}</p>;
  }
  if (items === null || levels === null || movements === null) {
    return <div className="flex items-center gap-2 text-titanium-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Lade …</div>;
  }

  const lowStock: LowStockRow[] = items
    .filter((i) => i.is_active)
    .map((item) => {
      const total = levels
        .filter((l) => l.item_id === item.id)
        .reduce((sum, l) => sum + Number(l.quantity), 0);
      return { item, total };
    })
    .filter(({ item, total }) => item.reorder_level > 0 && total <= item.reorder_level)
    .sort((a, b) => a.total - b.total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile to="/operations/items"           icon={<Package className="h-4 w-4" />}        label="Artikel"      value={items.length} />
        <KpiTile to="/operations/locations"       icon={<MapPin className="h-4 w-4" />}         label="Lagerorte"    value={locations?.length ?? 0} />
        <KpiTile to="/operations/suppliers"       icon={<Building2 className="h-4 w-4" />}      label="Lieferanten"  value={suppliers?.length ?? 0} />
        <KpiTile to="/operations/reports"         icon={<AlertTriangle className="h-4 w-4" />}  label="Mindestbestand" value={lowStock.length} tone={lowStock.length > 0 ? 'warn' : 'ok'} />
      </div>

      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-titanium-50">Mindestbestand unterschritten</h2>
          <Link to="/operations/items" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">
            Artikel <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {lowStock.length === 0 ? (
          <p className="px-4 py-3 text-sm text-titanium-400">Keine Artikel unterhalb des Mindestbestands.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-obsidian-950 text-[11px] uppercase tracking-wider text-titanium-400">
              <tr>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Bezeichnung</th>
                <th className="text-right px-3 py-2">Bestand</th>
                <th className="text-right px-3 py-2">Mindest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-900">
              {lowStock.map(({ item, total }) => (
                <tr key={item.id} className="hover:bg-obsidian-950">
                  <td className="px-3 py-2 font-mono text-xs text-titanium-200">{item.sku}</td>
                  <td className="px-3 py-2 text-titanium-100">{item.name}</td>
                  <td className="px-3 py-2 text-right text-amber-300">{total} {item.unit}</td>
                  <td className="px-3 py-2 text-right text-titanium-400">{item.reorder_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-obsidian-900 border border-titanium-900">
        <header className="px-4 py-2.5 border-b border-titanium-900 flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-titanium-50">Letzte Bewegungen</h2>
          <Link to="/operations/stock-movements" className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1">
            Alle <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {movements.length === 0 ? (
          <p className="px-4 py-3 text-sm text-titanium-400">Noch keine Bewegungen erfasst.</p>
        ) : (
          <ul className="divide-y divide-titanium-900 text-sm">
            {movements.map((m) => {
              const item = items.find((i) => i.id === m.item_id);
              return (
                <li key={m.id} className="px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-titanium-300">{m.kind}</span>{' '}
                    <span className="text-titanium-100">{item?.name ?? m.item_id}</span>
                    {m.reason && <span className="text-titanium-500 text-xs ml-2">· {m.reason}</span>}
                  </div>
                  <div className={`font-mono text-xs ${m.quantity < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiTile({
  to, icon, label, value, tone = 'neutral',
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const accent =
    tone === 'warn' ? 'text-amber-300'
    : tone === 'ok' ? 'text-emerald-300'
    : 'text-titanium-50';
  return (
    <Link to={to} className="bg-obsidian-900 border border-titanium-900 p-3 hover:border-cyan-700 transition-colors block">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-titanium-400 mb-1">
        {icon}{label}
      </div>
      <div className={`font-display font-bold text-2xl ${accent}`}>{value}</div>
    </Link>
  );
}
