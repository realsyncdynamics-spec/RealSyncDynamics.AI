import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing page.
 *
 * Asserts that the post-simplification (#82) Hero structure renders with the
 * Compliance-Decision-Layer headline and that the primary CTA targets /audit.
 * Catches regressions where someone accidentally drops the Hero refactor or
 * breaks routing.
 */
test('Landing renders Hero and primary CTA', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Compliance-Decision-Layer/i }),
  ).toBeVisible();

  const cta = page.getByRole('link', { name: /Jetzt kostenlos scannen/i });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /\/audit/);
});
