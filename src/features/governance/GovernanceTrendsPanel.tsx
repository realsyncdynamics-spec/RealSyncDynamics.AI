import React from 'react';
import { TrendingUp, BarChart3 } from 'lucide-react';
import type { DbGovernanceEvent } from './governanceApi';
import type { GovernanceRiskLevel } from './types';

/**
 * Client-side aggregate panels for the tenant dashboard. Receives
 * the same event slice the parent already fetched — zero extra
 * round-trips, zero charting library. Pure HTML / SVG bars.
 *
 * Volume assumption: pilot tenants have ≪ 10k events; aggregations
 * over the rendered slice are cheap. When event volume crosses
 * a real threshold, this gets replaced with a server-side
 * aggregation RPC.
 */
interface Props {
  events: DbGovernanceEvent[];
}

const RISK_ORDER: GovernanceRiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

const RISK_COLOR: Record<GovernanceRiskLevel, string> = {
  critical: 'bg-rose-500',
  high:     'bg-amber-500',
  medium:   'bg-yellow-400',
  low:      'bg-sky-400',
  info:     'bg-titanium-600',
};

const RISK_BORDER: Record<GovernanceRiskLevel, string> = {
  critical: 'border-rose-500/50',
  high:     'border-amber-500/50',
  medium:   'border-yellow-400/50',
  low:      'border-sky-400/50',
  info:     'border-titanium-700',
};

export function GovernanceTrendsPanel({ events }: Props) {
  if (events.length === 0) return null;

  const perDay = bucketPerDay(events, 14);
  const byVendor = topN(countBy(events, (e) => e.vendor ?? '—'), 8);
  const bySource = topN(countBy(events, (e) => e.event_source), 8);
  const byRisk = RISK_ORDER.map((level) => ({
    key: level,
    count: events.filter((e) => e.risk_level === level).length,
  })).filter((x) => x.count > 0);
  const byActionBlocked = events.filter((e) => e.policy_action === 'block').length;
  const byActionWarn    = events.filter((e) => e.policy_action === 'warn').length;
  const byActionApprove = events.filter((e) => e.policy_action === 'require_approval').length;

  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2 text-titanium-200">
        <BarChart3 className="h-4 w-4" />
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">
          Trends
        </h2>
        <span className="ml-auto text-[11px] font-mono text-titanium-500">
          {events.length} Events in der Ansicht
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-titanium-900">
        {/* Per-day bars */}
        <div className="bg-obsidian-900/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-titanium-400">
              Events / Tag (14d)
            </h3>
            <TrendingUp className="h-3.5 w-3.5 text-titanium-500" />
          </div>
          <DayBars buckets={perDay} />
        </div>

        {/* Risk distribution stacked bar */}
        <div className="bg-obsidian-900/60 p-4">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mb-3">
            Risk-Verteilung
          </h3>
          <RiskStack data={byRisk} total={events.length} />
          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-titanium-300">
            <Stat label="Blockiert"     value={byActionBlocked} tone="danger" />
            <Stat label="Warn"          value={byActionWarn}    tone="warn" />
            <Stat label="Approval req." value={byActionApprove} tone="approve" />
            <Stat label="Insgesamt"     value={events.length}   tone="neutral" />
          </div>
        </div>

        {/* Top vendors */}
        <div className="bg-obsidian-900/60 p-4">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mb-3">
            Top Vendors
          </h3>
          <HorizontalBars data={byVendor} max={byVendor[0]?.count ?? 1} />
        </div>

        {/* Top sources */}
        <div className="bg-obsidian-900/60 p-4">
          <h3 className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mb-3">
            Event-Sources
          </h3>
          <HorizontalBars data={bySource} max={bySource[0]?.count ?? 1} />
        </div>
      </div>
    </section>
  );
}

/* ── Aggregations ──────────────────────────────────────────────── */

