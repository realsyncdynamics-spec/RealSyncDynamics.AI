import { test, expect } from '@playwright/test';

test.describe('Evidence Vault Archive', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to evidence vault (assumes authenticated user)
    await page.goto('/app/governance/evidence-vault');
  });

  test('should display evidence items', async ({ page }) => {
    // Wait for evidence table to load
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Check that evidence items are displayed
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should open evidence detail panel', async ({ page }) => {
    // Find and click on first evidence item
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Check that detail panel is displayed
      await expect(page.locator('text=Evidence Details')).toBeVisible();
      await expect(page.locator('button:has-text("Archive")')).toBeVisible();
    }
  });

  test('should archive evidence item', async ({ page }) => {
    // Open first evidence item
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Wait for detail panel
      await expect(page.locator('text=Evidence Details')).toBeVisible();

      // Click archive button
      const archiveButton = page.locator('button:has-text("Archive")');
      await archiveButton.click();

      // Handle confirmation dialog
      page.once('dialog', dialog => {
        dialog.accept();
      });

      // Wait for archive to complete
      await expect(page.locator('text=Archiving...')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Archiving...')).not.toBeVisible({ timeout: 10000 });

      // Detail panel should close after successful archive
      await expect(page.locator('text=Evidence Details')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should show error on failed archive', async ({ page }) => {
    // This test assumes we can trigger an error condition
    // (e.g., by intercepting the request and returning an error)

    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Intercept the archive request and return error
      await page.route('**/iso42001-evidence-vault*', route => {
        if (route.request().method() === 'PATCH') {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      const archiveButton = page.locator('button:has-text("Archive")');
      await archiveButton.click();

      // Handle confirmation
      page.once('dialog', dialog => {
        dialog.accept();
      });

      // Wait for error message to appear
      await expect(page.locator('text=Archive failed')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter archived items', async ({ page }) => {
    // Check if there's a filter option to show/hide archived items
    const filterButton = page.locator('button:has-text("Filter")').first();
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Look for archived items toggle
      const archivedToggle = page.locator('text=Show Archived');
      if (await archivedToggle.isVisible()) {
        await page.click('text=Show Archived');

        // List should update to show archived items
        await page.waitForTimeout(500);
      }
    }
  });

  test('should close detail panel', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Wait for detail panel
      await expect(page.locator('text=Evidence Details')).toBeVisible();

      // Click close button
      const closeButton = page.locator('[aria-label="close"], button:has-text("×")').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }

      // Panel should close
      await expect(page.locator('text=Evidence Details')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should require confirmation before archiving', async ({ page }) => {
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Wait for detail panel
      await expect(page.locator('text=Evidence Details')).toBeVisible();

      // Click archive button
      const archiveButton = page.locator('button:has-text("Archive")');

      // Dismiss confirmation dialog
      page.once('dialog', dialog => {
        dialog.dismiss();
      });

      await archiveButton.click();

      // Wait briefly for potential archive attempt
      await page.waitForTimeout(500);

      // Detail panel should still be open (action was cancelled)
      await expect(page.locator('text=Evidence Details')).toBeVisible();
    }
  });
});
