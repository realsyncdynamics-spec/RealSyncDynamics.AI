import { lazy, Suspense, useEffect, useState } from 'react';
import {
  GOVERNANCE_SPHERE_NODES,
  SPHERE_DEMO_LABEL,
  SPHERE_DEMO_NOTE,
  type GovernanceSphereNode,
} from './governance-sphere-nodes';
import { GovernanceSphereFallback } from './GovernanceSphereFallback';

const GovernanceSphereScene = lazy(() => import('./GovernanceSphereScene'));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useWebGlAvailable() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      // Prefer any WebGL context. Major-performance caveat would force 2D
      // on many remote/VM GPUs even when a decorative sphere runs fine.
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setOk(Boolean(gl));
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

function NodePanel({
  node,
  onClose,
}: {
  node: GovernanceSphereNode;
  onClose: () => void;
}) {
  return (
    <aside
      className="surface-panel absolute bottom-3 left-3 right-3 z-20 overflow-hidden rounded-2xl border border-[#16d9ff]/28 bg-black/72 p-4 shadow-[0_0_40px_rgba(22,217,255,0.08)] backdrop-blur-xl sm:left-auto sm:right-3 sm:w-[min(100%,17.5rem)]"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#16d9ff]/55 to-transparent"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-[.2em] text-[#16d9ff]/80">
            {node.phase.toUpperCase()} · {node.state === 'operational' ? 'OPERATIONAL' : 'ATTENTION'}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 font-mono text-[10px] tracking-[.12em] text-white/45 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16d9ff]/50"
          aria-label="Close node details"
        >
          ESC
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{node.summary}</p>
      {node.detail && (
        <p className="mt-2 font-mono text-[10px] tracking-[.08em] text-white/35">{node.detail}</p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[9px] tracking-[.14em] text-[#16d9ff]/55">DEMO DATA</p>
        <p className="font-mono text-[8px] tracking-[.16em] text-white/25">SIMULATED</p>
      </div>
    </aside>
  );
}

function SphereSkeleton() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center" aria-hidden="true">
      <div className="h-48 w-48 rounded-full border border-[#16d9ff]/20 bg-[radial-gradient(circle_at_35%_30%,rgba(22,217,255,0.12),transparent_65%)]" />
    </div>
  );
}

/**
 * Host for the Interactive Governance Sphere on `/`.
 * Lazy-loads WebGL; falls back to a lightweight 2D map when reduced-motion
 * is set or WebGL is unavailable.
 */
export function GovernanceSphereHost() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  const [selected, setSelected] = useState<GovernanceSphereNode | null>(null);
  const use3d = webgl && !reducedMotion;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const handleSelect = (node: GovernanceSphereNode | null) => {
    setSelected(node);
  };

  return (
    <div className="relative w-full" data-governance-sphere>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] tracking-[.22em] text-[#16d9ff]/85">
            {SPHERE_DEMO_LABEL}
          </p>
          <p className="mt-1 font-mono text-[9px] tracking-[.16em] text-white/35">
            DETECT · GOVERN · PROVE · AUTOMATE
          </p>
        </div>
        <p className="font-mono text-[9px] tracking-[.14em] text-white/30">
          {GOVERNANCE_SPHERE_NODES.filter((n) => n.state === 'operational').length} OPERATIONAL ·{' '}
          {GOVERNANCE_SPHERE_NODES.filter((n) => n.state === 'attention').length} ATTENTION
          <span className="ml-1 text-white/20">(sim)</span>
        </p>
      </div>

      <div className="relative min-h-[340px] overflow-hidden rounded-[2rem] bg-transparent sm:min-h-[400px] lg:min-h-[460px]">
        {/* Soft FUI frame — keeps chrome cohesive without cluttering the globe */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] rounded-2xl shadow-[inset_0_0_0_1px_rgba(22,217,255,0.06),inset_0_0_80px_rgba(0,40,80,0.25)]"
          aria-hidden="true"
        />
        {use3d ? (
          <Suspense fallback={<SphereSkeleton />}>
            <div className="absolute inset-0 cursor-grab active:cursor-grabbing">
              <GovernanceSphereScene
                selectedId={selected?.id ?? null}
                onSelect={handleSelect}
                reducedMotion={reducedMotion}
              />
            </div>
          </Suspense>
        ) : (
          <div className="flex h-full min-h-[340px] items-center justify-center p-4 sm:min-h-[400px]">
            <GovernanceSphereFallback
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </div>
        )}

        {/* Always-on HTML picker — reliable hit targets + a11y alongside 3D. */}
        {use3d && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
            <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-[#16d9ff]/15 bg-black/60 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {GOVERNANCE_SPHERE_NODES.map((node) => {
                const active = selected?.id === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    draggable={false}
                    onClick={() => handleSelect(active ? null : node)}
                    className={`shrink-0 select-none rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16d9ff]/60 ${
                      active
                        ? 'bg-[#16d9ff]/22 text-[#9af5ff] shadow-[0_0_16px_rgba(22,217,255,0.18)]'
                        : 'text-white/55 hover:bg-white/10 hover:text-white/85'
                    }`}
                    aria-pressed={active}
                  >
                    <span
                      className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                        node.state === 'operational'
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]'
                          : 'bg-[#d4a574] shadow-[0_0_6px_rgba(212,165,116,0.65)]'
                      }`}
                      aria-hidden="true"
                    />
                    {node.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected && <NodePanel node={selected} onClose={() => setSelected(null)} />}

        {!selected && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 font-mono text-[9px] tracking-[.12em] text-white/35 sm:right-auto sm:max-w-[18rem]">
            Drag · inertia · scroll/pinch zoom · double-click reset · tap a node
          </p>
        )}
      </div>

      <p className="mt-3 max-w-md text-[10px] leading-relaxed text-white/35">{SPHERE_DEMO_NOTE}</p>
    </div>
  );
}
