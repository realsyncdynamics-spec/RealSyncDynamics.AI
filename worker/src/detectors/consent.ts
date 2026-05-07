/**
 * Consent-Banner-Detection.
 *
 * Status: Scaffold mit DOM-Heuristik. Phase 8.2: bekannte CMPs (Cookiebot,
 * Usercentrics, OneTrust) per Fingerprint identifizieren, Reject-Button-
 * Prominenz messen (Größe, Farbe, Position).
 */
import type { Page } from 'playwright';

const CONSENT_KEYWORDS = [
  'cookie',
  'einwilligung',
  'consent',
  'datenschutz',
  'akzeptieren',
  'ablehnen',
];

export async function detectConsent(page: Page): Promise<Record<string, unknown>> {
  // Heuristik: Element mit role="dialog" oder fixed-positioned Overlay
  // mit Cookie-keywords im Text
  const bannerDetected = await page.evaluate((keywords) => {
    const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'));
    const fixedOverlays = Array.from(document.querySelectorAll<HTMLElement>('div, section, aside')).filter((el) => {
      const cs = window.getComputedStyle(el);
      return (cs.position === 'fixed' || cs.position === 'sticky') &&
             el.offsetHeight > 50 &&
             el.offsetWidth > 200;
    });
    const candidates = [...dialogs, ...fixedOverlays];
    return candidates.some((el) => {
      const text = (el.textContent || '').toLowerCase();
      return keywords.some((k: string) => text.includes(k));
    });
  }, CONSENT_KEYWORDS);

  // Reject-Button: prüfe ob ein Button mit "ablehnen"/"reject"/"nur notwendige"
  // existiert und visuell ähnliche Größe wie Accept-Button hat
  let rejectEqualProminence = false;
  if (bannerDetected) {
    rejectEqualProminence = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>('button, a, [role="button"]'));
      const acceptBtn = buttons.find((b) => /(akzeptieren|alle akzeptieren|accept all)/i.test(b.textContent || ''));
      const rejectBtn = buttons.find((b) => /(ablehnen|alle ablehnen|reject|nur notwendige)/i.test(b.textContent || ''));
      if (!acceptBtn || !rejectBtn) return false;
      const accRect = acceptBtn.getBoundingClientRect();
      const rejRect = rejectBtn.getBoundingClientRect();
      // gleiche Prominenz: Höhe ähnlich (±20%) und Breite ähnlich (±50%)
      const heightRatio = rejRect.height / Math.max(accRect.height, 1);
      const widthRatio = rejRect.width / Math.max(accRect.width, 1);
      return heightRatio >= 0.8 && heightRatio <= 1.2 && widthRatio >= 0.5;
    });
  }

  return {
    consent: {
      banner: {
        detected: bannerDetected,
        reject_button_equal_prominence: rejectEqualProminence,
      },
      detected_before_load: false, // Placeholder — Phase 8.2 Logik
      required: true, // Default für DACH-Sites mit Trackern
    },
  };
}
