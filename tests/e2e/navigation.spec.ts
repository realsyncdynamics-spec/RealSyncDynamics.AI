import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

test.describe('[FE-002] Navigation und primäre CTAs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  });

  test('Hauptnavigation ist vorhanden', async ({ page }) => {
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });

  test('Primärer CTA ist klickbar und führt auf erwartete Seite', async ({ page }) => {
    // Sucht nach primären CTAs (Button oder Link mit typischen CTA-Texten)
    const cta = page
      .locator('a, button')
      .filter({ hasText: /jetzt|kostenlos|starten|demo|audit|testen/i })
      .first();

    if (await cta.count() === 0) {
      test.skip(true, 'Kein primärer CTA auf Startseite gefunden – ggf. Text-Muster anpassen');
      return;
    }

    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    if (href && href.startsWith('/')) {
      await cta.click();
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain(href.split('?')[0]);
    }
  });

  test('Deep Links sind direkt erreichbar', async ({ page }) => {
    const deepLinks = [
      '/audit',
      '/ai-act/',
      '/oeffentliche-verwaltung/',
      '/healthtech',
      '/saas-anbieter/',
      '/checkout/starter/',
    ];

    for (const link of deepLinks) {
      const resp = await page.goto(BASE_URL + link, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `Deep Link ${link}`).toBeLessThan(400);
    }
  });
});
