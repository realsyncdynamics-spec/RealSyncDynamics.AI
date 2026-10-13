import { useEffect } from 'react';
import { SEOHead } from '../components/SEOHead';
import { LandingV6View } from '../components/landing/v6/LandingV6View';
import { useLandingV6 } from '../components/landing/v6/useLandingV6';
import '../styles/landing-v6.css';

/**
 * Landing v6 — Startseite `/` (Owner-Freigabe 13.10.2026).
 *
 * Design: Claude-Design-Handoff „The Governance OS für DSGVO und EU AI Act".
 * Inhalte an Pricing-SSoT, Beta-Schalter und Implementierungsstatus angepasst
 * (siehe Kommentar in `useLandingV6`).
 *
 * Nichts überschrieben: v5 bleibt unter /design/landing-v5, v4 unter
 * /design/landing-v4, v2 unter /design/landing-v2.
 */
export function LandingV6() {
  const v = useLandingV6();

  // Fokus in den Dialog setzen, sobald die KI-Act-Einordnung öffnet.
  useEffect(() => {
    if (!v.modalOpen) return;
    const el = document.querySelector<HTMLElement>('.lv6 [role="dialog"] button');
    el?.focus();
  }, [v.modalOpen]);

  return (
    <>
      <SEOHead />
      <LandingV6View v={v} />
    </>
  );
}
