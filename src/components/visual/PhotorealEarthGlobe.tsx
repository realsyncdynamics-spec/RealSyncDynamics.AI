import { lazy, Suspense, useEffect, useState } from 'react';

/**
 * Welcome-page Earth panel: photoreal globe on desktop.
 *
 * - Lazy-loads R3F/WebGL scene when WebGL is available and motion is allowed.
 * - Falls back to the existing `/europe-globe` photoreal hero asset otherwise
 *   (reduced motion, no WebGL, or while the 3D bundle loads).
 */

const PhotorealEarthScene = lazy(() => import('./PhotorealEarthScene'));

function usePrefersReducedMotion(): boolean {
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

function useWebGlAvailable(): boolean {
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

/** Static photoreal Earth — reuses the landing hero asset. */
function EarthStaticFallback({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="welcome-earth-halo" />
      <div className="welcome-earth-static">
        <picture>
          <source srcSet="/europe-globe.webp" type="image/webp" />
          <img
            src="/europe-globe.jpg"
            alt=""
            width={1376}
            height={768}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-[68%_42%]"
          />
        </picture>
        <div className="welcome-earth-static-shade" />
      </div>
    </div>
  );
}

function EarthSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
      <div className="welcome-earth-halo" />
      <div className="h-[min(72%,520px)] aspect-square rounded-full border border-ai-cyan-500/15 bg-[radial-gradient(circle_at_32%_28%,rgba(79,195,247,0.14),transparent_62%)]" />
    </div>
  );
}

export function PhotorealEarthGlobe() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  const use3d = webgl && !reducedMotion;

  return (
    <aside
      className="welcome-earth-panel relative hidden min-h-[min(100vh,920px)] overflow-hidden border-l border-titanium-900 bg-obsidian-950 lg:block"
      aria-label="Photorealistische Erdkugel"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,rgba(0,40,80,0.45)_0%,transparent_55%),linear-gradient(180deg,#02040a_0%,#0a0a0b_100%)]" />
      <div className="absolute inset-0 opacity-[0.35]" style={{
        backgroundImage:
          'radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.35), transparent), radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,0.25), transparent), radial-gradient(1px 1px at 45% 75%, rgba(255,255,255,0.2), transparent), radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.28), transparent)',
        backgroundSize: '100% 100%',
      }} />

      <div className="absolute inset-0">
        {use3d ? (
          <Suspense fallback={<EarthSkeleton />}>
            <div className="absolute inset-0">
              <PhotorealEarthScene reducedMotion={reducedMotion} />
            </div>
            {/* Soft vignette so the form edge stays readable */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-obsidian-950 to-transparent"
              aria-hidden="true"
            />
          </Suspense>
        ) : (
          <EarthStaticFallback />
        )}
      </div>

      <div className="pointer-events-none absolute bottom-8 left-8 right-8 z-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ai-cyan-400/80">
          EU · Sovereign · Governance
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-titanium-400">
          AI Governance für Europa — Herkunftsnachweis und Prüfpfad in einer Runtime.
        </p>
      </div>
    </aside>
  );
}
