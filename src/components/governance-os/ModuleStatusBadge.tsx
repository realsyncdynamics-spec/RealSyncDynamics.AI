import type { ModuleStatus } from './governanceBrowserTypes';

const CLASS_BY_STATUS: Record<ModuleStatus, string> = {
  live: 'badge-live',
  beta: 'badge-beta',
  roadmap: 'badge-roadmap',
};

const LABELS: Record<ModuleStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  roadmap: 'Roadmap',
};

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span
      className={`${CLASS_BY_STATUS[status]} font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5`}
    >
      {LABELS[status]}
    </span>
  );
}
