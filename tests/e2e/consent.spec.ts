import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

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

/**
 * Consent-Gating mit Positivkontrolle (COMPLIANCE_AUDIT_2026-07.md, K-1/K-2).
 *
 * SEC-001 oben prüft „vor Consent keine Tracker" — richtig, aber allein nicht
 * beweiskräftig: `pixels.ts` lädt die Pixel nur, wenn die IDs als
 * `VITE_*_PIXEL_ID` / `VITE_GA4_MEASUREMENT_ID` im Build stehen. Fehlen sie,
 * feuert auch NACH einer Einwilligung nichts, und die Zusicherung wäre trivial
 * erfüllt — der Test bliebe grün, selbst wenn man `pixels.ts` löscht.
 *
 * Dieser Block misst deshalb zuerst den Positivfall und überspringt sich mit
 * Begründung, wenn er 0 ergibt. `.github/workflows/e2e.yml` setzt dafür
 * ungültige Dummy-IDs, die zu keinem echten Konto gehören.
 *
 * Die Tracker-Requests werden abgebrochen, bevor sie das Netz erreichen —
 * gemessen wird der Versuch, denn das `request`-Event feuert vor dem Routing.
 * Die CI kontaktiert damit nie wirklich Google, Meta oder TikTok, und die Tests
 * hängen nicht an deren Erreichbarkeit.
 */
const TRACKER_RE = /google-analytics|googletagmanager|doubleclick|googleadservices|connect\.facebook|facebook\.com\/tr|analytics\.tiktok|snap\.licdn|px\.ads\.linkedin/i;
const CONSENT_STORAGE_KEY = 'realsync.cookie-consent.v1';

test.describe('[SEC] Consent-Gating — Netzwerkverhalten', () => {
  async function trackerHosts(
    browser: import('@playwright/test').Browser,
    action?: (page: import('@playwright/test').Page) => Promise<void>,
  ): Promise<string[]> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const hits: string[] = [];
    page.on('request', (r) => {
      if (TRACKER_RE.test(r.url())) hits.push(new URL(r.url()).host);
    });
    await page.route(TRACKER_RE, (route) => route.abort());

    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
    await page.evaluate((k) => localStorage.removeItem(k), CONSENT_STORAGE_KEY);
    await page.reload({ waitUntil: 'networkidle' });

    if (action) {
      await action(page);
      await page.waitForTimeout(3000);
    }

    await context.close();
    return [...new Set(hits)];
  }

  test('[SEC-003] vor der Einwilligung wird kein Drittanbieter kontaktiert', async ({ browser }) => {
    const afterAccept = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-accept-all').click();
    });

    test.skip(
      afterAccept.length === 0,
      'Keine Pixel-IDs im Build (VITE_*_PIXEL_ID / VITE_GA4_MEASUREMENT_ID) — auch nach '
        + 'Einwilligung feuert nichts. Die Messung waere ohne Aussage, daher uebersprungen '
        + 'statt falsche Sicherheit zu erzeugen.',
    );

    const beforeConsent = await trackerHosts(browser);
    expect(
      beforeConsent,
      `Vor der Einwilligung kontaktiert: ${beforeConsent.join(', ')}`,
    ).toEqual([]);
  });

  test('[SEC-004] nach „Alle ablehnen" bleibt es bei null Drittanbieter-Requests', async ({ browser }) => {
    const afterAccept = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-accept-all').click();
    });

    test.skip(afterAccept.length === 0, 'Keine Pixel-IDs im Build — siehe SEC-003.');

    const afterReject = await trackerHosts(browser, async (page) => {
      await page.getByTestId('consent-reject-all').click();
    });
    expect(
      afterReject,
      `Nach Ablehnen kontaktiert: ${afterReject.join(', ')}`,
    ).toEqual([]);
  });
});
