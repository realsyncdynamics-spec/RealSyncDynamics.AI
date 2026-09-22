import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowLeft, DollarSign, Loader2, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import {
  listRecentRuns,
  summarizeShadowRuntime,
  type AiRun,
  type ShadowRuntimeGroupStats,
} from '../../core/ai/runs';
import { AuthGate } from '../kodee/connections/AuthGate';
import { fetchTenantTokenMonthly, type DbTokenUsageMonthly } from './costApi';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

function _CostTrackingView() { return <AuthGate>{() => <Inner />}</AuthGate>; }

export const CostTrackingView = withPerformanceMonitoring(
  _CostTrackingView,
  'CostTrackingView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [rows, setRows] = useState<DbTokenUsageMonthly[] | null>(null);
  const [shadowRuns, setShadowRuns] = useState<AiRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shadowError, setShadowError] = useState<string | null>(null);

  const reload = async () => {
    if (!activeTenantId) {
      setRows([]);
      setShadowRuns([]);
      return;
    }

    setError(null);
    setShadowError(null);
    setRows(null);
    setShadowRuns(null);

    const [costResult, shadowResult] = await Promise.allSettled([
      fetchTenantTokenMonthly(activeTenantId, 6),
      listRecentRuns(activeTenantId, 500),
    ]);

    if (costResult.status === 'fulfilled') setRows(costResult.value);
    else {
      setRows([]);
      setError(costResult.reason instanceof Error ? costResult.reason.message : 'Kosten laden fehlgeschlagen');
    }

    if (shadowResult.status === 'fulfilled') setShadowRuns(shadowResult.value);
    else {
      setShadowRuns([]);
      setShadowError(shadowResult.reason instanceof Error ? shadowResult.reason.message : 'Shadow-Rating laden fehlgeschlagen');
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRows = (rows ?? []).filter((r) => r.month.startsWith(thisMonth));
  const totalTokens = thisMonthRows.reduce((s, r) => s + (r.total_tokens ?? 0), 0);
  const totalCost   = thisMonthRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const byVendor = aggregate(thisMonthRows, (r) => r.vendor);
  const byAsset  = aggregate(thisMonthRows, (r) => r.asset_id ?? '—');

  const shadowGroups = useMemo(() => summarizeShadowRuntime(shadowRuns ?? []), [shadowRuns]);
  const shadowSampleCount = shadowGroups.reduce((sum, group) => sum + group.runs, 0);
  const observedClasses = new Set(shadowGroups.map((group) => group.runtimeClass)).size;
  const observedZones = new Set(shadowGroups.map((group) => group.executionZone)).size;

  // Group all rows by vendor + month for the bar chart
  const vendors = [...new Set((rows ?? []).map((r) => r.vendor))];
  void vendors; // retained for the existing cost-series shape; no fabricated vendor rows.
  const months  = [...new Set((rows ?? []).map((r) => r.month))].sort();
  const maxMonthCost = Math.max(0, ...months.map((m) => (rows ?? []).filter((r) => r.month === m).reduce((s, r) => s + (r.total_cost_usd ?? 0), 0)));

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center"><DollarSign className="h-4 w-4 text-white" /></div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Cost & Shadow Rating</div>
              <div className="text-[11px] text-titanium-400">COGS · Tokens · Runtime-Kalibrierung</div>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3"><AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label={`Token (${thisMonth})`} value={fmtTokens(totalTokens)} />
          <Metric label={`Kosten USD (${thisMonth})`} value={`$${totalCost.toFixed(2)}`} />
          <Metric label="Teuerster Vendor" value={byVendor[0]?.key ?? '—'} />
          <Metric label="Teuerstes Asset" value={(byAsset[0]?.key ?? '—').slice(0, 16)} />
        </div>

        <ShadowCalibrationSection
          groups={shadowGroups}
          loading={shadowRuns === null}
          error={shadowError}
          sampleCount={shadowSampleCount}
          observedClasses={observedClasses}
          observedZones={observedZones}
        />

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

function ShadowCalibrationSection({
  groups,
  loading,
  error,
  sampleCount,
  observedClasses,
  observedZones,
}: {
  groups: ShadowRuntimeGroupStats[];
  loading: boolean;
  error: string | null;
  sampleCount: number;
  observedClasses: number;
  observedZones: number;
}) {
  return (
    <section data-testid="shadow-rating-calibration" className="border border-cyan-900/50 bg-obsidian-900/70">
      <header className="border-b border-titanium-900 px-4 py-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">Shadow Rating · Calibration</h2>
          </div>
          <p className="mt-1 text-[11px] text-titanium-400">
            Letzte bis zu 500 tenant-scoped AI-Runs. Nur serverseitige Shadow-Metadaten werden ausgewertet; ältere Runs werden nicht geraten oder rückgefüllt.
          </p>
        </div>
        <span className="border border-cyan-800/60 bg-cyan-950/30 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan-300">
          Measurement only
        </span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-titanium-900 border-b border-titanium-900">
        <CalibrationMetric label="Shadow Samples" value={sampleCount} />
        <CalibrationMetric label="Klassen beobachtet" value={`${observedClasses}/5`} />
        <CalibrationMetric label="Zonen beobachtet" value={`${observedZones}/3`} />
        <CalibrationMetric label="Customer Charge" value="0" />
      </div>

      {error && (
        <div className="m-4 flex items-start gap-2.5 border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-titanium-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Shadow-Runs laden…
        </div>
      ) : groups.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-7 w-7 text-titanium-600" />
          <p className="text-sm text-titanium-300">Noch keine Shadow-Rating-Samples für diesen Tenant.</p>
          <p className="mx-auto mt-1 max-w-2xl text-xs leading-5 text-titanium-500">
            Gezählt werden nur Runs, die bereits <code className="font-mono text-cyan-300">runtime_class</code>,{' '}
            <code className="font-mono text-cyan-300">execution_zone</code> und{' '}
            <code className="font-mono text-cyan-300">provider_class</code> tragen. Bis echte Runs vorliegen,
            bleibt die Kalibrierung bewusst ohne Credit-Schätzung.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto p-4">
          <table className="min-w-[1180px] w-full text-xs">
            <thead>
              <tr className="border-b border-titanium-900 font-mono text-[9px] uppercase tracking-wider text-titanium-500">
                <th className="py-2 pr-3 text-left">Class</th>
                <th className="py-2 pr-3 text-left">Zone</th>
                <th className="py-2 pr-3 text-left">Provider Class</th>
                <th className="py-2 pr-3 text-right">Runs</th>
                <th className="py-2 pr-3 text-right">Cost p50</th>
                <th className="py-2 pr-3 text-right">p90</th>
                <th className="py-2 pr-3 text-right">p99</th>
                <th className="py-2 pr-3 text-right">Tokens p50/p90/p99</th>
                <th className="py-2 pr-3 text-right">Latency p50/p90/p99</th>
                <th className="py-2 pr-3 text-right">Retry</th>
                <th className="py-2 text-right">Verifier</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={`${group.runtimeClass}|${group.executionZone}|${group.providerClass}`} className="border-b border-titanium-900">
                  <td className="py-2 pr-3 font-mono text-cyan-300">{group.runtimeClass}</td>
                  <td className="py-2 pr-3 font-mono text-titanium-300">{group.executionZone}</td>
                  <td className="py-2 pr-3 font-mono text-titanium-300">{group.providerClass}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-100">
                    {group.runs} <span className="text-titanium-600">({group.successRuns}/{group.errorRuns})</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-amber-300">{fmtUsd(group.costUsd.p50)}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-amber-300">{fmtUsd(group.costUsd.p90)}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-amber-300">{fmtUsd(group.costUsd.p99)}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">
                    {fmtTriplet(group.tokens, (n) => fmtTokens(Math.round(n)))}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">
                    {fmtTriplet(group.durationMs, fmtDuration)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-titanium-300">{fmtPercent(group.retryShare)}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-titanium-300">{fmtPercent(group.verifierShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="border-t border-titanium-900 bg-[#0a0f15] px-4 py-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-titanium-500">
          Burn <span className="text-cyan-300">→</span> Included <span className="text-titanium-700">→</span> Packgröße <span className="text-titanium-700">→</span> Preis <span className="text-titanium-700">→</span> Margin-Floor
        </p>
        <p className="mt-1 text-[11px] text-titanium-500">
          Diese Ansicht misst Burn. Sie setzt keine Included-Credits, keine Packpreise und keine Wallet-Grenzen.
        </p>
      </footer>
    </section>
  );
}

function CalibrationMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-obsidian-950/70 p-3">
      <div className="font-display text-lg font-bold tabular-nums text-titanium-50">{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-titanium-500">{label}</div>
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

function fmtUsd(n: number | null): string {
  if (n === null) return '—';
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function fmtDuration(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.round(n)}ms`;
}

function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtTriplet(
  values: { p50: number | null; p90: number | null; p99: number | null },
  format: (value: number) => string,
): string {
  return [values.p50, values.p90, values.p99]
    .map((value) => value === null ? '—' : format(value))
    .join(' / ');
}
