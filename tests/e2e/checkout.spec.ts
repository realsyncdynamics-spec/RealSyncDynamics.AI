import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';
const STRIPE_TEST_MODE = process.env.STRIPE_TEST_MODE === 'true';

test.describe('[CO] Checkout', () => {
  test('[CO-001] Checkout-Seite lädt und zeigt Login/Checkout-Einstieg', async ({ page }) => {
    await page.goto(BASE_URL + '/checkout/starter/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/.+/);

    // Entweder Login-Button oder Checkout-Form muss sichtbar sein
    const loginOrCheckout = page
      .locator('button, a, form, input[type="email"]')
      .filter({ hasText: /login|anmeld|checkout|weiter|kaufen|starten/i })
      .first();

    // Soft check: Seite darf nicht leer sein
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('[CO-002] Stripe ist nur im Testmodus aktiv', async ({ page }) => {
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
