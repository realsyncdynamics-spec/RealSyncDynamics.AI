import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { RuntimeKpi } from '../../lib/runtime/runtimeTypes';
import { RuntimeStatusBadge } from './RuntimeStatusBadge';

const STATE_LABEL: Record<RuntimeKpi['state'], string> = {
  demo:            'Demo',
  partial:         'Teilweise aktiv',
  review_required: 'Review erforderlich',
  not_connected:   'Nicht verbunden',
  live:            'Live',
};

const STATE_TONE: Record<RuntimeKpi['state'], 'demo' | 'warn' | 'success' | 'neutral'> = {
  demo:            'demo',
  partial:         'warn',
  review_required: 'warn',
  not_connected:   'neutral',
  live:            'success',
};

export function RuntimeKpiCard({ kpi }: { kpi: RuntimeKpi }) {
  return (
    <div className="rt-corner-frame border border-titanium-800 bg-obsidian-950 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">
          {kpi.label}
        </p>
        <RuntimeStatusBadge label={STATE_LABEL[kpi.state]} tone={STATE_TONE[kpi.state]} />
      </div>

      <p className="mt-3 font-display text-3xl font-bold tracking-tight text-titanium-50">
        {kpi.value}
        {kpi.unit ? (
          <span className="ml-1 font-mono text-sm text-titanium-400">{kpi.unit}</span>
        ) : null}
      </p>

      {kpi.delta || kpi.trend ? (
        <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-titanium-300">
          {kpi.trend === 'up'   ? <ArrowUpRight   className="h-3.5 w-3.5 text-rose-300" /> : null}
          {kpi.trend === 'down' ? <ArrowDownRight className="h-3.5 w-3.5 text-emerald-300" /> : null}
          {kpi.trend === 'flat' ? <Minus           className="h-3.5 w-3.5 text-titanium-500" /> : null}
          <span>{kpi.delta ?? '—'}</span>
        </div>
      ) : null}

      {kpi.hint ? (
        <p className="mt-3 border-t border-titanium-800/60 pt-2 text-[11px] text-titanium-500">
          {kpi.hint}
        </p>
      ) : null}
    </div>
  );
}
