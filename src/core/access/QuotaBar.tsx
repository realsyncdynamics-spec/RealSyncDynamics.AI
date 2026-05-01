import React from 'react';
import { Infinity as InfinityIcon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useUsage } from './usage';

interface Props {
  /** Entitlement key, e.g. "limit.ai_tokens_monthly". */
  feature: string;
  /** Display label; defaults to the entitlement key. */
  label?: string;
  /** Format the number for display (e.g. shorten 1.2k, $-cents → USD). */
  format?: (n: number) => string;
  className?: string;
}

/**
 * Visual progress bar showing current usage against the per-plan limit
 * for the active tenant. Reads `usage_totals` for the current month.
 *
 * Color states:
 *   < 75 %  emerald
 *   < 90 %  amber
 *   ≥ 90 %  red
 *   limit = -1  shows ∞ badge instead of a bar
 */
export function QuotaBar({ feature, label, format = (n) => n.toLocaleString('de-DE'), className }: Props) {
  const { loading, total, limit } = useUsage(feature);

  const displayLabel = label ?? feature;

  if (loading) {
    return (
      <div className={`p-3 bg-white border border-slate-200 rounded-xl ${className ?? ''}`}>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{displayLabel}</div>
        <div className="mt-2 h-2 bg-slate-100 rounded-full animate-pulse" />
      </div>
    );
  }

  const cur = total ?? 0;

  // Unlimited
  if (limit === -1) {
    return (
      <div className={`p-3 bg-white border border-slate-200 rounded-xl ${className ?? ''}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{displayLabel}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-0.5">
            <InfinityIcon className="h-3 w-3" /> unlimited
          </span>
        </div>
        <div className="mt-1.5 text-sm text-slate-700">{format(cur)} verbraucht</div>
      </div>
    );
  }

  // No quota (limit null or 0): show as locked
  if (limit === null || limit === 0) {
    return (
      <div className={`p-3 bg-slate-50 border border-slate-200 rounded-xl ${className ?? ''}`}>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{displayLabel}</div>
        <div className="mt-1.5 text-xs text-slate-500">Im aktuellen Plan nicht enthalten</div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((cur / limit) * 100));
  const tone =
    pct >= 90 ? 'red' :
    pct >= 75 ? 'amber' :
    'emerald';
  const colors = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-700', icon: CheckCircle2 },
    amber:   { bar: 'bg-amber-500',   text: 'text-amber-700',   icon: AlertTriangle },
    red:     { bar: 'bg-red-500',     text: 'text-red-700',     icon: AlertTriangle },
  }[tone];
  const Icon = colors.icon;

  return (
    <div className={`p-3 bg-white border border-slate-200 rounded-xl ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{displayLabel}</span>
        <span className={`inline-flex items-center gap-1 text-xs font-bold ${colors.text}`}>
          <Icon className="h-3 w-3" />
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colors.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-sm text-slate-700">
        {format(cur)} <span className="text-slate-400">/ {format(limit)}</span>
      </div>
    </div>
  );
}
