/**
 * Public landing hero backdrop — full-bleed photoreal Earth (desktop fill).
 *
 * Passive scenery behind Dominik copy: pointer-events none so CTAs stay
 * clickable. WebGL day/night mesh may idle-rotate; no drag HUD, no Sphere
 * DEMO chrome, no continent UI labels. Static Europe night plane under WebGL
 * for first paint.
 *
 * Deep-space layer: CSS starfield + distant Mars/Jupiter/Saturn discs, plus an
 * occasional drifting Moon (reduced-motion: faint static moon, no drift).
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

/**
 * Night-space starfield — denser than a flat void; cream/gold pinpoints only.
 * Layers stay behind Earth + type; never compete with H1.
 */
function Starfield() {
  return (
    <div className="hero-earth-stars pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Far field — dense dust */}
      <div
        className="hero-earth-stars-far absolute inset-0 opacity-[0.72]"
        style={{
          backgroundImage: [
            'radial-gradient(1px 1px at 4% 9%, rgba(242,238,230,0.55), transparent)',
            'radial-gradient(1px 1px at 9% 22%, rgba(208,195,164,0.4), transparent)',
            'radial-gradient(1.5px 1.5px at 14% 6%, rgba(239,230,213,0.5), transparent)',
            'radial-gradient(1px 1px at 19% 31%, rgba(242,238,230,0.32), transparent)',
            'radial-gradient(1px 1px at 24% 14%, rgba(208,195,164,0.38), transparent)',
            'radial-gradient(1px 1px at 31% 4%, rgba(239,230,213,0.48), transparent)',
            'radial-gradient(1.5px 1.5px at 37% 19%, rgba(242,238,230,0.42), transparent)',
            'radial-gradient(1px 1px at 43% 8%, rgba(208,195,164,0.28), transparent)',
            'radial-gradient(1px 1px at 49% 26%, rgba(239,230,213,0.35), transparent)',
            'radial-gradient(1px 1px at 55% 11%, rgba(242,238,230,0.45), transparent)',
            'radial-gradient(1.5px 1.5px at 61% 3%, rgba(208,195,164,0.4), transparent)',
            'radial-gradient(1px 1px at 67% 17%, rgba(239,230,213,0.3), transparent)',
            'radial-gradient(1px 1px at 73% 7%, rgba(242,238,230,0.52), transparent)',
            'radial-gradient(1px 1px at 79% 24%, rgba(208,195,164,0.34), transparent)',
            'radial-gradient(1.5px 1.5px at 85% 9%, rgba(239,230,213,0.44), transparent)',
            'radial-gradient(1px 1px at 91% 20%, rgba(242,238,230,0.36), transparent)',
            'radial-gradient(1px 1px at 96% 5%, rgba(208,195,164,0.42), transparent)',
            'radial-gradient(1px 1px at 7% 48%, rgba(242,238,230,0.28), transparent)',
            'radial-gradient(1px 1px at 16% 58%, rgba(208,195,164,0.22), transparent)',
            'radial-gradient(1px 1px at 28% 44%, rgba(239,230,213,0.26), transparent)',
            'radial-gradient(1.5px 1.5px at 52% 38%, rgba(242,238,230,0.3), transparent)',
            'radial-gradient(1px 1px at 64% 52%, rgba(208,195,164,0.2), transparent)',
            'radial-gradient(1px 1px at 81% 46%, rgba(239,230,213,0.28), transparent)',
            'radial-gradient(1px 1px at 93% 55%, rgba(242,238,230,0.24), transparent)',
            'radial-gradient(1px 1px at 12% 72%, rgba(208,195,164,0.18), transparent)',
            'radial-gradient(1px 1px at 38% 68%, rgba(239,230,213,0.2), transparent)',
            'radial-gradient(1px 1px at 58% 76%, rgba(242,238,230,0.16), transparent)',
            'radial-gradient(1px 1px at 76% 70%, rgba(208,195,164,0.18), transparent)',
            'radial-gradient(1px 1px at 88% 82%, rgba(239,230,213,0.14), transparent)',
            'radial-gradient(1px 1px at 98% 66%, rgba(242,238,230,0.2), transparent)',
          ].join(','),
          backgroundSize: '100% 100%',
        }}
      />
      {/* Near field — brighter pinpoints + soft nebula haze */}
      <div
        className="hero-earth-stars-near absolute inset-0 opacity-[0.85]"
        style={{
          backgroundImage: [
            'radial-gradient(1.5px 1.5px at 22% 12%, rgba(255,248,235,0.7), transparent)',
            'radial-gradient(2px 2px at 58% 6%, rgba(242,238,230,0.55), transparent)',
            'radial-gradient(1.5px 1.5px at 84% 14%, rgba(228,207,162,0.6), transparent)',
            'radial-gradient(2px 2px at 71% 28%, rgba(255,248,235,0.45), transparent)',
            'radial-gradient(1.5px 1.5px at 41% 16%, rgba(208,195,164,0.5), transparent)',
            'radial-gradient(ellipse 28% 12% at 78% 8%, rgba(90,70,40,0.18), transparent)',
            'radial-gradient(ellipse 18% 10% at 18% 20%, rgba(40,50,80,0.12), transparent)',
          ].join(','),
          backgroundSize: '100% 100%',
        }}
      />
    </div>
  );
}

