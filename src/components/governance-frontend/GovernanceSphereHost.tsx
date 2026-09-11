import { lazy, Suspense, useEffect, useState } from 'react';
import {
  GOVERNANCE_SPHERE_NODES,
  SPHERE_DEMO_LABEL,
  SPHERE_DEMO_NOTE,
  type GovernanceSphereNode,
} from './governance-sphere-nodes';
import { GovernanceSphereFallback } from './GovernanceSphereFallback';
import {
  LANDING_ACCENT,
  LANDING_GREEN,
  LANDING_LABEL,
  LANDING_LINE,
  LANDING_LINE_ACCENT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_TEXT,
  LANDING_WARN,
} from '../landing/landing-theme';

const GovernanceSphereScene = lazy(() => import('./GovernanceSphereScene'));

/** Status row chrome — demo states only; cyan enterprise tokens. */
const STATUS_CHROME = [
  { id: 'detect-assets', label: 'Asset Discovery', tone: 'ok' as const },
  { id: 'detect-risk', label: 'Risk Signals', tone: 'warn' as const },
  { id: 'govern-policy', label: 'Policy Control', tone: 'ok' as const },
] as const;

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
      className="absolute bottom-3 left-3 right-3 z-20 overflow-hidden border p-4 backdrop-blur-xl sm:left-auto sm:right-3 sm:w-[min(100%,17.5rem)]"
      style={{
        borderColor: LANDING_LINE_ACCENT,
        backgroundColor: 'rgba(5,7,11,0.82)',
        boxShadow: '0 0 32px rgba(0,229,255,0.06)',
      }}
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/45 to-transparent"
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[9px] tracking-[.2em]"
            style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
          >
            {node.phase.toUpperCase()} · {node.state === 'operational' ? 'OPERATIONAL' : 'ATTENTION'}
          </p>
          <h3 className="mt-1 text-sm font-semibold" style={{ color: LANDING_TEXT }}>
            {node.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[10px] tracking-[.12em] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/50"
          style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
          aria-label="Close node details"
        >
          ESC
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: LANDING_MUTED }}>
        {node.summary}
      </p>
      {node.detail && (
        <p
          className="mt-2 text-[10px] tracking-[.08em]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
        >
          {node.detail}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[9px] tracking-[.14em]" style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}>
          DEMO DATA
        </p>
        <p className="text-[8px] tracking-[.16em]" style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}>
          SIMULATED
        </p>
      </div>
    </aside>
  );
}

function SphereSkeleton() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center" aria-hidden="true">
      <div
        className="h-48 w-48 rounded-full border"
        style={{
          borderColor: LANDING_LINE_ACCENT,
          background:
            'radial-gradient(circle at 35% 30%, rgba(0,229,255,0.10), transparent 65%)',
        }}
      />
    </div>
  );
}

/**
 * Host for the Interactive Governance Sphere on `/`.
 * Lazy-loads WebGL; falls back to a lightweight 2D map when reduced-motion
 * is set or WebGL is unavailable. Chrome inherits landing enterprise tokens.
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
    <div className="relative flex min-h-[520px] w-full flex-col justify-center" data-governance-sphere>
      <div className="mb-3 ml-1 flex flex-col gap-[7px] sm:ml-5">
        <p
          className="text-[8px] tracking-[.16em]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
        >
          {SPHERE_DEMO_LABEL}
        </p>
        <p
          className="text-[8px] tracking-[.16em]"
          style={{ fontFamily: LANDING_MONO, color: 'rgba(255,255,255,0.28)' }}
        >
          DETECT · GOVERN · PROVE · AUTOMATE
        </p>
      </div>

      <div
        className="sphere-panel relative overflow-hidden border p-3 shadow-[0_20px_70px_rgba(0,0,0,0.5)]"
        style={{
          borderColor: LANDING_LINE,
          backgroundColor: `${LANDING_PANEL}a3`,
        }}
      >
        <div
          className="flex justify-around px-1 pb-3.5 pt-1 text-[8px]"
          style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
          aria-label="Simulated governance status"
        >
          {STATUS_CHROME.map((item) => (
            <button
              key={item.id}
              type="button"
              className="inline-flex items-center gap-1.5 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00E5FF]/50"
              style={{ color: LANDING_LABEL }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = LANDING_TEXT;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = LANDING_LABEL;
              }}
              onClick={() => {
                const node = GOVERNANCE_SPHERE_NODES.find((n) => n.id === item.id) ?? null;
                handleSelect(selected?.id === item.id ? null : node);
              }}
              aria-pressed={selected?.id === item.id}
            >
              <i
                className="inline-block h-[5px] w-[5px] rounded-full"
                style={{
                  backgroundColor: item.tone === 'ok' ? LANDING_GREEN : LANDING_WARN,
                  boxShadow:
                    item.tone === 'ok'
                      ? `0 0 8px ${LANDING_GREEN}`
                      : `0 0 8px ${LANDING_WARN}`,
                }}
                aria-hidden="true"
              />
              {item.label}
              <span className="sr-only"> (DEMO)</span>
            </button>
          ))}
        </div>

        <div className="relative min-h-[340px] sm:min-h-[390px] lg:min-h-[420px]">
          <div
            className="pointer-events-none absolute inset-0 z-[1] shadow-[inset_0_0_0_1px_rgba(0,229,255,0.06),inset_0_0_80px_rgba(0,40,80,0.22)]"
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
            <div className="flex h-full min-h-[340px] items-center justify-center p-4 sm:min-h-[390px]">
              <GovernanceSphereFallback
                selectedId={selected?.id ?? null}
                onSelect={handleSelect}
              />
            </div>
          )}

          {use3d && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
              <div
                className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-full border bg-black/65 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ borderColor: LANDING_LINE }}
              >
                {GOVERNANCE_SPHERE_NODES.map((node) => {
                  const active = selected?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      draggable={false}
                      onClick={() => handleSelect(active ? null : node)}
                      className="shrink-0 select-none rounded-full px-2.5 py-1 text-[9px] tracking-[.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/60"
                      style={{
                        fontFamily: LANDING_MONO,
                        backgroundColor: active ? 'rgba(0,229,255,0.16)' : 'transparent',
                        color: active ? LANDING_ACCENT : 'rgba(244,246,248,0.55)',
                        boxShadow: active ? '0 0 14px rgba(0,229,255,0.12)' : undefined,
                      }}
                      aria-pressed={active}
                    >
                      <span
                        className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            node.state === 'operational' ? LANDING_GREEN : LANDING_WARN,
                          boxShadow:
                            node.state === 'operational'
                              ? '0 0 6px rgba(32,214,154,0.65)'
                              : '0 0 6px rgba(0,184,212,0.55)',
                        }}
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
        </div>

        {!selected && (
          <p
            className="px-0.5 py-2.5 text-[8px]"
            style={{ fontFamily: LANDING_MONO, color: LANDING_LABEL }}
          >
            Ziehen · Zoom für Länder & Hauptstädte · Doppelklick Reset · Knoten tippen
          </p>
        )}
      </div>

      <p
        className="mt-2 ml-1 max-w-md text-[7px] leading-relaxed sm:ml-1"
        style={{ fontFamily: LANDING_MONO, color: 'rgba(255,255,255,0.22)' }}
      >
        {SPHERE_DEMO_NOTE}
      </p>
      <p className="sr-only" style={{ color: LANDING_MUTED }}>
        Simulated system state. No production KPIs.
      </p>
    </div>
  );
}
