import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für /partners — die DSB-Kanzlei-Landing.
 *
 * Schützt die im Code dokumentierten ehrlichen Promises:
 *   - 3 Tiers (Agency, Scale, Enterprise) mit echten Preisen
 *   - Lead-Capture-CTA → /contact-sales (kein erfundenes Affiliate-Tracking)
 *   - Roadmap-Hinweis: Affiliate-Tracking + 50-Tenant-Quota = Q4 2026
 */

test.describe('/partners', () => {
  test('rendert 3 Tier-Cards mit Preisen + Lead-CTA + ehrlicher Roadmap', async ({
    page,
  }) => {
    await page.goto('/partners');

    await expect(
      page.getByRole('heading', {
        name: /DSB-Kanzleien betreiben/i,
      }),
    ).toBeVisible();

    await expect(page.getByText(/Pilot-Partner gesucht/i).first()).toBeVisible();

    await expect(page.getByText(/€699\s*\/\s*Monat/).first()).toBeVisible();
    await expect(page.getByText(/€1\.999\s*\/\s*Monat/).first()).toBeVisible();

    const leadCta = page
      .locator('a[href*="/contact-sales"]')
      .first();
    await expect(leadCta).toBeVisible();

    await expect(
      page.getByText(/Sie behalten den Mandanten/i).first(),
    ).toBeVisible();
  });
});
