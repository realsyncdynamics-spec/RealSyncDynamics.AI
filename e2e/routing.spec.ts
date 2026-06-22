import { test, expect } from '@playwright/test';

/**
 * Routing-Smoke-E2E (QA-Audit 2026-06-22).
 *
 * Prüft die wichtigsten öffentlichen Routen auf:
 *   - HTTP-200 / SPA-Render (kein leerer Body, keine harte 404)
 *   - keinen NotFound-Fallback auf gültigen Pfaden
 *   - korrekten 404-Fallback auf Unsinns-Pfaden
 *   - SPA-Deep-Link (direkter Aufruf + Reload) ohne Server-404
 *
 * Läuft gegen E2E_BASE_URL (Default http://localhost:3000). Benötigt einen
 * laufenden `npm run dev` oder `npm run preview`-Server.
 */

const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/audit',
  '/tools',
  '/about',
  '/ai-act',
  '/evidence',
  '/monitoring',
  '/agents',
  '/legal/privacy',
  '/impressum',
  '/legal/terms',
  '/legal/avv',
  '/contact-sales',
  '/partners',
  '/integrations/shopify',
  '/checkout/starter',
  '/checkout/success',
  '/checkout/cancelled',
];

test.describe('Öffentliche Routen rendern (kein 404-Fallback)', () => {
  for (const path of PUBLIC_ROUTES) {
    test(`GET ${path} rendert Inhalt`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Static-Host liefert für SPA-Deep-Links 200 (index.html); App rendert clientseitig.
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      const body = await page.locator('body').innerText();
      expect(body.trim().length, `${path} hat Inhalt`).toBeGreaterThan(0);
      // Kein NotFound-Marker auf gültigen Routen.
      expect(body).not.toMatch(/404 — Seite nicht gefunden|Page not found/i);
    });
  }
});

test.describe('404-Verhalten', () => {
  test('Unbekannte Route zeigt NotFound-Seite', async ({ page }) => {
    await page.goto('/dieser-pfad-existiert-definitiv-nicht-xyz', {
      waitUntil: 'domcontentloaded',
    });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/404|nicht gefunden|not found/i);
  });
});

test.describe('SPA-Deep-Link + Reload', () => {
  test('Direkter App-Deep-Link + Reload führt nicht zu Server-404', async ({ page }) => {
    const res = await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBeLessThan(400);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Cannot GET|nginx|Not Found — server/i);
  });
});

test.describe('Pricing → Checkout-Navigation', () => {
  test('Pricing zeigt Self-Serve-Upgrade-CTA, die auf /checkout zeigt', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    const checkoutLink = page.locator('a[href*="/checkout/"]').first();
    await expect(checkoutLink).toBeVisible();
    const href = await checkoutLink.getAttribute('href');
    expect(href).toMatch(/\/checkout\/(starter|growth|agency)/);
  });
});
