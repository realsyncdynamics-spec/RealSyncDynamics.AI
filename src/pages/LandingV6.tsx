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

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobiles Menü und KI-Act-Einordnung sind modale Dialoge: Fokus beim Öffnen
 * hinein, Tab bleibt im Dialog, beim Schließen zurück zum Auslöser.
 */
function useDialogFocus(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = () => document.querySelector<HTMLElement>('.lv6 [role="dialog"]');
    dialog()?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      const el = dialog();
      if (e.key !== 'Tab' || !el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = el.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // preventScroll: Ein Ankerlink im Menü soll nicht zurück nach oben springen.
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open]);
}

export function LandingV6() {
  preload(STRIP_FONT_URL, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  const v = useLandingV6();

  useDialogFocus(v.modalOpen || v.menuOpen);

  return (
    <>
      <SEOHead />
      <LandingV6View v={v} />
    </>
  );
}
