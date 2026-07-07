import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://realsyncdynamicsai.de';

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

  test('Unbekannter Checkout-Plan zeigt klare Fehlermeldung', async ({ page }) => {
    await page.goto(BASE_URL + '/checkout/nicht-existent', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Unbekanntes Paket/i)).toBeVisible({ timeout: 10000 });
  });
});
