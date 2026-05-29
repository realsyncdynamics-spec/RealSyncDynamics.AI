import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /welcome — der Post-Checkout-Onboarding-Wizard.
 *
 * Volle Welcome-Flow-Coverage (Email → Magic-Link → API-Key → SDK)
 * braucht einen echten Supabase-Test-Tenant; das ist out of scope für
 * diese Smoke-Spec. Hier prüfen wir das stabile UI-Kontrakt:
 *
 *   - Drei-Schritte-Indikator rendert (1/2/3)
 *   - Headline „Willkommen. Drei Klicks bis zum Setup."
 *   - Ohne session-Query-Param erscheint die Session-Warnung
 *   - Mit session-Query-Param erscheint Step 1 mit Email-Input
 *
 * Catches Regressions wenn der Wizard auf einer Route ohne session-Guard
 * gemounted oder die Step-Komponente entfernt wird.
 */

test.describe('/welcome', () => {
  test('zeigt Fehler ohne session-Param', async ({ page }) => {
    await page.goto('/welcome');

    await expect(
      page.getByRole('heading', {
        name: /Willkommen\. Drei Klicks bis zum Setup\./i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText(/Keine Session-ID/i).first(),
    ).toBeVisible();
  });

  test('Step 1 rendert mit session-Param + Email-Input', async ({ page }) => {
    await page.goto('/welcome?session=cs_test_e2e_smoke&product=RealSync%20Dynamics');

    await expect(
      page.getByRole('heading', {
        name: /Willkommen\. Drei Klicks bis zum Setup\./i,
      }),
    ).toBeVisible();

    // Step-Indikator (1 ist current, 2+3 noch nicht)
    await expect(page.getByText(/^1$/).first()).toBeVisible();
    await expect(page.getByText(/^2$/).first()).toBeVisible();
    await expect(page.getByText(/^3$/).first()).toBeVisible();

    // Email-Input für Magic-Link sollte präsent sein
    await expect(
      page.locator('input[type="email"]').first(),
    ).toBeVisible();
  });
});
