import {
  GOVERNANCE_SPHERE_NODES,
  type GovernanceSphereNode,
  type SphereNodeState,
} from './governance-sphere-nodes';

function stateDot(state: SphereNodeState) {
  return state === 'operational' ? 'bg-emerald-400' : 'bg-[#d4a574]';
}

export function GovernanceSphereFallback({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (node: GovernanceSphereNode | null) => void;
}) {
  return (
    <div
      className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center"
      role="img"
      aria-label="Governance Sphere — lightweight 2D overview"
    >
      <div
        className="absolute inset-[12%] rounded-full border border-[#e8c98a]/25 bg-[radial-gradient(circle_at_32%_28%,rgba(243,217,160,0.16),rgba(10,16,28,0.92)_58%,#05070d_100%)] shadow-[0_0_60px_rgba(232,201,138,0.12)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-[6%] rounded-full border border-[#e8c98a]/15"
        aria-hidden="true"
      />
      <div
        className="absolute inset-[22%] rounded-full border border-dashed border-white/10"
        aria-hidden="true"
      />

      <ul className="relative z-10 grid w-[78%] grid-cols-2 gap-2.5">
        {GOVERNANCE_SPHERE_NODES.map((node) => {
          const active = selectedId === node.id;
          return (
            <li key={node.id}>
              <button
                type="button"
                draggable={false}
                onClick={() => onSelect(active ? null : node)}
                className={`w-full select-none rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/60 ${
                  active
                    ? 'border-[#e8c98a]/55 bg-[#e8c98a]/12'
                    : 'border-white/10 bg-black/35 hover:border-[#e8c98a]/35 hover:bg-black/45'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${stateDot(node.state)}`} />
                  <span className="font-mono text-[9px] tracking-[.16em] text-[#e8c98a]/85">
                    {node.phase.toUpperCase()}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-medium text-white/90">{node.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
