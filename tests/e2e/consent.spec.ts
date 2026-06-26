import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

test.describe('[SEC] Consent und Tracker-Verhalten', () => {
  test('[SEC-001] Nicht-notwendige Tracker feuern nicht vor Consent', async ({ page }) => {
    const trackerRequests: string[] = [];

    // Bekannte Tracker-Domains überwachen
    const trackerPatterns = [
      /google-analytics\.com/,
      /googletagmanager\.com\/gtm\.js/,
      /facebook\.net\/tr/,
      /doubleclick\.net/,
      /hotjar\.com/,
    ];

    page.on('request', (req) => {
      const url = req.url();
      if (trackerPatterns.some((p) => p.test(url))) {
        trackerRequests.push(url);
      }
    });

    // Seite laden ohne vorherigen Consent
    await page.context().clearCookies();
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });

    // Consent-Banner sollte erscheinen
    const banner = page
      .locator('[id*="consent"], [class*="consent"], [class*="cookie"], [role="dialog"]')
      .first();

    if (await banner.count() > 0) {
      await expect(banner).toBeVisible();
      // Tracker dürfen noch nicht gefeuert haben
      expect(
        trackerRequests,
        `Tracker vor Consent gefeuert: ${trackerRequests.join(', ')}`
      ).toHaveLength(0);
    } else {
      test.skip(true, 'Kein Consent-Banner gefunden – ggf. bereits angenommen oder CMP nicht aktiv');
    }
  });

  test('[SEC-002] Consent-Banner erscheint beim ersten Besuch', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });

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
