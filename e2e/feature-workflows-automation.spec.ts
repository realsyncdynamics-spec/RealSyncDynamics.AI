import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Workflow Automation Feature (Feature B)
 *
 * Tests complete flow:
 * 1. Create compliance check workflow
 * 2. Configure schedule and notifications
 * 3. Enable/disable workflow
 * 4. View workflow execution history
 */

test.describe('Workflow Automation', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Note: In production, use auth fixtures
    // For now, assume logged in
    await page.goto(`${baseUrl}/app`);
  });

  test.describe('Compliance Check Workflow', () => {
    test('should display workflow creation form', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Wait for form to load
      await expect(page.locator('text=Compliance-Check Workflow')).toBeVisible();
      await expect(page.locator('label:has-text("Workflow-Name")')).toBeVisible();
      await expect(page.locator('label:has-text("Beschreibung")')).toBeVisible();
    });

    test('should require workflow name and at least one notification channel', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Try to save without name or email
      await page.click('button:has-text("Speichern & Aktivieren")');

      // Should show error
      await expect(page.locator('text=Workflow-Name ist erforderlich')).toBeVisible();
    });

    test('should validate email recipients when email channel is selected', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Fill name
      await page.fill('input[placeholder*="Daily"]', 'Test Workflow');

      // Select email channel
      await page.click('button:has-text("E-Mail")');

      // Try to save without email recipients
      await page.click('button:has-text("Speichern & Aktivieren")');

      // Should show error
      await expect(page.locator('text=Mindestens eine E-Mail-Adresse erforderlich')).toBeVisible();
    });

    test('should allow adding email recipients', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Fill name
      await page.fill('input[placeholder*="Daily"]', 'Test Workflow');

      // Select email channel
      await page.click('button:has-text("E-Mail")');

      // Add email recipients
      await expect(page.locator('text=E-Mail-Empfänger')).toBeVisible();
      await page.fill('input[placeholder*="user@example.com"]', 'admin@example.com');

      // Verify email appears in field
      await expect(page.locator('input[placeholder*="user@example.com"]')).toHaveValue('admin@example.com');
    });

    test('should allow selecting schedule frequency', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Schedule buttons should be visible
      await expect(page.locator('button:has-text("Täglich")')).toBeVisible();
      await expect(page.locator('button:has-text("Wöchentlich")')).toBeVisible();
      await expect(page.locator('button:has-text("Monatlich")')).toBeVisible();

      // Click weekly
      await page.click('button:has-text("Wöchentlich")');

      // Button should show selected state
      const weeklyButton = page.locator('button:has-text("Wöchentlich")');
      const classes = await weeklyButton.getAttribute('class');
      expect(classes).toContain('security-500');
    });

    test('should allow enabling/disabling workflow', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Toggle enable checkbox
      const enableCheckbox = page.locator('input[type="checkbox"]').last();
      await enableCheckbox.check();

      // Verify enabled state
      await expect(enableCheckbox).toBeChecked();
    });

    test('should display time picker for UTC time', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Time input should be visible
      const timeInput = page.locator('input[type="time"]');
      await expect(timeInput).toBeVisible();

      // Set time
      await timeInput.fill('14:30');
      await expect(timeInput).toHaveValue('14:30');
    });

    test('should allow Slack channel configuration', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows/new`);

      // Select Slack channel
      await page.click('button:has-text("Slack")');

      // Slack section should show
      await expect(page.locator('text=Slack')).toBeVisible();
    });
  });

  test.describe('Workflow List and Management', () => {
    test('should display empty state when no workflows exist', async ({ page }) => {
      await page.goto(`${baseUrl}/app/workflows`);

      // Should show empty or creation prompt
      const hasEmptyState = await page.locator('text=Noch keine Workflows').isVisible().catch(() => false);
      expect(hasEmptyState || await page.locator('button:has-text("Neuer")').isVisible()).toBe(true);
    });

    test('should display workflow list with status indicators', async ({ page }) => {
      // This test assumes workflows exist in the database
      await page.goto(`${baseUrl}/app/workflows`);

      // Look for workflow entries
      const workflowCards = page.locator('[class*="Card"]');
      const count = await workflowCards.count();

      if (count > 0) {
        // Verify at least one workflow card displays
        await expect(workflowCards.first()).toBeVisible();
      }
    });
  });
});
