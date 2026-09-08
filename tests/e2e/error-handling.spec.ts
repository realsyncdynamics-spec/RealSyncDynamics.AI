import { test, expect } from '@playwright/test';

test.describe('[BE-002] Fehlerbehandlung', () => {
  test('Unbekannte Route zeigt NotFound statt White-Screen', async ({ page }) => {
    await page.goto('/diese-route-gibt-es-nicht-xyz', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Seite nicht gefunden/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Zur Startseite/i })).toBeVisible();
  });

  test('Unbekannter Checkout-Plan leitet zur Preisübersicht um', async ({ page }) => {
    await page.goto('/checkout/nicht-existent', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/pricing/);
    await expect(page).toHaveURL(/\/pricing/);
  });
});
