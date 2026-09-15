/**
 * Public `/` hero visual — Europe + sunrise scenery (Dark / Gold / Cream).
 *
 * Right-column companion to Dominik left copy. Not an interactive whole-Earth
 * orbit toy, not Governance Sphere HUD, not DEMO KPIs / country score dots.
 * Uses `/europe-globe` photoreal crop + restrained CSS sunrise limb.
 */
import { useEffect, useState } from 'react';
import { LANDING_ACCENT, LANDING_BG, LANDING_MONO } from './landing-theme';

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

function Starfield() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.45]"
      aria-hidden="true"
      style={{
        backgroundImage: [
          'radial-gradient(1px 1px at 12% 18%, rgba(242,238,230,0.32), transparent)',
          'radial-gradient(1px 1px at 28% 8%, rgba(228,207,162,0.26), transparent)',
          'radial-gradient(1.5px 1.5px at 48% 14%, rgba(239,230,213,0.28), transparent)',
          'radial-gradient(1px 1px at 72% 22%, rgba(228,207,162,0.2), transparent)',
          'radial-gradient(1px 1px at 88% 12%, rgba(242,238,230,0.22), transparent)',
          'radial-gradient(1px 1px at 18% 62%, rgba(228,207,162,0.16), transparent)',
          'radial-gradient(1px 1px at 64% 78%, rgba(239,230,213,0.18), transparent)',
          'radial-gradient(1.5px 1.5px at 92% 68%, rgba(242,238,230,0.14), transparent)',
        ].join(','),
      }}
    />
  );
}

/**
 * Warm gold sunrise behind Europe — limb glow only.
 * Must not cream-wash the left headline column (contained to this panel).
 */
function SunriseLimb({ animate }: { animate: boolean }) {
  return (
    <div className="hero-sunrise pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Soft warm space fill — graphite, not cream void */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 70% 55% at 22% 58%, rgba(40,28,14,0.9) 0%, transparent 58%)`,
            `radial-gradient(ellipse 55% 45% at 78% 28%, rgba(14,12,10,0.75) 0%, transparent 52%)`,
            `radial-gradient(ellipse 90% 50% at 50% 100%, rgba(22,16,10,0.85) 0%, transparent 48%)`,
          ].join(', '),
        }}
      />
      {/* Rising sun disc — lower-left behind Europe limb */}
      <div
        className={animate ? 'hero-sunrise-core absolute' : 'absolute'}
        style={{
          left: '4%',
          top: '38%',
          width: 'min(52%, 280px)',
          height: 'min(52%, 280px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, #ffe8c4 0%, #f0d09a 14%, #e4cfa2 28%, rgba(196,150,80,0.55) 48%, rgba(120,80,40,0.2) 62%, transparent 74%)',
          boxShadow:
            '0 0 48px 16px rgba(228,207,162,0.35), 0 0 120px 40px rgba(180,120,55,0.22)',
          opacity: 0.88,
        }}
      />
      <div
        className="absolute"
        style={{
          left: '-6%',
          top: '28%',
          width: 'min(95%, 520px)',
          height: 'min(80%, 440px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(228,207,162,0.42) 0%, rgba(196,140,70,0.2) 36%, transparent 64%)',
          filter: 'blur(28px)',
        }}
      />
      <div
        className={animate ? 'hero-sunrise-shaft absolute inset-x-0 bottom-[8%] mx-auto h-[42%] max-w-[420px]' : 'absolute inset-x-0 bottom-[8%] mx-auto h-[42%] max-w-[420px]'}
        style={{
          background:
            'radial-gradient(ellipse 90% 100% at 40% 100%, rgba(232,221,200,0.28) 0%, rgba(228,207,162,0.12) 45%, transparent 72%)',
          filter: 'blur(8px)',
        }}
      />
    </div>
  );
}

function EuropeDisc() {
  return (
    <div
      className="hero-europe-disc relative mx-auto aspect-square w-full max-w-[min(100%,520px)]"
      aria-hidden="true"
    >
      {/* Gold atmosphere ring */}
      <div
        className="pointer-events-none absolute inset-[-2%] rounded-full"
        style={{
          background: `radial-gradient(circle, transparent 62%, rgba(228,207,162,0.22) 72%, rgba(228,207,162,0.08) 82%, transparent 92%)`,
          boxShadow: `0 0 60px rgba(228,207,162,0.12)`,
        }}
      />
      <div
        className="hero-europe-globe absolute inset-[4%] overflow-hidden rounded-full border"
        style={{
          borderColor: `${LANDING_ACCENT}38`,
          boxShadow: [
            'inset -28px -16px 48px rgba(5,7,11,0.72)',
            'inset 12px 10px 28px rgba(228,207,162,0.1)',
            '0 20px 70px rgba(0,0,0,0.45)',
          ].join(', '),
        }}
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
            className="hero-europe-globe-img h-full w-full scale-[1.35] object-cover object-[58%_42%]"
          />
        </picture>
        {/* Kill cyan arcs / purple nebula → gold-graphite grade */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              'radial-gradient(circle at 34% 36%, transparent 0%, transparent 48%, rgba(5,7,11,0.28) 78%, rgba(5,7,11,0.7) 100%)',
              'linear-gradient(125deg, rgba(228,207,162,0.14) 0%, transparent 38%, rgba(5,7,11,0.35) 100%)',
              'radial-gradient(ellipse 55% 45% at 22% 62%, rgba(228,207,162,0.22) 0%, transparent 60%)',
            ].join(', '),
            mixBlendMode: 'soft-light',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 70% 30%, rgba(5,7,11,0.15) 0%, transparent 40%), linear-gradient(180deg, transparent 55%, rgba(5,7,11,0.45) 100%)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Europe-only hero scenery for public `/`.
 */
export function HeroEuropeSunrise() {
  const reducedMotion = usePrefersReducedMotion();
  const animate = !reducedMotion;

  return (
    <div
      className="hero-europe-sunrise relative flex min-h-[480px] w-full flex-col justify-center lg:min-h-[560px]"
      data-hero-visual="europe-sunrise"
      data-earth-palette="landing-gold"
      data-hero-lighting="sunrise"
      data-landing-europe="static"
      role="img"
      aria-label="Europa bei Sonnenaufgang — Governance-Raum, ohne interaktive Erdkugel"
    >
      <div className="mb-3 ml-1 flex flex-col gap-[7px] sm:ml-5">
        <p
          className="text-[8px] tracking-[.16em]"
          style={{ fontFamily: LANDING_MONO, color: '#a8956f' }}
        >
          EUROPE · GOVERNANCE SPACE
        </p>
        <p
          className="text-[8px] tracking-[.16em] text-white/30"
          style={{ fontFamily: LANDING_MONO }}
        >
          DETECT · GOVERN · PROVE · AUTOMATE
        </p>
      </div>

      <div
        className="relative overflow-hidden border p-4 sm:p-5"
        style={{
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(7,11,17,0.38)',
          boxShadow: '0 20px 70px rgba(0,0,0,0.5)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 28% 55%, #12100c 0%, ${LANDING_BG} 55%, #030508 100%)`,
          }}
        />
        <Starfield />
        <SunriseLimb animate={animate} />
        <div className="relative z-[1] py-2 sm:py-4">
          <EuropeDisc />
        </div>
      </div>
    </div>
  );
}
