import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Production-Routing-Smoke (Playwright)
// ─────────────────────────────────────────────────────────────────────────────
// Verifiziert die LIVE-Produktionsumgebung gegen echte URLs. Läuft NICHT im
// Standard-e2e-/CI-Lauf (der gegen localhost testet), sondern nur, wenn
// PROD_SMOKE=1 gesetzt ist — sonst werden alle Tests übersprungen.
//
// Aufruf:
//   PROD_SMOKE=1 npx playwright test e2e/production-routing.spec.ts
//   PROD_SMOKE=1 PROD_BASE=https://realsyncdynamicsai.de npx playwright test e2e/production-routing.spec.ts
//
// Default-Base ist die Cloudflare-Pages-Domain (gesund). Auf die Custom-Domain
// kann mit PROD_BASE umgeschaltet werden, sobald das Domain-Routing gefixt ist.
// ─────────────────────────────────────────────────────────────────────────────

const PROD_BASE = process.env.PROD_BASE ?? 'https://realsyncdynamics-ai.pages.dev';

test.describe('Production routing (live)', () => {
  test.skip(process.env.PROD_SMOKE !== '1', 'Nur mit PROD_SMOKE=1 (Live-Test gegen Produktion).');

  test('Landingpage lädt mit Kern-CTAs', async ({ page }) => {
    const resp = await page.goto(`${PROD_BASE}/`, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'Landing muss 200 liefern').toBe(200);
    // Logo / Marke sichtbar
    await expect(page.locator('header, nav').first()).toBeVisible();
    // Primär-CTAs (Text variiert leicht, daher case-insensitive)
    await expect(page.getByText(/start for free/i).first()).toBeVisible();
    await expect(page.getByText(/product tour/i).first()).toBeVisible();
  });

  for (const route of ['/pricing', '/pricing/', '/audit', '/audit/', '/login', '/app']) {
    test(`Route ${route} lädt ohne 404/500/502`, async ({ page }) => {
      const resp = await page.goto(`${PROD_BASE}${route}`, { waitUntil: 'domcontentloaded' });
      const status = resp?.status() ?? 0;
      expect(
        [200].includes(status),
        `${route} lieferte HTTP ${status} (erwartet 200)`,
      ).toBeTruthy();
      // Kein White-Screen: es muss sichtbarer Body-Content existieren.
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }

  test('/audit lädt stabil (kein White-Screen, kein harter Crash)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const resp = await page.goto(`${PROD_BASE}/audit`, { waitUntil: 'networkidle' });
    expect(resp?.status()).toBe(200);
    await expect(page.locator('body')).not.toBeEmpty();
    expect(errors, `Uncaught Errors auf /audit: ${errors.join(' | ')}`).toHaveLength(0);
  });

  test('Mobile Viewport lädt ohne horizontalen Hard-Break', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${PROD_BASE}/`, { waitUntil: 'domcontentloaded' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // Kleine Toleranz für Subpixel-Rundung.
    expect(overflow, `Horizontaler Overflow: ${overflow}px`).toBeLessThanOrEqual(2);
  });
});
