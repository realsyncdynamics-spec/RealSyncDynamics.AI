import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Network, Loader2, AlertTriangle, X, Trash2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchTenantAssets, fetchFrameworkControls, fetchTenantMappings,
  type DbGovernanceAsset, type DbFrameworkControl, type DbAssetControlMapping,
} from './governanceApi';
import { upsertMapping, deleteMapping } from './resourcesApi';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';
import type { GovernanceControlStatus } from './types';

/**
 * /governance/mappings — Asset × Framework-Control matrix. Cell
 * click opens a popover to upsert status + notes for that
 * (asset, control) pair. Writes via the governance-resources
 * Edge Function (upsert_mapping / delete_mapping). Reads via
 * tenant-RLS-gated Supabase queries.
 */
function _MappingsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const MappingsView = withPerformanceMonitoring(
  _MappingsView,
  'MappingsView',
  { threshold: 500, maxRenders: 10 }
);

const STATUSES: GovernanceControlStatus[] = ['not_started', 'in_progress', 'implemented', 'gap', 'not_applicable'];

const STATUS_LABEL: Record<GovernanceControlStatus, string> = {
  implemented:    'Implementiert',
  in_progress:    'In Arbeit',
  gap:            'Lücke',
  not_started:    'Offen',
  not_applicable: 'N/A',
};

const STATUS_CLS: Record<GovernanceControlStatus, string> = {
  implemented:     'bg-emerald-500/15 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/25',
  in_progress:     'bg-sky-500/15 text-sky-200 border-sky-500/40 hover:bg-sky-500/25',
  gap:             'bg-rose-500/15 text-rose-200 border-rose-500/40 hover:bg-rose-500/25',
  not_started:     'bg-titanium-800/30 text-titanium-300 border-titanium-700 hover:bg-titanium-800/50',
  not_applicable:  'bg-titanium-900/40 text-titanium-500 border-titanium-800 hover:bg-titanium-800/40',
};

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [assets, setAssets] = useState<DbGovernanceAsset[] | null>(null);
  const [controls, setControls] = useState<DbFrameworkControl[] | null>(null);
  const [mappings, setMappings] = useState<DbAssetControlMapping[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ asset: DbGovernanceAsset; control: DbFrameworkControl; existing: DbAssetControlMapping | null } | null>(null);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    try {
      const [a, c, m] = await Promise.all([
        fetchTenantAssets(activeTenantId),
        fetchFrameworkControls(),
        fetchTenantMappings(activeTenantId),
      ]);
      setAssets(a); setControls(c); setMappings(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const findMapping = (assetId: string, controlId: string) =>
    mappings?.find((m) => m.asset_id === assetId && m.control_id === controlId) ?? null;

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Network className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Asset × Framework Matrix</div>
              <div className="text-[11px] text-titanium-400 font-medium">Implementierungsstatus pro Asset-Control-Paar</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
          >
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Wähle einen Tenant aus.</div>
        ) : assets === null || controls === null || mappings === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Matrix…
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-16">
            <Network className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
            <p className="text-sm text-titanium-400">
              Keine Assets vorhanden. Lege erst ein Asset an, dann kannst Du Framework-Controls zuordnen.
            </p>
            <Link to="/app/websites" className="mt-4 inline-block text-amber-300 hover:text-amber-200 text-sm font-semibold">
              → Zum Dashboard
            </Link>
          </div>
        ) : (
          <div className="border border-titanium-900 bg-obsidian-900/40">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-500 border-b border-titanium-900 bg-obsidian-950/40">
                    <th className="text-left py-2 px-3 sticky left-0 bg-obsidian-950 z-10 min-w-[200px]">Asset</th>
                    {controls.map((c) => (
                      <th key={c.id} className="text-left py-2 px-2 min-w-[110px]">
                        <div className="text-amber-300">{c.framework}</div>
                        <div className="text-titanium-400 font-mono text-[10px]">{c.control_code}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} className="border-b border-titanium-900 align-top">
                      <td className="py-3 px-3 sticky left-0 bg-obsidian-900 z-10 align-top">
                        <div className="text-titanium-50 font-semibold text-sm">{a.name}</div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
                          {a.asset_type} · {a.ai_act_class}
                        </div>
                      </td>
                      {controls.map((c) => {
                        const m = findMapping(a.id, c.id);
                        return (
                          <td key={c.id} className="py-3 px-2 align-top">
                            <button
                              onClick={() => setEditing({ asset: a, control: c, existing: m })}
                              className={`inline-block w-full text-left border px-1.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                                m ? STATUS_CLS[m.status]
                                  : 'border-titanium-800 text-titanium-600 hover:border-amber-500/40 hover:text-amber-300'
                              }`}
                            >
                              {m ? STATUS_LABEL[m.status] : '+ Setzen'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-titanium-900 bg-obsidian-950/40 text-[11px] text-titanium-500 flex flex-wrap items-center gap-3">
              <span>Legende:</span>
              {STATUSES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className={`inline-block w-2.5 h-2.5 border ${STATUS_CLS[s].split(' ').slice(0, 3).join(' ')}`} />
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <MappingEditor
          asset={editing.asset}
          control={editing.control}
          existing={editing.existing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </div>
  );
}

function MappingEditor({
  asset, control, existing, onClose, onSaved,
}: {
  asset: DbGovernanceAsset;
  control: DbFrameworkControl;
  existing: DbAssetControlMapping | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<GovernanceControlStatus>(existing?.status ?? 'in_progress');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null); setBusy(true);
    const r = await upsertMapping(asset.id, control.id, status, notes.trim() || undefined);
    setBusy(false);
    if (!r.ok) { setError(r.error?.message ?? 'Speichern fehlgeschlagen'); return; }
    onSaved();
  };

  const remove = async () => {
    if (!existing) return;
    if (!confirm('Mapping wirklich löschen?')) return;
    setBusy(true);
    await deleteMapping(existing.id);
    setBusy(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-obsidian-900 border border-titanium-900 rounded-none shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-titanium-900">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300">
              {control.framework} · {control.control_code}
            </div>
            <h2 className="font-display font-bold text-titanium-50">{control.title}</h2>
            <div className="text-[11px] font-mono text-titanium-400 mt-0.5">
              Asset: {asset.name}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {control.description && (
            <p className="text-[13px] text-titanium-300 leading-relaxed">{control.description}</p>
          )}

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1.5">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 border text-[12px] font-mono uppercase tracking-wider transition-colors ${
                    status === s
                      ? `${STATUS_CLS[s]} ring-1 ring-amber-500/40`
                      : 'border-titanium-800 text-titanium-400 hover:border-titanium-700'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-titanium-400 mb-1.5">
              Notiz (optional)
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. „DPIA Section 3 dokumentiert, Approval ausstehend"
              className="w-full bg-obsidian-950 border border-titanium-900 text-titanium-100 text-sm rounded-none px-3 py-2 outline-none focus:border-amber-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-300 bg-red-950/50 border border-red-900 rounded-none p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {existing ? (
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/40 border border-red-900 rounded-none disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Mapping löschen
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 text-sm font-semibold text-titanium-300 hover:bg-obsidian-800 rounded-none">
                Abbrechen
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="px-4 py-1.5 bg-amber-500 text-obsidian-950 text-sm font-semibold rounded-none hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Speichere…' : existing ? 'Aktualisieren' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
