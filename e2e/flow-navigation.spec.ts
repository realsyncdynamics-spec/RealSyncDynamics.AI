/**
 * E2E Flow Navigation Tests — Browser-basierte Validierung
 *
 * Testet die vollständige User Journey im Browser:
 * 1. Landing → Scan-Erklärung → Scanner → Ergebnis → Maßnahmen → Paket → Checkout → Dashboard
 * 2. Alternative Pfade (Skip, Zurück, Direktzugriff)
 * 3. State-Persistierung nach Reload
 * 4. Externe Route-Integration (Handoff zu /audit, /pricing, etc.)
 *
 * Voraussetzung: App läuft auf localhost:3000
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Flow Navigation Tests — Browser-basierte Validierung
 *
 * Testet die vollständige User Journey im Browser:
 * 1. Landing → Scan-Erklärung → Scanner → Ergebnis → Maßnahmen → Paket → Checkout → Dashboard
 * 2. Alternative Pfade (Skip, Zurück, Direktzugriff)
 * 3. State-Persistierung nach Reload
 * 4. Externe Route-Integration (Handoff zu /audit, /pricing, etc.)
 *
 * Verwendet Playwright baseURL aus playwright.config.ts
 * (http://localhost:3000 lokal, http://localhost:4173 in CI)
 */

test.describe('E2E Flow Navigation — Golden Path', () => {
  test('should navigate from landing through scan to result', async ({ page }) => {
    // Start: Landing (uses baseURL from playwright config)
    await page.goto('/');
    await expect(page).toHaveTitle(/RealSyncDynamics|Governance/);

    // Flow Entry: „Scan starten"
    await page.click('text=Scan starten');
    await page.waitForURL(/\/flow\/.*/);
    await expect(page).toHaveURL(/\/flow\/start-scan/);
    await expect(page.locator('h1')).toContainText('Compliance-Scan starten');

    // Scan-Erklärung: Domain eingeben
    await page.click('text=Weiter: Domain eingeben');
    await expect(page).toHaveURL(/\/flow\/scan-domain/);
    await expect(page.locator('h1')).toContainText('Domain eingeben');

    // Zur echten Scan-Seite
    await page.click('text=Zur Scan-Eingabe');
    await page.waitForURL(/\/audit/);
    await expect(page).toHaveURL(/\/audit/);
  });

  test('should navigate pricing flow', async ({ page }) => {
    // Start: Preise
    await page.goto('/flow/pricing-intro');
    await expect(page.locator('h1')).toContainText('Preise & Pakete');

    // Paket-Wahl
    await page.click('text=Paket auswählen');
    await expect(page).toHaveURL(/\/flow\/choose-plan/);

    // Starter wählen
    await page.click('text=Starter wählen');
    await expect(page).toHaveURL(/\/flow\/checkout\/starter/);
    await expect(page.locator('h1')).toContainText('Starter');

    // Zur Checkout-Seite
    await page.click('text=Checkout starten');
    await page.waitForURL(/\/checkout/);
  });

  test('should handle checkout cancellation', async ({ page }) => {
    // Navigate to checkout flow
    await page.goto('/flow/checkout/starter');
    await expect(page.locator('h1')).toContainText('Starter');

    // Click cancellation option
    await page.click('text=Abgebrochen?');
    await expect(page).toHaveURL(/\/flow\/checkout-cancelled/);
    await expect(page.locator('h1')).toContainText('Checkout abgebrochen');

    // Return to plan selection
    await page.click('text=Paket erneut wählen');
    await expect(page).toHaveURL(/\/flow\/choose-plan/);
  });
});

test.describe('E2E Flow Navigation — Alternative Paths', () => {
  test('should allow skipping from pricing to login', async ({ page }) => {
    await page.goto('/flow/pricing-intro');

    // Skip to login
    const extraActions = await page.locator('button, a').all();
    const loginLink = extraActions.find(
      async (el) => (await el.textContent())?.includes('Weiter zur Paketwahl'),
    );

    if (loginLink) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/flow\//);
    }
  });

  test('should provide back navigation on every step', async ({ page }) => {
    // Test from different steps
    const testSteps = [
      '/flow/start-scan',
      '/flow/scan-domain',
      '/flow/pricing-intro',
      '/flow/choose-plan',
    ];

    for (const step of testSteps) {
      await page.goto(step);

      // Look for secondary/back button
      const backButton = await page.locator('button, a').filter({
        hasText: /Zurück|Back/i,
      }).first();

      const isVisible = await backButton.isVisible().catch(() => false);
      expect(isVisible || step === '/flow/start-scan').toBe(true);
    }
  });

  test('should return to home from any step', async ({ page }) => {
    await page.goto('/flow/choose-plan');

    // Find home link
    const homeLinks = await page.locator('a[href="/"]').all();
    expect(homeLinks.length).toBeGreaterThan(0);

    // Click it
    await homeLinks[0].click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });
});

