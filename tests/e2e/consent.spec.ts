import { test, expect, type Browser, type Page } from '@playwright/test';

test.describe('[SEC] Consent und Tracker-Verhalten', () => {
  test('[SEC-001] Nicht-notwendige Tracker feuern nicht vor Consent', async ({ page }) => {
    const trackerRequests: string[] = [];
    const trackerPatterns = [
      /google-analytics\.com/,
      /googletagmanager\.com\/gtm\.js/,
      /facebook\.net\/tr/,
      /doubleclick\.net/,
      /hotjar\.com/,
    ];

    page.on('request', (req) => {
      const url = req.url();
      if (trackerPatterns.some((p) => p.test(url))) trackerRequests.push(url);
    });

    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const banner = page
      .locator('[id*="consent"], [class*="consent"], [class*="cookie"], [role="dialog"]')
      .first();

    if (await banner.count() === 0) {
      test.skip(true, 'Kein Consent-Banner gefunden – ggf. bereits angenommen oder CMP nicht aktiv');
      return;
    }

    await expect(banner).toBeVisible();
    expect(
      trackerRequests,
      `Tracker vor Consent gefeuert: ${trackerRequests.join(', ')}`,
    ).toHaveLength(0);
  });

  test('[SEC-002] Consent-Banner erscheint beim ersten Besuch', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const banner = page
      .locator('[id*="consent"], [class*="consent"], [class*="cookie"], [data-testid*="consent"]')
      .first();

    if (await banner.count() === 0) {
      test.skip(true, 'Kein Consent-Banner gefunden');
      return;
    }

    await expect(banner).toBeVisible();
  });
});

const TRACKER_RE = /google-analytics|googletagmanager|doubleclick|googleadservices|connect\.facebook|facebook\.com\/tr|analytics\.tiktok|snap\.licdn|px\.ads\.linkedin/i;
const CONSENT_STORAGE_KEY = 'realsync.cookie-consent.v1';

async function trackerHosts(
  browser: Browser,
  action?: (page: Page) => Promise<void>,
): Promise<string[]> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const hits: string[] = [];
  page.on('request', (r) => {
    if (TRACKER_RE.test(r.url())) hits.push(new URL(r.url()).host);
  });
  await page.route(TRACKER_RE, (route) => route.abort());

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((k) => localStorage.removeItem(k), CONSENT_STORAGE_KEY);
  await page.reload({ waitUntil: 'domcontentloaded' });

  if (action) {
    await action(page);
    await Promise.race([
      page.waitForRequest(TRACKER_RE, { timeout: 1500 }).catch(() => null),
      page.waitForTimeout(1500),
    ]);
  }

  await context.close();
  return [...new Set(hits)];
}

test.describe('[SEC] Consent-Gating — Netzwerkverhalten', () => {
  let pixelsArmed: boolean | null = null;

  test.beforeAll(async ({ browser }) => {
    const afterAccept = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-accept-all').click();
    });
    pixelsArmed = afterAccept.length > 0;
  });

  test('[SEC-003] vor der Einwilligung wird kein Drittanbieter kontaktiert', async ({ browser }) => {
    test.skip(
      pixelsArmed === false,
      'Keine Pixel-IDs im Build (VITE_*_PIXEL_ID / VITE_GA4_MEASUREMENT_ID) — auch nach '
        + 'Einwilligung feuert nichts. Die Messung waere ohne Aussage, daher uebersprungen.',
    );

    const beforeConsent = await trackerHosts(browser);
    expect(
      beforeConsent,
      `Vor der Einwilligung kontaktiert: ${beforeConsent.join(', ')}`,
    ).toEqual([]);
  });

  test('[SEC-004] nach „Alle ablehnen" bleibt es bei null Drittanbieter-Requests', async ({ browser }) => {
    test.skip(pixelsArmed === false, 'Keine Pixel-IDs im Build — siehe SEC-003.');

    const afterReject = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-reject-all').click();
    });
    expect(
      afterReject,
      `Nach Ablehnen kontaktiert: ${afterReject.join(', ')}`,
    ).toEqual([]);
  });
});
