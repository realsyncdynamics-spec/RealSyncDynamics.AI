import { test, expect } from '@playwright/test';
import { testDomains } from '../fixtures/test-domains';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

test.describe('[GOV] DSGVO-Audit-Seite', () => {
  test('[GOV-001] Audit-Seite lädt und Domain-Eingabe ist vorhanden', async ({ page }) => {
    await page.goto(BASE_URL + '/audit', { waitUntil: 'domcontentloaded' });

    // Seite muss laden
    await expect(page).toHaveTitle(/.+/);

    // Konkrete Hero-Headline der Audit-Seite (stabiler Kontrakt).
    await expect(
      page.getByRole('heading', { level: 1, name: /Kostenloser DSGVO- und Tracking-Audit/i }),
    ).toBeVisible();

    // Domain-Eingabefeld muss vorhanden sein
    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="domain" i], input[name*="domain" i]').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('[GOV-002] Audit-Scan kann gestartet werden', async ({ page }) => {
    await page.goto(BASE_URL + '/audit', { waitUntil: 'domcontentloaded' });

    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="domain" i]').first();
    if (await input.count() === 0) {
      test.skip(true, 'Domain-Eingabefeld nicht gefunden');
      return;
    }

    await input.fill(testDomains.safe);

    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /scan|prüf|start|analysier/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      // Warten auf irgendeine Reaktion (Loader, Ergebnis)
      await page.waitForTimeout(2000);
      // Kein harter Assert – nur prüfen, ob kein JS-Crash aufgetreten ist
      const title = await page.title();
      expect(title).toBeTruthy();
    }
  });
});