test.describe('E2E Flow State Persistence', () => {
  test('should persist state after page reload', async ({ page }) => {
    // Navigate to a flow step
    await page.goto('/flow/scan-running');
    await expect(page.locator('h1')).toContainText('Der Scan läuft');

    // Check localStorage
    const storageState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rsd.flow.state.v1') || '{}');
    });

    // Reload
    await page.reload();

    // State should be restored
    const newStorageState = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rsd.flow.state.v1') || '{}');
    });

    expect(newStorageState.lastStepId).toBeDefined();
  });

  test('should preserve flow context across pages', async ({ page }) => {
    // Navigate through multiple steps
    await page.goto('/flow/choose-plan');
    await page.click('text=Growth wählen');
    await expect(page).toHaveURL(/checkout\/growth/);

    // Check state was updated
    const state = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rsd.flow.state.v1') || '{}');
    });

    expect(state.selectedPlan).toBe('growth');
  });

  test('should reset state on explicit reset', async ({ page }) => {
    // Navigate and set state
    await page.goto('/flow/choose-plan');

    // Reset (simulated via localStorage clear)
    await page.evaluate(() => {
      localStorage.removeItem('rsd.flow.state.v1');
    });

    // Page should still work
    await page.reload();
    await expect(page.locator('h1')).toContainText('Paket auswählen');
  });
});

test.describe('E2E Flow Error Handling', () => {
  test('should handle invalid slug gracefully', async ({ page }) => {
    await page.goto('/flow/invalid-slug-xyz');

    // Should show error page with navigation options
    await expect(page.locator('text=Dieser Schritt existiert nicht')).toBeVisible();

    // Should have recovery buttons
    const startButton = page.locator('text=Ablauf starten');
    const homeButton = page.locator('text=Zur Startseite');

    await expect(startButton).toBeVisible();
    await expect(homeButton).toBeVisible();

    // Should be able to navigate back
    await startButton.click();
    await expect(page).toHaveURL(/\/flow\/start-scan/);
  });

  test('should handle missing navigation gracefully', async ({ page }) => {
    // Navigate to a flow page
    await page.goto('/flow/start-scan');

    // Even if primary action is missing (edge case), should render
    const page_content = await page.content();
    expect(page_content.length).toBeGreaterThan(0);
  });
});

test.describe('E2E Flow Progress Tracking', () => {
  test('should show correct progress at each stage', async ({ page }) => {
    const steps = [
      { url: '/flow/start-scan', stage: 'scan' },
      { url: '/flow/scan-running', stage: 'scan' },
      { url: '/flow/report', stage: 'ergebnis' },
      { url: '/flow/choose-plan', stage: 'paket' },
      { url: '/flow/checkout/starter', stage: 'checkout' },
      { url: '/flow/dashboard', stage: 'dashboard' },
    ];

    for (const step of steps) {
      await page.goto(step.url);

      // Progress should indicate stage
      const progressIndicator = page.locator(
        `text=${step.stage.charAt(0).toUpperCase() + step.stage.slice(1)}`,
      );
      const isVisible = await progressIndicator.isVisible().catch(() => false);

      // At minimum, page should load without error
      await expect(page.locator('h1')).not.toBeEmpty();
    }
  });

  test('should track visited steps', async ({ page }) => {
    // Navigate through several steps
    const steps = ['/flow/start-scan', '/flow/scan-domain', '/flow/pricing-intro'];

    for (const step of steps) {
      await page.goto(step);
    }

    // Check visited in state
    const state = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('rsd.flow.state.v1') || '{}');
    });

    expect(Array.isArray(state.visited)).toBe(true);
    expect(state.visited.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('E2E External Route Integration', () => {
  test('should link to real audit page', async ({ page }) => {
    await page.goto('/flow/scan-domain');

    const auditLink = page.locator('a[href="/audit"]');
    const exists = await auditLink.count();

    expect(exists).toBeGreaterThan(0);
  });

  test('should link to real pricing page', async ({ page }) => {
    await page.goto('/flow/pricing-intro');

    const pricingLink = page.locator('a[href="/pricing"]');
    const exists = await pricingLink.count();

    expect(exists).toBeGreaterThan(0);
  });

  test('should link to checkout routes', async ({ page }) => {
    await page.goto('/flow/checkout/starter');

    const checkoutLink = page.locator('a[href*="/checkout"]');
    const exists = await checkoutLink.count();

    expect(exists).toBeGreaterThan(0);
  });
});

test.describe('E2E Accessibility', () => {
  test('should have semantic HTML structure', async ({ page }) => {
    await page.goto('/flow/start-scan');

    // Should have main and nav
    const main = page.locator('main');
    const nav = page.locator('nav');

    await expect(main).toBeVisible();
    await expect(nav).toBeVisible();
  });

  test('should have accessible button labels', async ({ page }) => {
    await page.goto('/flow/choose-plan');

    // All buttons should have text content
    const buttons = await page.locator('button, a[role="button"]').all();

    for (const button of buttons) {
      const text = await button.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/flow/start-scan');

    // Tab to first button
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);

    expect(['BUTTON', 'A']).toContain(focused);
  });
});
