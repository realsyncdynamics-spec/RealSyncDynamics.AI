import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

/**
 * [BE-002] Fehlerbehandlung — ungültige Eingaben erzeugen eine valide
 * Reaktion ohne White-Screen oder 500-Leak. Rein client-seitig, ohne Backend.
 */
test.describe('[BE-002] Fehlerbehandlung', () => {
  test('Unbekannte Route zeigt NotFound statt White-Screen', async ({ page }) => {
    await page.goto(BASE_URL + '/diese-route-gibt-es-nicht-xyz', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Seite nicht gefunden/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /Zur Startseite/i })).toBeVisible();
  });

  test('Unbekannter Checkout-Plan leitet zur Preisübersicht um', async ({ page }) => {
    // CheckoutPage leitet ungültige Plan-Keys bewusst nach /pricing um
    // (siehe pricing-flow.spec.ts „invalid checkout slug should redirect to /pricing").
    await page.goto(BASE_URL + '/checkout/nicht-existent', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/pricing/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/pricing/);
  });
});
