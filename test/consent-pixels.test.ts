/**
 * Consent-Gating der Marketing-Pixel (src/lib/pixels.ts).
 *
 * Prüft die DSGVO-relevanten Invarianten:
 *   1. Ohne Consent wird kein Drittanbieter-Script geladen (TDDDG §25).
 *   2. „Nur Statistik" darf KEINE Marketing-Signale auf `granted` setzen
 *      (Google Consent Mode v2: ad_storage / ad_user_data / ad_personalization).
 *   3. Widerruf setzt die Consent-Mode-Signale zurück auf `denied`.
 *
 * Die Pixel-IDs werden über Vite-Env-Vars gesteuert; hier via `vi.stubEnv`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'realsync.cookie-consent.v1';

/** Frisch importieren, damit das Modul-interne `pixelsLoaded` je Test zurückgesetzt ist. */
async function importFreshPixels() {
  vi.resetModules();
  return import('../src/lib/pixels');
}

/** Sammelt alle per <script src> injizierten Drittanbieter-Hosts. */
function injectedScriptHosts(): string[] {
  return Array.from(document.querySelectorAll('script[src]'))
    .map((s) => {
      try {
        return new URL((s as HTMLScriptElement).src).host;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

/** Alle `gtag('consent', mode, {...})`-Aufrufe aus dem dataLayer extrahieren. */
function consentCalls(): Array<{ mode: string; params: Record<string, string> }> {
  const layer = (window.dataLayer ?? []) as unknown[];
  const out: Array<{ mode: string; params: Record<string, string> }> = [];
  for (const entry of layer) {
    const args = Array.from(entry as ArrayLike<unknown>);
    if (args[0] === 'consent' && typeof args[1] === 'string') {
      out.push({ mode: args[1], params: (args[2] ?? {}) as Record<string, string> });
    }
  }
  return out;
}

function setConsent(analytics: boolean, marketing: boolean) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      decided_at: new Date().toISOString(),
      necessary: true,
      analytics,
      marketing,
    }),
  );
}

describe('pixels — Consent-Gating', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    delete (window as { gtag?: unknown }).gtag;
    delete (window as { dataLayer?: unknown }).dataLayer;
    delete (window as { fbq?: unknown }).fbq;
    delete (window as { _fbq?: unknown })._fbq;
    delete (window as { ttq?: unknown }).ttq;
    delete (window as { lintrk?: unknown }).lintrk;
    // Alle Pixel-Plattformen konfiguriert — so fällt kein Test nur mangels ID durch.
    vi.stubEnv('VITE_GA4_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('VITE_GOOGLE_ADS_ID', 'AW-TEST456');
    vi.stubEnv('VITE_META_PIXEL_ID', '1234567890');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('lädt ohne Consent-Eintrag keinerlei Drittanbieter-Script', async () => {
    const { applyConsent } = await importFreshPixels();
    applyConsent();

    expect(injectedScriptHosts()).toEqual([]);
    expect(window.fbq).toBeUndefined();
  });

  it('lädt bei „nur notwendig" keinerlei Drittanbieter-Script', async () => {
    setConsent(false, false);
    const { applyConsent } = await importFreshPixels();
    applyConsent();

    expect(injectedScriptHosts()).toEqual([]);
    expect(window.fbq).toBeUndefined();
  });

  it('lädt bei Marketing-Ablehnung kein Meta-Pixel', async () => {
    setConsent(true, false);
    const { applyConsent } = await importFreshPixels();
    applyConsent();

    expect(injectedScriptHosts()).not.toContain('connect.facebook.net');
    expect(window.fbq).toBeUndefined();
  });

  it('setzt bei „nur Statistik" KEIN Marketing-Signal auf granted', async () => {
    setConsent(true, false);
    const { applyConsent } = await importFreshPixels();
    applyConsent();

    // Der wirksame Zustand ist der jeweils letzte Wert pro Signal.
    const effective: Record<string, string> = {};
    for (const call of consentCalls()) Object.assign(effective, call.params);

    expect(effective.analytics_storage).toBe('granted');
    expect(effective.ad_storage).toBe('denied');
    expect(effective.ad_user_data).toBe('denied');
    expect(effective.ad_personalization).toBe('denied');
  });

  it('setzt bei vollem Consent alle Signale auf granted', async () => {
    setConsent(true, true);
    const { applyConsent } = await importFreshPixels();
    applyConsent();

    const effective: Record<string, string> = {};
    for (const call of consentCalls()) Object.assign(effective, call.params);

    expect(effective.analytics_storage).toBe('granted');
    expect(effective.ad_storage).toBe('granted');
  });

  it('setzt die Signale bei Widerruf zurück auf denied und erzwingt einen Reload', async () => {
    // jsdom implementiert keine Navigation — reload wird ersetzt und beobachtet.
    const reload = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload },
    });

    try {
      setConsent(true, true);
      const { applyConsent } = await importFreshPixels();
      applyConsent();
      expect(reload).not.toHaveBeenCalled();

      // Widerruf: User reduziert auf „nur notwendig".
      setConsent(false, false);
      applyConsent();

      const calls = consentCalls();
      const last = calls[calls.length - 1];
      expect(last.params.analytics_storage).toBe('denied');
      expect(last.params.ad_storage).toBe('denied');
      expect(last.params.ad_user_data).toBe('denied');
      expect(last.params.ad_personalization).toBe('denied');

      // Meta/TikTok/LinkedIn kennen kein Consent Mode — nur ein Reload
      // beendet die bereits injizierten Scripts zuverlässig.
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      });
    }
  });

  it('löst bei der ersten Entscheidung keinen Reload aus', async () => {
    const reload = vi.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload },
    });

    try {
      // Neuer Besucher entscheidet sich direkt für „nur notwendig".
      setConsent(false, false);
      const { applyConsent } = await importFreshPixels();
      applyConsent();

      expect(reload).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
      });
    }
  });
});
