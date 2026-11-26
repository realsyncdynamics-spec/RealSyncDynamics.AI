import { test, expect } from '@playwright/test';

/**
 * Kritischer, read-only Kundenpfad. Keine echten E-Mails, Accounts, Zahlungen
 * oder Scans. Läuft lokal per Playwright gegen die gebaute SPA.
 *
 * Live-URL nur explizit mit TEST_BASE_URL konfigurieren.
 * Authentifizierte Dashboard-CRUD-Prüfung benötigt separate Testidentitäten.
 */
const PRODUCTS = [
  { path: '/ki-bots', marker: '[data-testid="ki-bots-heading"]' },
  { path: '/app-builder', marker: '[data-product="app-builder"] [data-testid="product-heading"]' },
  { path: '/governance-os', marker: '[data-product="governance-os"] [data-testid="product-heading"]' },
  { path: '/claude-code-optimizer', marker: 'h1' },
] as const;

test.describe('Produkt-Einstiege: direkte SPA-Routen', () => {
  test('Hero-Katalog enthält alle vier unabhängigen Produktlinks', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.lv3-catalog .lv3-cat');
    await expect(cards).toHaveCount(4);
    for (const { path } of PRODUCTS) {
      await expect(page.locator(`.lv3-catalog a.lv3-cat[href^="${path}"]`)).toHaveCount(1);
    }
  });

  for (const { path, marker } of PRODUCTS) {
    test(`Direktaufruf ${path} rendert eigene Produktseite`, async ({ page }) => {
      await page.goto(path);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.locator(marker).first()).toBeVisible();
      if (path === '/claude-code-optimizer') {
        await expect(page.getByRole('heading', { name: /Claude Code Optimizer/i }).first()).toBeVisible();
      }
    });
  }
});

test.describe('Responsive und anonymer Kundeneinstieg', () => {
  for (const width of [390, 768, 1440]) {
    test(`Startseite bleibt bei ${width}px ohne horizontales Überlaufen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByTestId('v3-hero-heading')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(2);
    });
  }

  test('Login-Seite zeigt E-Mail-Eingabe ohne Kundenkonto', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  for (const path of ['/app/dashboard', '/app/activation']) {
    test(`${path} verlangt anonym Anmeldung und erhält Zielroute`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/welcome\?next=/);
      const next = new URL(page.url()).searchParams.get('next');
      expect(next).toBe(path);
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
    });
  }
});
