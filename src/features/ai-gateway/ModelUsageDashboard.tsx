import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Cpu, Loader2, AlertTriangle, Zap, DollarSign, Clock, ShieldCheck, Plus, Trash2 } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchModelUsage, fetchModelConfigs, fetchRoutingPolicies,
  saveRoutingPolicy, deleteRoutingPolicy,
} from './gatewayApi';
import type { ModelUsageRow, ModelConfig, RoutingPolicy } from './types';
import { PROVIDER_COLORS, PROVIDER_LABELS } from './types';

export function ModelUsageDashboard() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { activeTenantId } = useTenant();
  const [usage, setUsage]       = useState<ModelUsageRow[] | null>(null);
  const [configs, setConfigs]   = useState<ModelConfig[]>([]);
  const [policies, setPolicies] = useState<RoutingPolicy[] | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<'usage' | 'models' | 'routing'>('usage');

  const reload = async () => {
    if (!activeTenantId) { setUsage([]); setPolicies([]); return; }
    setError(null);
    try {
      const [u, c, p] = await Promise.all([
        fetchModelUsage(activeTenantId, 3),
        fetchModelConfigs(),
        fetchRoutingPolicies(activeTenantId),
      ]);
      setUsage(u); setConfigs(c); setPolicies(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [activeTenantId]);

  // Aggregation für aktuelle Periode
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRows = (usage ?? []).filter((r) => r.month.startsWith(thisMonth));

  const totalCost     = thisMonthRows.reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const totalRequests = thisMonthRows.reduce((s, r) => s + (r.request_count ?? 0), 0);
  const totalTokens   = thisMonthRows.reduce((s, r) => s + (r.total_input_tokens + r.total_output_tokens), 0);
  const euLocalCost   = thisMonthRows.filter((r) => r.provider === 'ollama').reduce((s, r) => s + (r.total_cost_usd ?? 0), 0);
  const cloudCost     = totalCost - euLocalCost;

  // Savings vs. All-Sonnet baseline
  const sonnetInputPricePerM  = 3.00;
  const sonnetOutputPricePerM = 15.00;
  const actualCost = totalCost;
  const baselineCost = thisMonthRows.reduce((s, r) =>
    s + (r.total_input_tokens / 1_000_000) * sonnetInputPricePerM
      + (r.total_output_tokens / 1_000_000) * sonnetOutputPricePerM, 0);
  const savings = baselineCost > 0 ? ((baselineCost - actualCost) / baselineCost) * 100 : 0;

  // Per-Provider-Aggregation für diese Periode
  const byProvider = groupBy(thisMonthRows, (r) => r.provider);
  const maxProviderCost = Math.max(0, ...Object.values(byProvider).map((rows) =>
    rows.reduce((s, r) => s + r.total_cost_usd, 0)));

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/app/costs" className="p-1.5 hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AI Gateway</div>
              <div className="text-[11px] text-titanium-400">Model Usage · Routing Policies · Kostenoptimierung</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {(['usage','models','routing'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider border transition-colors ${
                tab === t
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'border-titanium-900 text-titanium-500 hover:text-titanium-200 hover:border-titanium-700'
              }`}>
              {t === 'usage' ? 'Usage' : t === 'models' ? 'Modelle' : 'Routing'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />{error}
          </div>
        )}

        {/* KPI-Zeile */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric icon={<DollarSign className="h-4 w-4" />} label="Kosten (Monat)" value={`$${totalCost.toFixed(2)}`} />
          <Metric icon={<Zap className="h-4 w-4" />}        label="Requests (Monat)" value={fmtNum(totalRequests)} />
          <Metric icon={<Cpu className="h-4 w-4" />}        label="Token (Monat)" value={fmtTokens(totalTokens)} />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Cloud-Kosten" value={`$${cloudCost.toFixed(2)}`} />
          <Metric icon={<DollarSign className="h-4 w-4" />} label="Routing-Savings" value={`${savings.toFixed(0)}%`}
            highlight={savings > 10} />
        </div>

        {usage === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-16 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />Lade…
          </div>
        ) : tab === 'usage' ? (
          <UsageTab rows={usage} byProvider={byProvider} maxProviderCost={maxProviderCost} thisMonth={thisMonth} />
        ) : tab === 'models' ? (
          <ModelsTab configs={configs} />
        ) : (
          <RoutingTab
            policies={policies ?? []}
            tenantId={activeTenantId ?? ''}
            configs={configs}
            onReload={reload}
          />
        )}
      </main>
    </div>
  );
}

// ─── Tab: Usage ──────────────────────────────────────────────────────────────
function UsageTab({
  rows, byProvider, maxProviderCost, thisMonth,
}: {
  rows: ModelUsageRow[];
  byProvider: Record<string, ModelUsageRow[]>;
  maxProviderCost: number;
  thisMonth: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-16 border border-titanium-900 bg-obsidian-900/40">
        <Cpu className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
        <p className="text-sm text-titanium-400 max-w-md mx-auto">
          Noch keine AI Gateway Runs. Sobald Anfragen über den Gateway laufen, erscheint hier die Aufschlüsselung.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Provider-Kostenübersicht */}
      <section className="border border-titanium-900 bg-obsidian-900/60 p-4">
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase mb-4">
          Kosten nach Provider ({thisMonth})
        </h2>
        <div className="space-y-3">
          {Object.entries(byProvider).map(([provider, prows]) => {
            const cost = prows.reduce((s, r) => s + r.total_cost_usd, 0);
            const reqs = prows.reduce((s, r) => s + r.request_count, 0);
            const w = maxProviderCost > 0 ? (cost / maxProviderCost) * 100 : 0;
            const color = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.unknown;
            return (
              <div key={provider}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-mono text-titanium-200">{PROVIDER_LABELS[provider] ?? provider}</span>
                  <span className="font-mono tabular-nums text-titanium-400">{fmtNum(reqs)} req · </span>
                  <span className="font-mono tabular-nums" style={{ color }}>${cost.toFixed(3)}</span>
                </div>
                <div className="h-2 bg-titanium-900">
                  <div className="h-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Modell-Detail-Tabelle */}
      <section className="border border-titanium-900 bg-obsidian-900/60">
        <header className="px-4 py-3 border-b border-titanium-900">
          <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">Modell-Aufschlüsselung</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
                <th className="text-left py-2 px-4">Monat</th>
                <th className="text-left py-2 px-3">Provider</th>
                <th className="text-left py-2 px-3">Modell</th>
                <th className="text-right py-2 px-3">Requests</th>
                <th className="text-right py-2 px-3">Token</th>
                <th className="text-right py-2 px-3">Kosten USD</th>
                <th className="text-right py-2 px-3">Ø Latenz</th>
                <th className="text-right py-2 px-4">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-titanium-900/50 hover:bg-obsidian-900/40">
                  <td className="py-2 px-4 font-mono text-[11px] text-titanium-300">{r.month?.slice(0, 7)}</td>
                  <td className="py-2 px-3">
                    <ProviderBadge provider={r.provider} />
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-titanium-200">{r.model_id}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-titanium-300">{fmtNum(r.request_count)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-titanium-400">
                    {fmtTokens(r.total_input_tokens + r.total_output_tokens)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-300">
                    ${(r.total_cost_usd ?? 0).toFixed(3)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-titanium-400">
                    {r.avg_duration_ms ? `${Math.round(r.avg_duration_ms)}ms` : '—'}
                  </td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums text-red-400">
                    {r.error_count > 0 ? r.error_count : <span className="text-titanium-700">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Tab: Modelle ─────────────────────────────────────────────────────────────
function ModelsTab({ configs }: { configs: ModelConfig[] }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center justify-between">
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">Verfügbare Modelle</h2>
        <span className="text-[10px] font-mono text-titanium-500">{configs.length} konfiguriert</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 border-b border-titanium-900">
              <th className="text-left py-2 px-4">Modell</th>
              <th className="text-left py-2 px-3">Provider</th>
              <th className="text-right py-2 px-3">Input / 1M Token</th>
              <th className="text-right py-2 px-3">Output / 1M Token</th>
              <th className="text-right py-2 px-3">Ø Latenz</th>
              <th className="text-right py-2 px-4">EU-Residenz</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.id} className="border-b border-titanium-900/50 hover:bg-obsidian-900/40">
                <td className="py-2 px-4">
                  <div className="font-mono text-[12px] text-titanium-100">{c.display_name}</div>
                  <div className="font-mono text-[10px] text-titanium-500">{c.model_id}</div>
                </td>
                <td className="py-2 px-3"><ProviderBadge provider={c.provider} /></td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px] text-titanium-300">
                  ${c.cost_input_per_million_usd.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px] text-amber-400">
                  ${c.cost_output_per_million_usd.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-[11px] text-titanium-400">
                  {c.avg_latency_ms ? `${c.avg_latency_ms}ms` : '—'}
                </td>
                <td className="py-2 px-4 text-right">
                  {c.eu_resident
                    ? <span className="text-[10px] font-mono bg-violet-950/60 border border-violet-800 text-violet-300 px-2 py-0.5">EU-LOKAL</span>
                    : <span className="text-[10px] font-mono text-titanium-600">Cloud</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Tab: Routing ────────────────────────────────────────────────────────────
function RoutingTab({
  policies, tenantId, configs, onReload,
}: {
  policies: RoutingPolicy[];
  tenantId: string;
  configs: ModelConfig[];
  onReload: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState<Partial<RoutingPolicy>>({
    tenant_id: tenantId,
    name: '',
    priority: 50,
    match_tool_key_pattern: null,
    match_content_type: null,
    preferred_provider: 'anthropic',
    preferred_model_id: 'claude-haiku-4-5-20251001',
    max_cost_usd_per_call: null,
    require_eu_resident: false,
    enabled: true,
  });

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await saveRoutingPolicy({ ...form, tenant_id: tenantId } as Omit<RoutingPolicy, 'id'>);
      setAdding(false);
      onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Policy löschen?')) return;
    try { await deleteRoutingPolicy(id); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); }
  };

  return (
    <div className="space-y-4">
      <section className="border border-titanium-900 bg-obsidian-900/60">
        <header className="px-4 py-3 border-b border-titanium-900 flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">Routing Policies</h2>
            <p className="text-[11px] text-titanium-500 mt-0.5">Auswertung: Priority ASC → Komplexitäts-Routing → Fallback Haiku</p>
          </div>
          <button onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 border border-amber-700 text-amber-300 hover:bg-amber-900/30 transition-colors font-mono">
            <Plus className="h-3 w-3" />NEUE POLICY
          </button>
        </header>

        {adding && (
          <div className="px-4 py-4 border-b border-titanium-800 bg-obsidian-900/80 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Name" required>
                <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="z.B. Legal-Queries zu Claude Sonnet"
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm font-mono outline-none focus:border-amber-700" />
              </Field>
              <Field label="Priority (0=höchste)">
                <input type="number" value={form.priority ?? 50} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm font-mono outline-none focus:border-amber-700" />
              </Field>
              <Field label="Tool-Key Pattern (LIKE)">
                <input value={form.match_tool_key_pattern ?? ''} onChange={(e) => setForm({ ...form, match_tool_key_pattern: e.target.value || null })}
                  placeholder="z.B. legal_% oder *"
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm font-mono outline-none focus:border-amber-700" />
              </Field>
              <Field label="Content-Type">
                <select value={form.match_content_type ?? ''} onChange={(e) => setForm({ ...form, match_content_type: e.target.value || null })}
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-200 px-2 py-1.5 text-sm font-mono outline-none">
                  <option value="">Alle</option>
                  <option value="legal">Legal</option>
                  <option value="code">Code</option>
                  <option value="summary">Summary</option>
                  <option value="analysis">Analysis</option>
                </select>
              </Field>
              <Field label="Ziel-Modell">
                <select value={`${form.preferred_provider}:${form.preferred_model_id}`}
                  onChange={(e) => {
                    const [p, m] = e.target.value.split(':');
                    setForm({ ...form, preferred_provider: p, preferred_model_id: m });
                  }}
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-200 px-2 py-1.5 text-sm font-mono outline-none">
                  {configs.map((c) => (
                    <option key={c.id} value={`${c.provider}:${c.model_id}`}>
                      {c.display_name} ({PROVIDER_LABELS[c.provider] ?? c.provider})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Max. Kosten / Call (USD)">
                <input type="number" step="0.001" value={form.max_cost_usd_per_call ?? ''} onChange={(e) => setForm({ ...form, max_cost_usd_per_call: e.target.value ? Number(e.target.value) : null })}
                  placeholder="z.B. 0.05"
                  className="w-full bg-obsidian-950 border border-titanium-800 text-titanium-100 px-2 py-1.5 text-sm font-mono outline-none focus:border-amber-700" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-mono text-titanium-300 cursor-pointer">
              <input type="checkbox" checked={form.require_eu_resident ?? false}
                onChange={(e) => setForm({ ...form, require_eu_resident: e.target.checked })}
                className="accent-violet-500" />
              EU-Residenz erzwingen (→ Ollama EU-lokal)
            </label>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !form.name}
                className="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-sm font-mono disabled:opacity-50 transition-colors">
                {saving ? 'Speichere…' : 'SPEICHERN'}
              </button>
              <button onClick={() => setAdding(false)} className="px-4 py-1.5 border border-titanium-800 text-titanium-400 text-sm font-mono hover:text-titanium-200 transition-colors">
                ABBRECHEN
              </button>
            </div>
          </div>
        )}

        {policies.length === 0 && !adding ? (
          <div className="text-center py-12 text-titanium-500 text-sm">
            Noch keine Routing-Policies. Ohne Policies gilt: Komplexitäts-Routing → Haiku/Sonnet.
          </div>
        ) : (
          <div className="divide-y divide-titanium-900/50">
            {policies.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-start justify-between gap-4 hover:bg-obsidian-900/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] bg-titanium-900 px-1.5 py-0.5 text-titanium-400">P{p.priority}</span>
                    <span className="text-sm font-medium text-titanium-100">{p.name}</span>
                    {!p.enabled && <span className="text-[10px] font-mono text-titanium-600 border border-titanium-800 px-1.5 py-0.5">INAKTIV</span>}
                    {p.require_eu_resident && <span className="text-[10px] font-mono bg-violet-950/60 border border-violet-800 text-violet-300 px-1.5 py-0.5">EU-LOKAL</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-titanium-500 font-mono">
                    {p.match_tool_key_pattern && <span>tool: <span className="text-titanium-300">{p.match_tool_key_pattern}</span></span>}
                    {p.match_content_type && <span>type: <span className="text-titanium-300">{p.match_content_type}</span></span>}
                    {p.preferred_model_id && <span>→ <span className="text-amber-300">{p.preferred_model_id}</span></span>}
                    {p.max_cost_usd_per_call != null && <span>max: <span className="text-titanium-300">${p.max_cost_usd_per_call}</span></span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-titanium-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Routing-Logik Erklärung */}
      <section className="border border-titanium-900 bg-obsidian-900/40 p-4 text-[11px] font-mono text-titanium-500 space-y-1">
        <div className="text-titanium-300 font-bold mb-2">ROUTING-REIHENFOLGE</div>
        <div>1. EU-Residenz-Zwang → <span className="text-violet-300">Ollama gemma3:4b (EU-lokal)</span></div>
        <div>2. Tenant-Policies (Priority ASC, erste Übereinstimmung gewinnt)</div>
        <div>3. Komplexitäts-Analyse → <span className="text-amber-300">Haiku 4.5</span> (score &lt;40) oder <span className="text-amber-300">Sonnet 4.6</span> (score ≥40)</div>
        <div>4. Fallback → <span className="text-amber-300">Claude Haiku 4.5</span></div>
      </section>
    </div>
  );
}

// ─── Hilfselemente ────────────────────────────────────────────────────────────
function Metric({ label, value, icon, highlight = false }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-900/60 p-3 flex flex-col gap-1">
      <div className={`text-xl font-display font-bold tabular-nums ${highlight ? 'text-emerald-400' : 'text-titanium-50'}`}>{value}</div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-titanium-500">
        {icon}<span>{label}</span>
      </div>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? PROVIDER_COLORS.unknown;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 border" style={{ borderColor: `${color}40`, color }}>
      {PROVIDER_LABELS[provider] ?? provider}
    </span>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}
