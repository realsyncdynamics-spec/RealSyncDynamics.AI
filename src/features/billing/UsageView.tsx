import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Cpu, Layers, ShieldCheck, History,
  CheckCircle2, AlertTriangle, Loader2,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { QuotaBar } from '../../core/access/QuotaBar';
import { AuthGate } from '../kodee/connections/AuthGate';
import { listRecentRuns, summarizeRuns, type AiRun } from '../../core/ai/runs';

type Tab = 'quotas' | 'history';

export function UsageView() {
  return (
    <AuthGate>
      {() => <UsageInner />}
    </AuthGate>
  );
}

function UsageInner() {
  const { tenants, activeTenantId, setActiveTenant, entitlements, loading } = useTenant();
  const [tab, setTab] = useState<Tab>('quotas');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="h-14 border-b border-slate-200/60 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
              <BarChart3 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-slate-900">Verbrauch & Limits</div>
              <div className="text-[11px] text-slate-500 font-medium">Aktueller Monat</div>
            </div>
          </div>
        </div>

        {tenants.length > 1 && (
          <select
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-slate-100 max-w-[200px]"
          >
            {tenants.map((t) => (
              <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
            ))}
          </select>
        )}
      </header>

      <div className="border-b border-slate-200/60 bg-white px-4">
        <div className="max-w-5xl mx-auto flex gap-2">
          <TabButton active={tab === 'quotas'}  onClick={() => setTab('quotas')}>
            <BarChart3 className="h-3.5 w-3.5" /> Quotas
          </TabButton>
          <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
            <History className="h-3.5 w-3.5" /> AI-Verlauf
          </TabButton>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-slate-400 text-sm">Lade…</div>
        ) : !activeTenantId ? (
          <EmptyTenants />
        ) : tab === 'quotas' ? (
          !entitlements ? (
            <div className="text-slate-400 text-sm">Keine Entitlements für diesen Tenant gefunden.</div>
          ) : (
            <QuotasPanel />
          )
        ) : (
          <HistoryPanel tenantId={activeTenantId} />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function QuotasPanel() {
  return (
    <div className="space-y-8">
      <Section icon={Cpu} title="AI">
        <QuotaBar feature="limit.ai_calls_monthly"          label="AI-Aufrufe / Monat" />
        <QuotaBar feature="limit.ai_tokens_monthly"         label="AI-Token / Monat" />
        <QuotaBar
          feature="limit.ai_cost_monthly_cents"
          label="AI-Kosten / Monat"
          format={(n) => `$${(n / 100).toFixed(2)}`}
        />
      </Section>

      <Section icon={Layers} title="Assets & Workflows">
        <QuotaBar feature="limit.active_assets"             label="Aktive Assets" />
        <QuotaBar feature="limit.monthly_registrations"     label="Asset-Registrierungen / Monat" />
        <QuotaBar feature="limit.bulk_jobs_monthly"         label="Bulk-Jobs / Monat" />
        <QuotaBar feature="limit.compliance_exports_monthly" label="Compliance-Exports / Monat" />
      </Section>

      <Section icon={ShieldCheck} title="Team & API">
        <QuotaBar feature="limit.team_seats"                label="Team-Seats" />
        <QuotaBar feature="limit.api_calls_monthly"         label="API-Calls / Monat" />
      </Section>
    </div>
  );
}

function HistoryPanel({ tenantId }: { tenantId: string }) {
  const [runs, setRuns] = useState<AiRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRuns(null);
    setError(null);
    listRecentRuns(tenantId, 100)
      .then((rows) => { if (!cancelled) setRuns(rows); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? String(e)); });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (error) {
    return (
      <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    );
  }
  if (runs === null) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Lade Runs…
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4">
          <History className="h-6 w-6 text-slate-300" />
        </div>
        <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Noch keine AI-Runs</h2>
        <p className="text-sm text-slate-500">
          Sobald ein AI-Tool gegen diesen Tenant aufgerufen wird, erscheinen die Runs hier.
        </p>
      </div>
    );
  }

  const stats = summarizeRuns(runs);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Runs"     value={stats.totalRuns.toString()} />
        <StatCard label="Tokens"   value={stats.totalTokens.toLocaleString('de-DE')} />
        <StatCard label="Cost"     value={`$${stats.totalCostUsd.toFixed(4)}`} />
        <StatCard
          label="Success-Rate"
          value={`${stats.totalRuns ? Math.round((stats.successRuns / stats.totalRuns) * 100) : 0}%`}
          tone={stats.errorRuns ? 'amber' : 'emerald'}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Tool</th>
              <th className="text-left px-3 py-2 hidden sm:table-cell">Wann</th>
              <th className="text-right px-3 py-2 hidden md:table-cell">Tokens</th>
              <th className="text-right px-3 py-2">Cost</th>
              <th className="text-right px-3 py-2 hidden md:table-cell">Dauer</th>
              <th className="text-center px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.tool_key}</td>
                <td className="px-3 py-2 text-slate-500 text-xs hidden sm:table-cell">
                  {new Date(r.created_at).toLocaleString('de-DE')}
                </td>
                <td className="px-3 py-2 text-right text-slate-600 hidden md:table-cell tabular-nums">
                  {(r.input_tokens + r.output_tokens).toLocaleString('de-DE')}
                  {r.cached_tokens > 0 && (
                    <span className="ml-1 text-[10px] text-emerald-600 font-semibold">
                      ({r.cached_tokens} cached)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-700 tabular-nums">
                  ${Number(r.cost_usd).toFixed(4)}
                </td>
                <td className="px-3 py-2 text-right text-slate-500 hidden md:table-cell tabular-nums">
                  {r.duration_ms ? `${r.duration_ms} ms` : '–'}
                </td>
                <td className="px-3 py-2 text-center">
                  {r.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" />
                  ) : (
                    <span title={r.error_message ?? r.error_code ?? r.status}>
                      <AlertTriangle className="h-4 w-4 text-red-600 inline" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label, value, tone = 'slate',
}: { label: string; value: string; tone?: 'slate' | 'emerald' | 'amber' }) {
  const valueClass = {
    slate:   'text-slate-900',
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
  }[tone];
  return (
    <div className="p-3 bg-white border border-slate-200 rounded-xl">
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1 text-lg font-display font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}

function Section({
  icon: Icon, title, children,
}: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <h2 className="font-display font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {children}
      </div>
    </section>
  );
}

function EmptyTenants() {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4">
        <BarChart3 className="h-6 w-6 text-slate-300" />
      </div>
      <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Noch kein Tenant</h2>
      <p className="text-sm text-slate-500">
        Sobald du Mitglied eines Tenants bist, siehst du hier deinen Verbrauch.
      </p>
    </div>
  );
}
