import type { ModuleStatus } from './governanceBrowserTypes';

const STYLES: Record<ModuleStatus, string> = {
  live:     'bg-emerald-950 text-emerald-300 border border-emerald-800',
  beta:     'bg-amber-950 text-amber-300 border border-amber-800',
  roadmap:  'bg-obsidian-800 text-titanium-400 border border-obsidian-700',
};

const LABELS: Record<ModuleStatus, string> = {
  live:    'Live',
  beta:    'Beta',
  roadmap: 'Roadmap',
};

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
