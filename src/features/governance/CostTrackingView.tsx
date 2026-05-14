import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import { fetchTenantTokenMonthly, type DbTokenUsageMonthly } from './costApi';

export function CostTrackingView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [rows, setRows] = useState<DbTokenUsageMonthly[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!activeTenantId) { setRows([]); return; }
    setError(null); setRows(null);
    try { setRows(await fetchTenantTokenMonthly(activeTenantId, 6)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen'); }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRows = (rows ?? []).filter((r) => r.month.startsWith(thisMonth));
  const totalTokens = thisMonthRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const totalCost   = thisMonthRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const byVendor = aggregate(thisMonthRows, (r) => r.vendor);
  const byAsset  = aggregate(thisMonthRows, (r) => r.asset_id ?? '—');

  // Group all rows by vendor + month for the bar chart
  const vendors = [...new Set((rows ?? []).map((r) => r.vendor))];
  const months  = [...new Set((rows ?? []).map((r) => r.month))].sort();
  const maxMonthCost = Math.max(0, ...months.map((m) => (rows ?? []).filter((r) => r.month === m).reduce((s, r) => s + (r.total_cost_usd ?? 0), 0)));

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/governance/admin" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center"><DollarSign className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cost & Token Tracking</div>
              <div className="text-[11px] text-titanium-400">Pro Vendor · Asset · Monat</div>
            </div>
          </div>
        </div>
        {tenants.length > 1 && (
          <select value={activeTenantId ?? ''} onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none">
            {tenants.map((t) => <option key={t.tenantId} value={t.tenantId}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label={`Token (${thisMonth})`} value={fmtTokens(totalTokens)} />
          <Metric label={`Kosten USD (${thisMonth})`} value={`$${totalCost.toFixed(2)}`} />
          <Metric label="Teuerster Vendor" value={byVendor[0]?.key ?? '—'} />
          <Metric label="Teuerstes Asset" value={(byAsset[0]?.key ?? '—').slice(0, 16)} />
        </div>

        {rows === null ? <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center"><Loader2 className="h-4 w-4 animate-spin" />Lade…</div>
          : rows.length === 0 ? <div className="text-center py-16 border border-titanium-900 bg-obsidian-900/40">
              <DollarSign className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
              <p className="text-sm text-titanium-400 max-w-md mx-auto">
                Noch keine Token-Usage erfasst. Sende Events mit <code className="font-mono text-amber-300">token_usage</code> im Payload via SDK oder API.
              </p>
            </div>
          : <>
            <section className="border border-titanium-900 bg-obsidian-900/60 p-4">
              <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase mb-3">Monatliche Kosten</h2>
              <div className="space-y-2">
                {months.slice(-6).map((m) => {
                  const monthCost = (rows ?? []).filter((r) => r.month === m).reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
                  const w = (monthCost / Math.max(maxMonthCost, 1)) * 100;
                  return <div key={m} className="text-[11px]">
                    <div className="flex justify-between mb-0.5">
                      <span className="font-mono text-titanium-300">{m.slice(0, 7)}</span>
                      <span className="font-mono tabular-nums text-titanium-100">${monthCost.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-titanium-900"><div className="h-full bg-amber-500/70" style={{ width: `${w}%` }} /></div>
                  </div>;
                })}
              </div>
            </section>

            <section className="border border-titanium-900 bg-obsidian-900/60">
              <header className="px-4 py-3 border-b border-titanium-900"><h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">Usage-Aufschlüsselung</h2></header>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
                      <th className="text-left py-2 pr-3">Monat</th>
                      <th className="text-left py-2 pr-3">Vendor</th>
                      <th className="text-left py-2 pr-3">Modell</th>
                      <th className="text-right py-2 pr-3">Token</th>
                      <th className="text-right py-2 pr-3">Kosten USD</th>
                      <th className="text-right py-2">Requests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rows ?? []).map((r, idx) => <tr key={idx} className="border-b border-titanium-900">
                      <td className="py-2 pr-3 font-mono text-[11px] text-titanium-300">{r.month.slice(0, 7)}</td>
                      <td className="py-2 pr-3 text-titanium-100">{r.vendor}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-titanium-300">{r.model_name}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmtTokens(r.total_tokens)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-amber-300">${(r.total_cost_usd ?? 0).toFixed(2)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-titanium-400">{r.request_count}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          </>}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border border-titanium-900 bg-obsidian-900/60 p-3">
    <div className="text-xl font-display font-bold tabular-nums text-titanium-50 truncate">{value}</div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">{label}</div>
  </div>;
}

function aggregate(rows: DbTokenUsageMonthly[], pick: (r: DbTokenUsageMonthly) => string): Array<{ key: string; cost: number }> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(pick(r), (m.get(pick(r)) ?? 0) + (r.total_cost_usd ?? 0));
  return [...m.entries()].map(([key, cost]) => ({ key, cost })).sort((a, b) => b.cost - a.cost);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}
