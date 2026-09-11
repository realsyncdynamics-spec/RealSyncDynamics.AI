import type { ModuleStatus } from './governanceBrowserTypes';

/**
 * Maturity badges for Governance OS navigation.
 * Cyan = Live (primary/active). Amber = Beta. Muted titanium = Roadmap.
 * Emerald/orange/red remain reserved for risk/status signals elsewhere.
 */
const STYLES: Record<ModuleStatus, string> = {
  live: 'bg-cyan-950/50 text-cyan-300/90 border border-cyan-900/70',
  beta: 'bg-amber-950/50 text-amber-300 border border-amber-900/70',
  roadmap: 'bg-obsidian-950 text-titanium-500 border border-titanium-800',
};

const LABELS: Record<ModuleStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  roadmap: 'Roadmap',
};

export function ModuleStatusBadge({
  status,
  /** Tab strip: hide Live to reduce noise; Beta/Roadmap stay visible. */
  quietLive = false,
}: {
  status: ModuleStatus;
  quietLive?: boolean;
}) {
  if (quietLive && status === 'live') return null;
  return (
    <span className={`font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}

/**
 * Entitlement gate chip for locked tabs — shows the minimum plan that unlocks
 * the module (existing gate info), not a false "you are entitled" claim.
 */
export function EntitlementBadge({ planLabel }: { planLabel: string }) {
  return (
    <span
      className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-titanium-800 bg-obsidian-950 text-titanium-600"
      title={`Entitled ab ${planLabel}`}
      data-testid="entitlement-badge"
    >
      {planLabel}
    </span>
  );
}
