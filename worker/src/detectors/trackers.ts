/**
 * Tracker-Detection-Layer.
 *
 * Status: Scaffold mit URL-Pattern-Matching. Erweiterung in Phase 8.2:
 * Cookie-Dump-Analyse, Fingerprint-Match, EasyList-DB-Integration.
 */
import type { Page } from 'playwright';

const TRACKER_PATTERNS: Record<string, RegExp[]> = {
  google_analytics: [
    /www\.googletagmanager\.com\/gtag\/js/,
    /www\.google-analytics\.com\/g\/collect/,
    /www\.google-analytics\.com\/analytics\.js/,
    /\.google-analytics\.com/,
  ],
  meta_pixel: [
    /connect\.facebook\.net\/.+\/fbevents\.js/,
    /www\.facebook\.com\/tr/,
  ],
  tiktok_pixel: [
    /analytics\.tiktok\.com/,
  ],
  linkedin_insight: [
    /snap\.licdn\.com\/li\.lms-analytics/,
    /px\.ads\.linkedin\.com/,
  ],
  hotjar: [
    /static\.hotjar\.com/,
    /script\.hotjar\.com/,
  ],
  google_fonts_dynamic: [
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
  ],
  google_tag_manager: [
    /www\.googletagmanager\.com\/gtm\.js/,
  ],
};

export async function detectTrackers(
  page: Page,
  networkLog: { url: string }[],
): Promise<Record<string, unknown>> {
  const detected: Record<string, boolean> = {};
  const allUrls = networkLog.map((n) => n.url);

  for (const [name, patterns] of Object.entries(TRACKER_PATTERNS)) {
    detected[name] = patterns.some((p) => allUrls.some((u) => p.test(u)));
  }

  // Auch Script-Tags im DOM prüfen (für statisch eingebettete Tracker)
  const scripts = await page.$$eval('script[src]', (els) =>
    (els as HTMLScriptElement[]).map((e) => e.src),
  );
  for (const [name, patterns] of Object.entries(TRACKER_PATTERNS)) {
    if (!detected[name]) {
      detected[name] = patterns.some((p) => scripts.some((s) => p.test(s)));
    }
  }

  return {
    tracker: {
      google_analytics: { detected: detected.google_analytics },
      meta_pixel: { detected: detected.meta_pixel },
      tiktok_pixel: { detected: detected.tiktok_pixel },
      linkedin_insight: { detected: detected.linkedin_insight },
      hotjar: { detected: detected.hotjar },
      google_tag_manager: { detected: detected.google_tag_manager },
      any_external: Object.values(detected).some((v) => v === true),
    },
    asset: {
      google_fonts: { dynamic: detected.google_fonts_dynamic },
    },
  };
}
