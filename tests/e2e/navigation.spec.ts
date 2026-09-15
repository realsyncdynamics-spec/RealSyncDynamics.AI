import { test, expect } from '@playwright/test';

test.describe('[FE-002] Navigation und primäre CTAs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('Hauptnavigation ist vorhanden', async ({ page }) => {
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });

  test('Primärer CTA ist klickbar und führt auf erwartete Seite', async ({ page }) => {
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

  test('[FE-004] Footer-Rechtslinks (Impressum, Datenschutz) erreichbar', async ({ page }) => {
    const footer = page.locator('footer');

    const impressum = footer.getByRole('link', { name: /^Impressum$/i }).first();
    await expect(impressum).toBeVisible();
    await expect(impressum).toHaveAttribute('href', /\/impressum$/);

    const datenschutz = footer.getByRole('link', { name: /^Datenschutz$/i }).first();
    await expect(datenschutz).toBeVisible();
    await expect(datenschutz).toHaveAttribute('href', /\/datenschutz$/);
  });
});
