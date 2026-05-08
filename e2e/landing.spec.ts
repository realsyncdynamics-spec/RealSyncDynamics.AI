import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing page Hero.
 *
 * Asserts the audience-broadened (PR-G) Hero structure: H1 fragt nach
 * DSGVO-Konformität in Alltagssprache, primärer CTA führt zum /audit-
 * Quick-Scan. Catches regressions wenn jemand den Hero-Reframe versehentlich
 * zurückdreht oder das CTA-Routing bricht.
 */
test('Landing renders Hero with audience-broadened claim and primary CTA', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Ist Ihre Website wirklich DSGVO-konform/i }),
  ).toBeVisible();

  const cta = page.getByRole('link', { name: /Kostenlosen Website-Check starten/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/audit/);
});
