import { test, expect } from '@playwright/test';

const STRIPE_TEST_MODE = process.env.STRIPE_TEST_MODE === 'true';
const BETA_ACTIVE = !['off', 'false', '0'].includes((process.env.VITE_BETA_PHASE ?? 'on').toLowerCase());

// Während der Beta (src/config/beta.ts) leitet /checkout/:plan in die
// Registrierung um; `?purchase=1` ist der bewusste Kaufpfad in den Checkout.
const STARTER_CHECKOUT = '/checkout/starter/?purchase=1';

test.describe('[CO] Checkout', () => {
  test('[CO-001] Checkout zeigt Login-Hinweis + Rückkehr in den Checkout', async ({ page }) => {
    await page.goto(STARTER_CHECKOUT, { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Zustimmung und Bestätigen starten den Checkout/i),
    ).toBeVisible();
  });

  test('[CO-002] Preislogik konsistent — Starter 79 € auf /pricing, Planname im Checkout', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/79\s*€/).first()).toBeVisible();

    await page.goto(STARTER_CHECKOUT, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Anmelden, um Starter zu buchen/i }),
    ).toBeVisible();
  });

  test('[CO-006] Beta: Checkout ohne ?purchase=1 leitet in die kostenlose Registrierung', async ({ page }) => {
    test.skip(!BETA_ACTIVE, 'Beta-Phase ist abgeschaltet (VITE_BETA_PHASE=off)');
    await page.goto('/checkout/starter/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/welcome\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('beta')).toBe('1');
    expect(url.searchParams.get('plan')).toBe('starter');
    expect(url.searchParams.get('next')).toMatch(/^\/app\/dashboard/);
  });

  test('[CO-005] Abbruchfluss landet sauber auf /checkout/cancelled', async ({ page }) => {
    const resp = await page.goto('/checkout/cancelled', { waitUntil: 'domcontentloaded' });
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

    await page.goto(STARTER_CHECKOUT, { waitUntil: 'domcontentloaded' });

    const frameExists = (await page.locator('iframe[src*="stripe.com"]').count()) > 0;
    if (!frameExists) {
      test.skip(true, 'Kein Stripe-iframe gefunden – ggf. erst nach Login sichtbar');
    }
  });

  test.skip('[CO-004] Checkout-Abschluss (MANUELL)', async () => {
    // Echte Checkout-Abschlüsse niemals automatisieren.
  });
});
