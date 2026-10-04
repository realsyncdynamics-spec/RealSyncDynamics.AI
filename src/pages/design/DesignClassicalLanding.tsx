/**
 * Landing v4 „Klassisch" — Claude-Design-Handoff `design_handoff_governance_ai_v4`
 * (Referenz `The Governance AI v4.html`, gebündelt `dist/realsync-landing-v4.html`).
 *
 * Dunkler Hero mit 3D-Erde (Sonne, Mond, Mars, ISS), darunter Classical-
 * Sektionen (Papier #f3f2f2, Tinte #201f1d, Gold #b68235; Cormorant Garamond ·
 * Lora · JetBrains Mono). Design-Route neben `/` — die Startseite (Landing v2)
 * bleibt unverändert, bis der Wechsel ausdrücklich freigegeben ist.
 *
 * Verhalten wie in der Referenz: Scroll-Fortschritt, Hero-Parallax,
 * Einblenden (IntersectionObserver 0,08), Karten-Spotlight und -Tilt,
 * Seal-/Ledger-Takt, Ticker, Roadmap-Filter, Scroll-Kamerafahrt der Szene.
 */
import { useEffect, useRef } from 'react';
import { SEOHead } from '../../components/SEOHead';
import {
  V4Backdrop,
  V4Closing,
  V4Enterprise,
  V4Evidence,
  V4Footer,
  V4Header,
  V4Hero,
  V4LoopBand,
  V4Platform,
  V4Pricing,
  V4Roadmap,
  V4StatusBar,
  V4Ticker,
  V4Tools,
  V4Workspace,
} from '../../components/landing/v4/LandingV4Sections';
import '../../styles/landing-v4-classical.css';

const REVEAL_SELECTOR = '.card, .rm-card, .ent > div, .loop-node, .sec-lede';
const SPOTLIGHT_SELECTOR = '.card, .rm-card, .ent > div';
const TILT_SELECTOR = '.card, .ent > div';

export function DesignClassicalLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // <html>: 17px-Basis, Smooth-Scroll, scroll-padding (Referenz-`html`-Regeln).
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('gv4-root');
    return () => html.classList.remove('gv4-root');
  }, []);

  // 3D-Szene erst nach dem ersten Paint laden (three.js im eigenen Chunk).
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    let unmount: (() => void) | undefined;
    let cancelled = false;
    import('../../components/landing/v4/heroEarthScene').then(({ mountHeroEarth }) => {
      if (cancelled) return;
      unmount = mountHeroEarth({ canvas, cssTarget: root, visibilityTarget: root.querySelector('main') });
    });
    return () => {
      cancelled = true;
      unmount?.();
    };
  }, []);

  // Scroll: Fortschrittsbalken + Hero-Parallax (H1/Lede: -y·(0,08 + i·0,04), Deckkraft ≥ 0,15).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const parallax = Array.from(root.querySelectorAll<HTMLElement>('h1, .lede'));
    const onScroll = () => {
      const m = document.documentElement.scrollHeight - innerHeight;
      if (progressRef.current) progressRef.current.style.transform = 'scaleX(' + (m > 0 ? scrollY / m : 0) + ')';
      const y = Math.min(scrollY, innerHeight);
      parallax.forEach((el, i) => {
        el.style.transform = `translate3d(0, ${(-y * (0.08 + i * 0.04)).toFixed(1)}px, 0)`;
        el.style.opacity = String(Math.max(0.15, 1 - y / (innerHeight * 1.1)));
      });
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);

  // Einblenden beim Scrollen (Schwelle 0,08) — ohne IntersectionObserver bleibt alles sichtbar.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('v3-in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
      el.classList.add('v3-rv');
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // Spotlight folgt dem Zeiger über Karten (--mx/--my).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.<HTMLElement>(SPOTLIGHT_SELECTOR);
      if (!t || !rootRef.current?.contains(t)) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      t.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    };
    addEventListener('pointermove', onMove, { passive: true });
    return () => removeEventListener('pointermove', onMove);
  }, []);

  // Karten-Tilt — nur Hover-Geräte, nicht bei Reduced Motion.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
    const offs: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>(TILT_SELECTOR).forEach((el) => {
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateZ(8px)`;
      };
      const leave = () => {
        el.style.transform = '';
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      offs.push(() => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
    });
    return () => offs.forEach((off) => off());
  }, []);

  return (
    <div id="top" className="gv4" data-theme="day" ref={rootRef}>
      <SEOHead />
      <V4Backdrop canvasRef={canvasRef} />
      <div id="page">
        <V4StatusBar />
        <V4Header />
        <V4Hero />
        <V4Ticker />
        <V4LoopBand />
        <V4Workspace />
        <V4Tools />
        <V4Platform />
        <V4Evidence />
        <V4Pricing />
        <V4Roadmap />
        <V4Enterprise />
        <V4Closing />
        <V4Footer />
      </div>
      <div id="v3-progress" ref={progressRef} />
    </div>
  );
}
