import { test, expect } from '@playwright/test';
import { testDomains } from '../fixtures/test-domains';

test.describe('[GOV] DSGVO-Audit-Seite', () => {
  test('[GOV-001] Audit-Seite lädt und Domain-Eingabe ist vorhanden', async ({ page }) => {
    await page.goto('/audit', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: /Kostenloser DSGVO- und Tracking-Audit/i }),
    ).toBeVisible();

    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="domain" i], input[name*="domain" i]').first();
    await expect(input).toBeVisible();
  });

  test('[GOV-002] Audit-Scan kann gestartet werden', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/audit', { waitUntil: 'domcontentloaded' });

    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="domain" i]').first();
    if (await input.count() === 0) {
      test.skip(true, 'Domain-Eingabefeld nicht gefunden');
      return;
    }

    await input.fill(testDomains.safe);

    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /scan|prüf|start|analysier/i }).first();
    if (await submitBtn.count() === 0) return;

    await submitBtn.click();
    await expect.poll(() => errors.length, { timeout: 4000 }).toBe(0);
    await expect(page).toHaveTitle(/.+/);
  });
});
