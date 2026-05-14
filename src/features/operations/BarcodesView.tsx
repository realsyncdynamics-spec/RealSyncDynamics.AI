import { useEffect, useState } from 'react';
import { Plus, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { OperationsShell, useOperationsTenant } from './OperationsShell';
import { Modal, Loader } from './InventoryItemsView';
import { listBarcodes, createBarcode, listItems } from './api';
import type { InventoryBarcode, BarcodeSymbology, InventoryItem } from './types';

const SYMBOLOGIES: BarcodeSymbology[] = ['qr', 'datamatrix', 'ean13', 'code128', 'code39', 'custom'];

export function BarcodesView() {
  return (
    <OperationsShell title="Barcodes" subtitle="QR · EAN · Code-128">
      <Inner />
    </OperationsShell>
  );
}

function Inner() {
  const { activeTenantId } = useOperationsTenant();
  const [barcodes, setBarcodes] = useState<InventoryBarcode[] | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    if (!activeTenantId) return;
    setError(null);
    Promise.all([listBarcodes(activeTenantId), listItems(activeTenantId)])
      .then(([b, i]) => { setBarcodes(b); setItems(i); })
      .catch((e: Error) => setError(e.message));
  };
  useEffect(reload, [activeTenantId]);

  if (!activeTenantId) return <p className="text-sm text-titanium-400">Tenant fehlt.</p>;
  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (barcodes === null) return <Loader />;

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-titanium-400">{barcodes.length} Codes</p>
        <button
          onClick={() => setCreating(true)}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Neuer Code
        </button>
      </div>

      {barcodes.length === 0 ? (
        <p className="text-sm text-titanium-400 bg-obsidian-900 border border-titanium-900 p-6 text-center">
          Noch keine Barcodes hinterlegt.
        </p>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {barcodes.map((b) => {
            const item = itemMap.get(b.item_id);
            return (
              <li key={b.id} className="bg-obsidian-900 border border-titanium-900 p-3 flex flex-col items-center">
                <div className="bg-white p-2 mb-2">
                  <QRCodeSVG value={b.code} size={120} level="M" />
                </div>
                <div className="text-center">
                  <div className="font-display font-bold text-sm text-titanium-50 truncate w-full">{item?.name ?? '—'}</div>
                  <div className="font-mono text-[11px] text-titanium-400 truncate w-full">{b.code}</div>
                  <div className="text-[10px] uppercase tracking-wider text-titanium-500 mt-1">
                    {b.symbology}{b.is_primary && ' · primary'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CreateBarcodeModal
          tenantId={activeTenantId}
          items={items}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function CreateBarcodeModal({
  tenantId, items, onClose, onCreated,
}: {
  tenantId: string;
  items: InventoryItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [symbology, setSymbology] = useState<BarcodeSymbology>('qr');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await createBarcode(tenantId, {
        item_id: itemId,
        code: code.trim(),
        symbology,
        is_primary: isPrimary,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen');
      setSubmitting(false);
    }
  }

  const input = 'w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm rounded-none focus:border-cyan-500 outline-none';

  return (
    <Modal title="Neuer Barcode" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs">
          <span className="block text-titanium-400 mb-1">Artikel <span className="text-red-400">*</span></span>
          <select required value={itemId} onChange={(e) => setItemId(e.target.value)} className={input}>
            {items.map((i) => <option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Code <span className="text-red-400">*</span></span>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className={input} />
          </label>
          <label className="block text-xs">
            <span className="block text-titanium-400 mb-1">Symbology</span>
            <select value={symbology} onChange={(e) => setSymbology(e.target.value as BarcodeSymbology)} className={input}>
              {SYMBOLOGIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-titanium-300">
          <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
          Als Primär-Code markieren
        </label>
        {error && <p className="text-xs text-red-300">{error}</p>}
        {code && (
          <div className="bg-obsidian-950 p-3 flex flex-col items-center gap-2 border border-titanium-900">
            <div className="text-[10px] uppercase tracking-wider text-titanium-500 flex items-center gap-1">
              <QrCode className="h-3 w-3" /> Vorschau
            </div>
            <div className="bg-white p-2">
              <QRCodeSVG value={code} size={100} level="M" />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-titanium-300 hover:text-titanium-100">Abbrechen</button>
          <button
            type="submit"
            disabled={submitting || !itemId || !code}
            className="px-3 py-1.5 bg-cyan-500 text-obsidian-950 text-xs font-semibold rounded-none hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? 'Speichere…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
