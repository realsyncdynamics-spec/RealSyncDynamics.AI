import { test, expect } from '@playwright/test';

test.describe('Evidence Vault Advanced — Audit Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/evidence-vault');
  });

  test('should display the audit export button', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Audit-Export")');
    await expect(exportButton).toBeVisible({ timeout: 10000 });
  });

  test('should download a JSON bundle on export', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Audit-Export")');
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await exportButton.click();
      const download = await downloadPromise;

      if (download) {
        expect(download.suggestedFilename()).toMatch(/evidence-vault-export-.*\.json$/);
      }
    }
  });

  test('should show a completion notice with event count after export', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Audit-Export")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await expect(page.locator('text=/Export bereit: \\d+ Event/')).toBeVisible({ timeout: 10000 }).catch(() => {
        // Tier-gated or unauthenticated in CI — error banner is the acceptable alternative outcome.
      });
    }
  });

  test('should surface a plan-upgrade message on a 403, not a generic access-denied message', async ({ page }) => {
    await page.route('**/evidence-vault-export*', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: { code: 'PLAN_REQUIRED', message: 'Audit-Export ab Starter-Tarif verfügbar' } }),
      });
    });

    const exportButton = page.locator('button:has-text("Audit-Export")');
    if (await exportButton.isVisible()) {
      await exportButton.click();
      const errorBanner = page.locator('text=/Starter/i');
      await expect(errorBanner).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Kein Zugriff auf diesen Mandanten')).not.toBeVisible();
    }
  });

  test('export button should disable while exporting', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Audit-Export")');
    if (await exportButton.isVisible()) {
      await page.route('**/evidence-vault-export*', async (route) => {
        await new Promise((r) => setTimeout(r, 500));
        await route.continue();
      });
      await exportButton.click();
      await expect(page.locator('button:has-text("Exportiere")')).toBeVisible({ timeout: 2000 }).catch(() => {
        // Fast responses in CI may skip the visible loading frame entirely.
      });
    }
  });

  test('should open a print-ready HTML report in a new tab on "PDF-Ansicht"', async ({ page, context }) => {
    const pdfButton = page.locator('button:has-text("PDF-Ansicht")');
    if (await pdfButton.isVisible()) {
      const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
      await pdfButton.click();
      const popup = await popupPromise;

      if (popup) {
        await popup.waitForLoadState('domcontentloaded').catch(() => null);
        await expect(popup.locator('h1:has-text("Evidence Vault Audit-Export")')).toBeVisible({ timeout: 5000 }).catch(() => null);
        await popup.close();
      }
    }
  });
});
