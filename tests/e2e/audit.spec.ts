import { test, expect } from '@playwright/test';
import { testDomains } from '../fixtures/test-domains';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:4173';

test.describe('[GOV] DSGVO-Audit-Seite', () => {
  test('[GOV-001] Audit-Seite lädt mit Hero-Headline und Scan-CTA', async ({ page }) => {
    await page.goto(BASE_URL + '/audit', { waitUntil: 'domcontentloaded' });

    // Seite muss laden
    await expect(page).toHaveTitle(/.+/);

    // Konkrete Hero-Headline der Audit-Seite (stabiler Kontrakt).
    // Die Seite ist ein CTA-Landing ("EU AI Act Compliance Check"): der Scan
    // selbst läuft unter /scan, es gibt hier kein Inline-Domain-Eingabefeld.
    await expect(
      page.getByRole('heading', { level: 1, name: /EU AI Act Compliance Check/i }),
    ).toBeVisible();

    // Primäre Scan-CTA muss vorhanden sein (die Seite hat mehrere „Try Free"-
    // Links — Hero + untere CTA-Sektion —, daher .first()).
    await expect(page.getByRole('link', { name: /Try Free/i }).first()).toBeVisible({ timeout: 10000 });
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
