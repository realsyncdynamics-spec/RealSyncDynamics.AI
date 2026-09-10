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
      const gl =
        canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
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
      className="surface-panel absolute bottom-3 left-3 right-3 z-20 rounded-2xl border border-[#e8c98a]/25 bg-black/70 p-4 backdrop-blur-xl sm:left-auto sm:right-3 sm:w-[min(100%,17.5rem)]"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-[.2em] text-[#e8c98a]/80">
            {node.phase.toUpperCase()} · {node.state === 'operational' ? 'OPERATIONAL' : 'ATTENTION'}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 font-mono text-[10px] tracking-[.12em] text-white/45 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/50"
          aria-label="Close node details"
        >
          ESC
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/55">{node.summary}</p>
      {node.detail && (
        <p className="mt-2 font-mono text-[10px] tracking-[.08em] text-white/35">{node.detail}</p>
      )}
      <p className="mt-3 font-mono text-[9px] tracking-[.14em] text-[#e8c98a]/55">DEMO DATA</p>
    </aside>
  );
}

function SphereSkeleton() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center" aria-hidden="true">
      <div className="h-48 w-48 rounded-full border border-[#e8c98a]/20 bg-[radial-gradient(circle_at_35%_30%,rgba(232,201,138,0.12),transparent_65%)]" />
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
          <p className="font-mono text-[10px] tracking-[.22em] text-[#e8c98a]/85">
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

      <div className="relative min-h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 landing-hero-glass sm:min-h-[400px] lg:min-h-[460px]">
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

        {selected && <NodePanel node={selected} onClose={() => setSelected(null)} />}

        {!selected && (
          <p className="pointer-events-none absolute bottom-3 left-3 right-3 font-mono text-[9px] tracking-[.12em] text-white/30 sm:right-auto sm:max-w-[16rem]">
            Drag to rotate · Scroll / pinch to zoom · Tap a node for context
          </p>
        )}
      </div>

      <p className="mt-3 max-w-md text-[10px] leading-relaxed text-white/35">{SPHERE_DEMO_NOTE}</p>
    </div>
  );
}
