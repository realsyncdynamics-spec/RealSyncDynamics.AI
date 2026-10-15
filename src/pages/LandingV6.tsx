import { useEffect } from 'react';
import { preload } from 'react-dom';
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
/**
 * Schrift der oberen Leiste vorab laden — zusammen mit `font-display: optional`
 * ('JetBrains Mono Optional' in landing-v6.css). Ohne beides kam die Schrift erst
 * nach dem ersten Bild, die Leiste sprang von zwei Zeilen auf eine und zog die
 * Seite 27 px hoch (Lighthouse CLS 0,41). React hebt den Link in den <head>,
 * der Prerender übernimmt ihn in die HTML von `/`.
 */
const STRIP_FONT_URL = '/fonts/jetbrains-mono-latin.woff2';

export function LandingV6() {
  preload(STRIP_FONT_URL, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
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
