/**
 * Public landing hero backdrop — full-bleed photoreal Earth (desktop fill).
 *
 * Passive scenery behind Dominik copy: pointer-events none so CTAs stay
 * clickable. WebGL day/night mesh may idle-rotate; no drag HUD, no Sphere
 * DEMO chrome, no continent UI labels. Static Europe night plane under WebGL
 * for first paint.
 */
import { Suspense, useEffect, useState } from 'react';
import { HeroEarthBackdropScene } from './HeroEarthBackdropScene';

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
  const [ok, setOk] = useState(false);
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

/** Night-Europe photoreal plane — always present as the planet base layer. */
function StaticEarthPlane({ className = '' }: { className?: string }) {
  return (
    <div
      className={`hero-earth-static pointer-events-none absolute inset-0 ${className}`.trim()}
      aria-hidden="true"
    >
      <picture>
        <source srcSet="/europe-globe.webp" type="image/webp" />
        <img
          src="/europe-globe.jpg"
          alt=""
          width={1376}
          height={768}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full scale-[1.35] object-cover object-[50%_58%] opacity-100"
        />
      </picture>
      {/* Soft readability only — no cream sunrise wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'linear-gradient(105deg, transparent 10%, rgba(5,7,11,0.12) 48%, rgba(5,7,11,0.42) 78%, rgba(5,7,11,0.62) 100%)',
            'radial-gradient(40% 34% at 16% 56%, rgba(208,195,164,0.08) 0%, transparent 64%)',
          ].join(', '),
        }}
      />
    </div>
  );
}

function Starfield() {
  return (
    <div
      className="hero-earth-stars pointer-events-none absolute inset-0 opacity-40"
      aria-hidden="true"
      style={{
        backgroundImage: [
          'radial-gradient(1px 1px at 8% 12%, rgba(242,238,230,0.35), transparent)',
          'radial-gradient(1px 1px at 18% 28%, rgba(208,195,164,0.28), transparent)',
          'radial-gradient(1.5px 1.5px at 32% 8%, rgba(239,230,213,0.3), transparent)',
          'radial-gradient(1px 1px at 55% 18%, rgba(208,195,164,0.22), transparent)',
          'radial-gradient(1px 1px at 72% 10%, rgba(242,238,230,0.26), transparent)',
          'radial-gradient(1px 1px at 88% 22%, rgba(208,195,164,0.18), transparent)',
          'radial-gradient(1.5px 1.5px at 12% 55%, rgba(242,238,230,0.2), transparent)',
          'radial-gradient(1px 1px at 42% 70%, rgba(208,195,164,0.18), transparent)',
          'radial-gradient(1px 1px at 78% 62%, rgba(239,230,213,0.2), transparent)',
          'radial-gradient(1px 1px at 94% 78%, rgba(242,238,230,0.14), transparent)',
        ].join(','),
        backgroundSize: '100% 100%',
      }}
    />
  );
}

/**
 * Restrained warm rim only — must never hide continents / city lights.
 * No hard sun disc, no cream blob, no screen-blend wash.
 */
function WarmRimLight() {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="absolute"
        style={{
          left: '-2%',
          top: '22%',
          width: 'min(32vw, 380px)',
          height: 'min(48vw, 560px)',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 72% 48%, rgba(208,195,164,0.28) 0%, rgba(180,140,80,0.1) 36%, transparent 68%)',
          filter: 'blur(22px)',
          opacity: 0.65,
        }}
      />
    </div>
  );
}

export function HeroEarthBackdrop() {
  const reducedMotion = usePrefersReducedMotion();
  const webgl = useWebGlAvailable();
  // Defer WebGL one tick so first paint + sticky CTA stay actionable (E2E).
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    if (!webgl || reducedMotion) return;
    let cancelled = false;
    const boot = () => {
      if (!cancelled) setSceneReady(true);
    };
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(boot, { timeout: 900 });
      return () => {
        cancelled = true;
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(boot, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [webgl, reducedMotion]);
  const use3d = webgl && !reducedMotion && sceneReady;

  return (
    <div
      className="hero-earth-backdrop absolute inset-0 overflow-hidden"
      data-hero-visual="earth-universe"
      data-earth-palette="landing-gold"
      data-hero-lighting="night-rim"
      data-landing-earth={use3d ? 'scenery' : 'static'}
      aria-hidden="true"
    >
      {/* Deep space base */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 28% 48%, #080a10 0%, #05070c 42%, #02040a 72%, #010308 100%)',
        }}
      />
      <Starfield />
      <WarmRimLight />

      {/* Photoreal Europe night — always under WebGL so planet never blanks */}
      <StaticEarthPlane />

      {use3d && (
        <div className="hero-earth-canvas absolute inset-0" data-landing-earth>
          <Suspense fallback={null}>
            <div className="absolute inset-0">
              <HeroEarthBackdropScene reducedMotion={reducedMotion} />
            </div>
          </Suspense>
        </div>
      )}

      {/* Light veil for type — keep Earth readable as the visual anchor */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 55% 32% at 28% 18%, rgba(5,7,11,0.38) 0%, rgba(5,7,11,0.1) 55%, transparent 78%)',
            'linear-gradient(180deg, rgba(5,7,11,0.28) 0%, transparent 14%, transparent 62%, rgba(5,7,11,0.45) 100%)',
          ].join(', '),
        }}
      />
    </div>
  );
}
