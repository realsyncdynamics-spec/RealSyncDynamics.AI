import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { MotionState } from './Governance3DScene';
import './Governance3DHero.css';

// This page chunk contains no WebGL or animation engine at first paint.
const Governance3DScene = lazy(() => import('./Governance3DScene'));

export interface Governance3DHeroProps {
  auditHref?: string;
  platformHref?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}


function shouldUseStaticMobile() {
  if (typeof window === 'undefined') return false;
  try {
    // Intentional progressive enhancement: mobile data and GPU budgets are smaller.
    return !!window.matchMedia?.('(max-width: 760px), (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function StillCube() {
  return (
    <div className="rs-governance-hero__fallback" aria-hidden="true">
      <div className="rs-governance-hero__fallback-cube" />
    </div>
  );
}


export default function Governance3DHero({
  auditHref = '/audit',
  platformHref = '/governance-runtime',
}: Governance3DHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const motion = useRef<MotionState>({ progress: 0, pointerX: 0, pointerY: 0 });
  const reduced = useReducedMotion();
  const [staticMobile] = useState(shouldUseStaticMobile);
  const [mobile3DEnabled, setMobile3DEnabled] = useState(false);
  const canRun3D = !reduced && (!staticMobile || mobile3DEnabled);

  // Mobile opts into GPU rendering. Desktop progressively loads after first paint.
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    if (!canRun3D) {
      setSceneReady(false);
      return;
    }
    if (mobile3DEnabled) {
      setSceneReady(true);
      return;
    }
    const timeout = window.setTimeout(() => setSceneReady(true), 650);
    return () => window.clearTimeout(timeout);
  }, [canRun3D, mobile3DEnabled]);

  // Dynamically load GSAP only when animation is permitted, after the hero can paint.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !canRun3D || !sceneReady) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([{ default: gsap }, { ScrollTrigger }]) => {
        if (cancelled || !section.isConnected) return;
        gsap.registerPlugin(ScrollTrigger);
        const context = gsap.context(() => {
          ScrollTrigger.create({
            trigger: section, start: 'top top', end: 'bottom bottom',
            onUpdate: (self) => { motion.current.progress = self.progress; },
            onRefresh: (self) => { motion.current.progress = self.progress; },
          });
          if (titleRef.current) {
            gsap.to(titleRef.current, {
              opacity: 0.40, y: -20, ease: 'none',
              scrollTrigger: { trigger: section, start: '35% top', end: '75% top', scrub: 0.7 },
            });
          }
        }, section);
        cleanup = () => { context.revert(); motion.current.progress = 0; };
      })
      .catch(() => {
        // The content and CTA remain usable when the animation library fails.
      });
    return () => { cancelled = true; cleanup?.(); };
  }, [canRun3D, sceneReady]);

  const handleMove = (event: PointerEvent<HTMLElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    motion.current.pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    motion.current.pointerY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
  };

  return (
    <section ref={sectionRef} className="rs-governance-hero"
      aria-labelledby="rs-governance-hero-title" onPointerMove={handleMove}
      onPointerLeave={() => { motion.current.pointerX = 0; motion.current.pointerY = 0; }}>
      <div className="rs-governance-hero__sticky" data-mobile-static={staticMobile && !mobile3DEnabled ? 'true' : 'false'}>
        <div className="rs-governance-hero__glow" aria-hidden="true" />
        <div className="rs-governance-hero__scene" aria-hidden="true"
          data-scene-requested={sceneReady && canRun3D ? 'true' : 'false'}>
          {sceneReady && canRun3D ? (
            <Suspense fallback={<StillCube />}>
              <Governance3DScene motion={motion} reduced={reduced} />
            </Suspense>
          ) : <StillCube />}
        </div>
        <div className="rs-governance-hero__copy" ref={titleRef}>
          <p className="rs-governance-hero__eyebrow">REALSYNC DYNAMICS &amp; AI · GOVERNANCE OS</p>
          <h1 id="rs-governance-hero-title">Govern AI.<span>Prove Everything.</span></h1>
          <p className="rs-governance-hero__lead">
            Das Governance Operating System für kontrollierbare KI, nachvollziehbare
            Entscheidungen und dokumentierte Compliance.
          </p>
          <div className="rs-governance-hero__actions">
            <a className="rs-governance-hero__btn rs-governance-hero__btn--primary" href={auditHref}>
              Governance Audit starten <span aria-hidden="true">↗</span>
            </a>
            <a className="rs-governance-hero__btn rs-governance-hero__btn--outline" href={platformHref}>
              Plattform entdecken <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="rs-governance-hero__domains" aria-label="Visualisierte Governance-Bereiche">
            AUDIT <span>·</span> EVIDENCE <span>·</span> POLICY <span>·</span> RISK <span>·</span> MONITORING
          </p>
        </div>
        {staticMobile && !reduced && !mobile3DEnabled ? (
          <div className="rs-governance-hero__activate">
            <span>3D ist auf Mobilgeräten optional – für schnelle Ladezeiten.</span>
            <button
              type="button"
              onClick={() => setMobile3DEnabled(true)}
              aria-label="Interaktive Governance-3D-Ansicht aktivieren"
            >
              3D-Ansicht aktivieren <span aria-hidden="true">↗</span>
            </button>
          </div>
        ) : null}
        <span className="rs-governance-hero__scroll" aria-hidden="true">SCROLL TO EXPLORE ↓</span>
      </div>
    </section>
  );
}
