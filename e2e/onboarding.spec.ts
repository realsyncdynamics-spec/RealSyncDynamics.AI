import { test, expect } from '@playwright/test';

/**
 * E2E für den kanonischen Onboarding-Pfad (WP10 / Masterplan M1):
 *   Scan (`/audit`) → Registrierung (`/welcome`) → Activation (`/app/activation`) → Dashboard (`/app/dashboard`)
 *
 * Prüft außerdem das stabile UI-Kontrakt von `/welcome` (ohne/mit `session=`)
 * sowie die Umleitung überzähliger Einstiege unter Erhalt der Query-Parameter.
 */

test.describe('/welcome', () => {
  test('ohne session-Param: "Willkommen zurück." + Step 1 mit Email-Input', async ({ page }) => {
    await page.goto('/welcome');

    await expect(
      page.getByRole('heading', {
        name: /Willkommen zurück\./i,
      }),
    ).toBeVisible();

    // Email-Input für Magic-Link sollte präsent sein (Step 1)
    await expect(
      page.locator('input[type="email"]').first(),
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

test.describe('WP10 — Kanonischer Onboarding-Pfad: Scan → Registrierung → Activation → Dashboard', () => {
  test('leitet überzählige Einstiege unter Erhalt der Query-Parameter auf den kanonischen Pfad um', async ({
    page,
  }) => {
    await page.goto('/unified-entry/scan?domain=example.de');
    await expect(page).toHaveURL(/\/audit\?domain=example\.de$/);

    await page.goto('/flow/start-scan?utm_source=e2e');
    await expect(page).toHaveURL(/\/audit\?utm_source=e2e$/);

    await page.goto('/unified-entry/register?plan=starter');
    await expect(page).toHaveURL(/\/welcome\?plan=starter$/);
  });

  test('Scan (/audit) → Registrierung (/welcome) → Activation (/app/activation) → Dashboard (/app/dashboard)', async ({
    page,
  }) => {
    // 1. Scan-Einstieg (/audit)
    await page.goto('/audit?domain=example.de');
    await expect(page).toHaveURL(/\/audit\?domain=example\.de$/);

    // 2. Registrierung (/welcome mit ?next=/app/activation)
    await page.goto('/welcome?next=%2Fapp%2Factivation');
    await expect(
      page.getByRole('heading', { name: /Willkommen zurück\./i }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();

    // 3. Activation (/app/activation) und Dashboard (/app/dashboard) führen ohne Session
    //    über AppGate deterministisch über /welcome?next=... zurück auf den Zielpfad.
    await page.goto('/setup-assistant?domain=example.de');
    await expect(page).toHaveURL(/\/welcome\?next=%2Fapp%2Factivation%3Fdomain%3Dexample\.de$/);

    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/welcome\?next=%2Fapp%2Fdashboard$/);
  });
});
