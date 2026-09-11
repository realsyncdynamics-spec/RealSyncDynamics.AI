import {
  GOVERNANCE_SPHERE_NODES,
  type GovernanceSphereNode,
  type SphereNodeState,
} from './governance-sphere-nodes';

function stateDot(state: SphereNodeState) {
  return state === 'operational' ? 'bg-emerald-400' : 'bg-[#ffb86b]';
}

/**
 * Lightweight 2D fallback when WebGL is unavailable or reduced-motion is on.
 * Still shows a photoreal Earth crop (not a blank wireframe disc) so the
 * homepage contract remains visually clear.
 */
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
      aria-label="Governance Sphere — photoreal Earth overview"
    >
      <div
        className="absolute inset-[10%] overflow-hidden rounded-full border border-[#16d9ff]/25 shadow-[0_0_60px_rgba(22,217,255,0.12)]"
        aria-hidden="true"
      >
        <picture>
          <source srcSet="/europe-globe.webp" type="image/webp" />
          <img
            src="/europe-globe.jpg"
            alt=""
            width={1376}
            height={768}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-[62%_42%] scale-110"
          />
        </picture>
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_32%_28%,transparent_0%,transparent_42%,rgba(2,4,10,0.35)_78%,rgba(2,4,10,0.72)_100%)]"
          aria-hidden="true"
        />
      </div>
      <div
        className="absolute inset-[4%] rounded-full border border-[#16d9ff]/15"
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
                className={`w-full select-none rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16d9ff]/60 ${
                  active
                    ? 'border-[#16d9ff]/55 bg-[#16d9ff]/12 backdrop-blur-md'
                    : 'border-white/10 bg-black/45 backdrop-blur-md hover:border-[#16d9ff]/35 hover:bg-black/55'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${stateDot(node.state)}`} />
                  <span className="font-mono text-[9px] tracking-[.16em] text-[#16d9ff]/85">
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
