import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:3000';
const DOMAIN = process.env.TRANSFORMATION_TEST_DOMAIN || 'example.com';

/**
 * Transformation acceptance coverage.
 *
 * Real Stripe payment is intentionally opt-in. The default CI suite verifies
 * the public value-first journey and its single transformation CTA. The live
 * payment case requires TRANSFORMATION_LIVE_E2E=true and an environment that
 * is explicitly configured for Stripe test mode.
 */
test.describe('Website Transformation funnel', () => {
  test('[T-001] public preview is value-first and exposes one primary transformation action', async ({ page }) => {
    await page.goto(`${BASE_URL}/unified-entry/transformation?domain=${encodeURIComponent(DOMAIN)}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/neue website|website/i).first()).toBeVisible();

    const primaryActions = page.getByRole('button', { name: /website transformieren|transformieren|builder öffnen/i });
    await expect(primaryActions.first()).toBeVisible();

    // Multiple variant cards are expected; multiple competing purchase/audit
    // buttons are not. This keeps the conversion moment unambiguous.
    const competingAuditActions = page.getByRole('button', { name: /audit|prüfen|scan starten/i });
    expect(await competingAuditActions.count()).toBeLessThanOrEqual(1);
  });

  test('[T-002] variant selection remains available before transformation CTA', async ({ page }) => {
    await page.goto(`${BASE_URL}/unified-entry/transformation?domain=${encodeURIComponent(DOMAIN)}`);
    await page.waitForLoadState('networkidle');

    const variantControls = page.getByText(/Modern Minimal|Bento Bold|Dark Professional|Executive|Authority|Minimal/i);
    expect(await variantControls.count()).toBeGreaterThanOrEqual(2);
  });

  test('[T-003] unauthenticated success URL does not grant transformation access', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/checkout/success?product=governance_launch`);
    await page.waitForLoadState('networkidle');

    // The success page may show a pending/retry state, but it must not claim
    // entitlement merely because the URL was visited.
    const unauthorized = page.getByText(/nicht freigeschaltet|warte|prüf|entitlement|zahlung/i);
    const siteOsHeading = page.getByText(/transformation dashboard|meine transformation/i);

    if (await siteOsHeading.count()) {
      // If dashboard UI is rendered, it must still not expose a publish action
      // without server-side entitlement.
      const publish = page.getByRole('button', { name: /veröffentlichen|publish/i });
      expect(await publish.count()).toBe(0);
    } else {
      expect(await unauthorized.count()).toBeGreaterThan(0);
    }
  });

  test('[T-004] live Stripe acceptance is opt-in only', async ({ page }) => {
    test.skip(
      process.env.TRANSFORMATION_LIVE_E2E !== 'true',
      'Live transformation E2E requires explicit Stripe test-mode configuration',
    );

    await page.goto(`${BASE_URL}/unified-entry/transformation?domain=${encodeURIComponent(DOMAIN)}`);
    await page.waitForLoadState('networkidle');

    const transform = page.getByRole('button', { name: /website transformieren|transformieren/i }).first();
    await expect(transform).toBeVisible();
    await transform.click();

    await page.waitForURL(/checkout|stripe/i, { timeout: 30_000 });
    expect(page.url()).toMatch(/checkout|stripe/i);
  });
});
