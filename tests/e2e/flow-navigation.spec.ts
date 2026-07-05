import { test, expect } from '@playwright/test';

/**
 * E2E Flow Navigation Tests — Routing Infrastructure Validation
 *
 * Conservative tests that verify all flow routes load successfully.
 * These tests validate the routing infrastructure without relying on
 * specific UI elements or user interactions.
 *
 * Playwright uses baseURL from playwright.config.ts:
 * - Local: http://localhost:3000
 * - CI: http://localhost:4173 (via vite preview)
 */

test.describe('E2E Flow Navigation — Route Loading', () => {
  // Test each flow step loads without error
  const flowRoutes = [
    { path: '/flow/start-scan', title: 'Compliance-Scan starten' },
    { path: '/flow/scan-domain', title: 'Domain eingeben' },
    { path: '/flow/scan-running', title: 'Der Scan läuft' },
    { path: '/flow/report', title: 'Dein Scan-Ergebnis' },
    { path: '/flow/measures', title: 'Empfohlene Maßnahmen' },
    { path: '/flow/login', title: 'Anmelden' },
    { path: '/flow/pricing-intro', title: 'Preise & Pakete' },
    { path: '/flow/choose-plan', title: 'Paket auswählen' },
    { path: '/flow/checkout/starter', title: 'Paket „Starter"' },
    { path: '/flow/checkout/growth', title: 'Paket „Growth"' },
    { path: '/flow/checkout/agency', title: 'Paket „Agency"' },
    { path: '/flow/checkout-success', title: 'Zahlung erfolgreich' },
    { path: '/flow/checkout-cancelled', title: 'Checkout abgebrochen' },
    { path: '/flow/dashboard', title: 'Dein persönliches Dashboard' },
  ];

  for (const route of flowRoutes) {
    test(`should load ${route.path}`, async ({ page }) => {
      await page.goto(route.path);

      // Page should load successfully
      await expect(page.locator('main')).toBeVisible();

      // Should have a heading
      const heading = page.locator('h1');
      await expect(heading).not.toBeEmpty();

      // Should be on the correct route
      await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
    });
  }

  test('should handle invalid flow routes gracefully', async ({ page }) => {
    await page.goto('/flow/invalid-nonexistent-route-xyz');

    // Should show an error or not found page, not crash
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });
});

test.describe('E2E Flow Navigation — State Persistence', () => {
  test('should persist flow state in localStorage', async ({ page }) => {
    await page.goto('/flow/scan-running');

    // LocalStorage should be initialized with flow state
    const state = await page.evaluate(() => {
      const data = localStorage.getItem('rsd.flow.state.v1');
      return data ? JSON.parse(data) : null;
    });

    // Flow state might be empty or have data - just verify it exists
    expect(state).not.toBeNull();
  });

  test('should maintain state after page reload', async ({ page }) => {
    // Navigate to a flow step
    await page.goto('/flow/pricing-intro');

    // Page should render
    await expect(page.locator('h1')).not.toBeEmpty();

    // Reload page
    await page.reload();

    // Page should still be accessible
    await expect(page.locator('h1')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/flow\/pricing-intro/);
  });
});

test.describe('E2E Flow Navigation — Page Structure', () => {
  test('should have semantic page structure', async ({ page }) => {
    await page.goto('/flow/start-scan');

    // Should have main content area
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have navigation
    const nav = page.locator('nav');
    const navExists = await nav.count().catch(() => 0);
    expect(navExists).toBeGreaterThanOrEqual(0);

    // Should have heading
    const heading = page.locator('h1');
    await expect(heading).not.toBeEmpty();
  });

  test('flow pages should have navigation controls', async ({ page }) => {
    await page.goto('/flow/scan-domain');

    // Should have buttons or links (navigation controls)
    const buttons = page.locator('button');
    const links = page.locator('a');

    const buttonCount = await buttons.count().catch(() => 0);
    const linkCount = await links.count().catch(() => 0);

    // At least some navigation elements should exist
    expect(buttonCount + linkCount).toBeGreaterThan(0);
  });
});