/**
 * Distant, non-interactive solar-system discs in the dark sky (right / upper).
 * Pure CSS — no textures, no pointer capture, never a second hero widget.
 */
function DistantPlanets() {
  return (
    <div
      className="hero-earth-planets pointer-events-none absolute inset-0"
      aria-hidden="true"
      data-hero-scenery="planets"
    >
      {/* Mars — small rust disc, far upper-right */}
      <div
        className="hero-planet hero-planet-mars absolute"
        data-planet="mars"
        style={{
          top: '7%',
          right: '11%',
          width: 'clamp(14px, 1.7vw, 22px)',
          height: 'clamp(14px, 1.7vw, 22px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 32% 30%, #e08a62 0%, #c45a3a 38%, #7a2e1c 78%, #3a1410 100%)',
          boxShadow: '0 0 12px 2px rgba(180, 70, 40, 0.4)',
          opacity: 0.88,
        }}
      />

      {/* Jupiter — banded, larger than Mars, mid-upper right */}
      <div
        className="hero-planet hero-planet-jupiter absolute"
        data-planet="jupiter"
        style={{
          top: '4%',
          right: '26%',
          width: 'clamp(34px, 4.2vw, 56px)',
          height: 'clamp(34px, 4.2vw, 56px)',
          borderRadius: '50%',
          background: [
            'radial-gradient(circle at 34% 28%, rgba(255,240,210,0.4) 0%, transparent 42%)',
            'repeating-linear-gradient(180deg, #e8d2b0 0 14%, #c4a078 14% 22%, #d8bc94 22% 34%, #a87848 34% 42%, #d0b490 42% 56%, #b89060 56% 68%, #e0c8a0 68% 82%, #9a7048 82% 100%)',
          ].join(', '),
          boxShadow: '0 0 18px 4px rgba(180, 140, 80, 0.35)',
          opacity: 0.86,
        }}
      />

      {/* Saturn — cream body + tilted rings */}
      <div
        className="hero-planet hero-planet-saturn absolute"
        data-planet="saturn"
        style={{
          top: '14%',
          right: '4%',
          width: 'clamp(26px, 3.2vw, 42px)',
          height: 'clamp(26px, 3.2vw, 42px)',
          opacity: 0.84,
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 36% 30%, #f2e6c8 0%, #e0cba0 40%, #b89860 78%, #6a5430 100%)',
            boxShadow: '0 0 12px 2px rgba(200, 170, 100, 0.28)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: '210%',
            height: '42%',
            marginLeft: '-105%',
            marginTop: '-21%',
            borderRadius: '50%',
            border: '1.5px solid rgba(216, 196, 154, 0.55)',
            boxShadow:
              'inset 0 0 0 3px rgba(180, 150, 90, 0.22), 0 0 0 1px rgba(232, 220, 180, 0.18)',
            transform: 'rotate(-22deg)',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(216,196,154,0.12) 22%, transparent 38%, transparent 62%, rgba(216,196,154,0.1) 78%, transparent 100%)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Occasional Moon — slow drift / fade cycle. Reduced-motion: faint parked disc
 * in the far sky (not on the headline), no animation.
 */
function OccasionalMoon({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div
        className="hero-earth-moon hero-earth-moon-static pointer-events-none absolute"
        aria-hidden="true"
        data-hero-scenery="moon"
        style={{
          top: '9%',
          right: '38%',
          width: 'clamp(14px, 1.8vw, 22px)',
          height: 'clamp(14px, 1.8vw, 22px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 28%, #f0ebe0 0%, #c8c0b0 45%, #7a7468 100%)',
          boxShadow: '0 0 14px 3px rgba(220, 210, 190, 0.2)',
          opacity: 0.28,
        }}
      />
    );
  }

  return (
    <div
      className="hero-earth-moon hero-earth-moon-drift pointer-events-none absolute"
      aria-hidden="true"
      data-hero-scenery="moon"
    >
      <div
        className="hero-earth-moon-disc absolute"
        style={{
          width: 'clamp(16px, 2vw, 26px)',
          height: 'clamp(16px, 2vw, 26px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 28%, #f5f0e6 0%, #d0c8b8 42%, #8a8478 100%)',
          boxShadow: '0 0 18px 4px rgba(230, 220, 200, 0.25)',
        }}
      />
    </div>
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
      data-hero-scenery="starfield-planets"
      data-landing-earth={use3d ? 'scenery' : 'static'}
      aria-hidden="true"
    >
      {/* Deep space base — visible where Earth plane is masked open */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 28% 48%, #080a10 0%, #05070c 42%, #02040a 72%, #010308 100%)',
        }}
      />
      <WarmRimLight />

      {/* Photoreal Europe night — always under WebGL so planet never blanks.
          Upper sky is CSS-masked open so starfield/planets are not buried. */}
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

      {/* Night-space scenery ABOVE Earth layers, masked to upper/side sky only —
          never covers Dominik H1 column (left veil stays on top). */}
      <div
        className="hero-earth-space-scenery pointer-events-none absolute inset-0"
        data-hero-scenery-layer="sky"
      >
        <Starfield />
        <DistantPlanets />
        <OccasionalMoon reducedMotion={reducedMotion} />
      </div>

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