function bucketPerDay(events: DbGovernanceEvent[], days: number): Array<{ day: string; count: number; riskCount: number }> {
  const buckets = new Map<string, { count: number; riskCount: number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.set(dayKey(d), { count: 0, riskCount: 0 });
  }
  for (const e of events) {
    const key = dayKey(new Date(e.created_at));
    const b = buckets.get(key);
    if (!b) continue;
    b.count++;
    if (e.risk_level === 'high' || e.risk_level === 'critical') b.riskCount++;
  }
  return Array.from(buckets.entries()).map(([day, v]) => ({ day, count: v.count, riskCount: v.riskCount }));
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countBy<T>(items: T[], pick: (i: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = pick(i);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function topN(m: Map<string, number>, n: number): Array<{ label: string; count: number }> {
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/* ── Sub-components ───────────────────────────────────────────── */

function DayBars({ buckets }: { buckets: Array<{ day: string; count: number; riskCount: number }> }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div>
      <div className="flex items-end gap-0.5 h-24">
        {buckets.map((b) => {
          const totalH = (b.count / max) * 100;
          const riskH = (b.riskCount / max) * 100;
          return (
            <div key={b.day} className="flex-1 flex flex-col-reverse" title={`${b.day}: ${b.count} (${b.riskCount} high+critical)`}>
              <div className="bg-titanium-700" style={{ height: `${totalH}%` }}>
                <div className="bg-rose-500/80 h-full" style={{ height: `${(riskH / Math.max(totalH, 1)) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-mono text-titanium-500">
        <span>{buckets[0]?.day.slice(5) ?? ''}</span>
        <span>{buckets[buckets.length - 1]?.day.slice(5) ?? ''}</span>
      </div>
      <div className="mt-1.5 flex gap-3 text-[10px] text-titanium-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-titanium-700" /> Total
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 bg-rose-500/80" /> High + Critical
        </span>
      </div>
    </div>
  );
}

function RiskStack({
  data, total,
}: { data: Array<{ key: GovernanceRiskLevel; count: number }>; total: number }) {
  return (
    <>
      <div className="flex h-6 border border-titanium-900 overflow-hidden">
        {data.map((d) => {
          const w = total > 0 ? (d.count / total) * 100 : 0;
          return (
            <div
              key={d.key}
              className={`${RISK_COLOR[d.key]} h-full`}
              style={{ width: `${w}%` }}
              title={`${d.key}: ${d.count}`}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {data.map((d) => (
          <div key={d.key} className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-titanium-300">
              <span className={`inline-block w-2.5 h-2.5 ${RISK_COLOR[d.key]}`} />
              <span className="font-mono uppercase tracking-wider">{d.key}</span>
            </span>
            <span className="font-mono tabular-nums text-titanium-100">{d.count}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function HorizontalBars({ data, max }: { data: Array<{ label: string; count: number }>; max: number }) {
  if (data.length === 0) {
    return <div className="text-[11px] text-titanium-500">Keine Daten in der Ansicht.</div>;
  }
  return (
    <ul className="space-y-1.5">
      {data.map((d) => {
        const w = (d.count / Math.max(max, 1)) * 100;
        return (
          <li key={d.label}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-mono text-titanium-200 truncate max-w-[70%]">{d.label}</span>
              <span className="font-mono tabular-nums text-titanium-100">{d.count}</span>
            </div>
            <div className="h-1.5 bg-titanium-900">
              <div className="h-full bg-amber-500/70" style={{ width: `${w}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'danger' | 'warn' | 'approve';
}) {
  const cls =
    tone === 'danger'  ? 'border-rose-500/40 text-rose-200'   :
    tone === 'warn'    ? 'border-amber-500/40 text-amber-200' :
    tone === 'approve' ? 'border-sky-500/40 text-sky-200'     :
    'border-titanium-800 text-titanium-200';
  void RISK_BORDER; // keep import for future tone extensions
  return (
    <div className={`flex items-center justify-between border px-2 py-1 ${cls}`}>
      <span className="font-mono uppercase tracking-wider text-[10px]">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}
