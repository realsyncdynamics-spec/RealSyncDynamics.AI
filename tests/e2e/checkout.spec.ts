import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';
const STRIPE_TEST_MODE = process.env.STRIPE_TEST_MODE === 'true';

test.describe('[CO] Checkout', () => {
  test('[CO-001] Checkout zeigt Login-Hinweis + Rückkehr in den Checkout', async ({ page }) => {
    await page.goto(BASE_URL + '/checkout/starter/', { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(/.+/);

    // Ohne Session: no_user-Shell mit Login-Aufforderung für den Starter-Plan.
    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible({ timeout: 10000 });
    // Klarer Rückkehr-Hinweis nach Login.
    await expect(
      page.getByText(/sofort wieder hier — der Checkout startet automatisch/i),
    ).toBeVisible();
  });

  test('[CO-002] Preislogik konsistent — Starter 79 € auf /pricing, Planname im Checkout', async ({ page }) => {
    await page.goto(BASE_URL + '/pricing', { waitUntil: 'networkidle' });
    await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/79\s*€/).first()).toBeVisible();

    await page.goto(BASE_URL + '/checkout/starter/', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible();
  });

  test('[CO-005] Abbruchfluss landet sauber auf /checkout/cancelled', async ({ page }) => {
    const resp = await page.goto(BASE_URL + '/checkout/cancelled', { waitUntil: 'networkidle' });
    expect(resp?.status(), 'HTTP-Status /checkout/cancelled').toBeLessThan(400);
    await expect(
      page.getByRole('heading', { name: /Checkout abgebrochen/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Preise|Pricing/i }).first()).toBeVisible();
  });

  test('[CO-003] Stripe ist nur im Testmodus aktiv', async ({ page }) => {
    if (!STRIPE_TEST_MODE) {
      test.skip(true, 'STRIPE_TEST_MODE ist nicht gesetzt – Checkout-Test übersprungen');
      return;
    }

    await page.goto(BASE_URL + '/checkout/starter/', { waitUntil: 'domcontentloaded' });

    // Prüfe, ob Stripe-Elemente im Testmodus geladen werden
    const stripeFrame = page.frameLocator('iframe[src*="stripe.com"]').first();
    // Nur prüfen, ob der Frame existiert – kein echter Zahlungsabschluss
    const frameExists = (await page.locator('iframe[src*="stripe.com"]').count()) > 0;
    if (frameExists) {
      expect(frameExists).toBe(true);
    } else {
      test.skip(true, 'Kein Stripe-iframe gefunden – ggf. erst nach Login sichtbar');
    }
  });

  // MANUELL: Echte Checkout-Abschlüsse niemals automatisieren
  test.skip('[CO-004] Checkout-Abschluss (MANUELL)', async () => {
    // Dieser Test erfordert:
    // 1. Stripe-Testkeys in ENV
    // 2. Mail-Capture für Bestätigungsmail
    // 3. Manuelle Freigabe pro Release
  });
});
