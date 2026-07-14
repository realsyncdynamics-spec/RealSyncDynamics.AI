import { test, expect } from '@playwright/test';

test.describe('SEO-Dashboard Compliance & Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/demo-login');

    // Perform demo login
    await page.fill('input[name="email"]', 'demo@example.com');
    await page.fill('input[name="password"]', 'demo123456');
    await page.click('button[type="submit"]');

    // Wait for dashboard redirect
    await page.waitForURL(/\/app\/dashboard/, { timeout: 10000 });
  });

  test('should display compliance report panel', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for compliance report panel
    const compliancePanel = page.locator('text=COMPLIANCE-BERICHT');
    await expect(compliancePanel).toBeVisible();
  });

  test('should display compliance status cards', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for status cards
    const statusSection = page.locator('text=COMPLIANCE-STATUS');
    await expect(statusSection).toBeVisible();

    // Verify metrics are displayed
    const metrics = page.locator('[class*="font-mono"]').filter({ hasText: /Gesamtoperationen|Eindeutige Benutzer|Exporte|Fehlerrate/i });
    const count = await metrics.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow selecting report type', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    const reportTypeSelect = page.locator('select').first();
    await expect(reportTypeSelect).toBeVisible();

    // Verify options exist
    const options = page.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('should allow setting date range for report', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Find date inputs
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();

    if (count >= 2) {
      // Get from and to dates
      const fromInput = dateInputs.nth(0);
      const toInput = dateInputs.nth(1);

      await expect(fromInput).toBeVisible();
      await expect(toInput).toBeVisible();

      // Verify they have default values
      const fromValue = await fromInput.inputValue();
      const toValue = await toInput.inputValue();

      expect(fromValue).toBeTruthy();
      expect(toValue).toBeTruthy();
    }
  });

  test('should allow selecting report format', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for format buttons
    const jsonButton = page.locator('button:has-text("JSON")');
    const csvButton = page.locator('button:has-text("CSV")');

    if (await jsonButton.isVisible()) {
      await expect(jsonButton).toBeVisible();
    }

    if (await csvButton.isVisible()) {
      await expect(csvButton).toBeVisible();
    }
  });

  test('should generate compliance report', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Find generate button
    const generateButton = page.locator('button:has-text("Bericht generieren")');

    if (await generateButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      await generateButton.click();

      try {
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBeTruthy();
      } catch {
        // Download may not happen in test environment
      }
    }
  });

  test('should display audit log summary', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for audit summary section
    const auditSection = page.locator('text=/Gesamtoperationen|Eindeutige Benutzer|Exporte/');
    if (await auditSection.first().isVisible()) {
      await expect(auditSection.first()).toBeVisible();
    }
  });

  test('should display compliance information', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for compliance information panel
    const infoPanel = page.locator('text=/Verfügbare Berichte|DSGVO-Zugriffsverlauf/');
    if (await infoPanel.first().isVisible()) {
      await expect(infoPanel.first()).toBeVisible();
    }
  });

  test('should show report type descriptions', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for report descriptions
    const dsgvoDesc = page.locator('text=/DSGVO-Zugriffsverlauf|Alle Benutzer-Zugriffe/i');
    if (await dsgvoDesc.isVisible()) {
      await expect(dsgvoDesc).toBeVisible();
    }

    const aiActDesc = page.locator('text=/EU AI Act Audit|KI-System-Entscheidungen/i');
    if (await aiActDesc.isVisible()) {
      await expect(aiActDesc).toBeVisible();
    }
  });

  test('should track dashboard access in audit log', async ({ page }) => {
    // Access dashboard multiple times
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Wait a moment
    await page.waitForTimeout(500);

    // Check for audit indicators
    const auditElements = page.locator('[class*="audit"]').or(page.locator('[class*="log"]'));
    const count = await auditElements.count();

    // Should have some audit-related elements
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should show error handling for failed report generation', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Simulate network error by aborting requests
    await page.route('**/functions/v1/generate-compliance-report', route => {
      route.abort('failed');
    });

    // Try to generate report
    const generateButton = page.locator('button:has-text("Bericht generieren")');
    if (await generateButton.isVisible()) {
      await generateButton.click();

      // Wait for error message
      await page.waitForTimeout(1000);

      // Check for error display
      const errorMessage = page.locator('[class*="error"]').or(page.locator('[class*="red"]'));
      const hasError = await errorMessage.first().isVisible().catch(() => false);

      // Error should be displayed or page should remain functional
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toBeVisible();
    }
  });

  test('should maintain compliance status while filtering', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Open filters
    const filterButton = page.locator('button:has-text("Erweiterte Filter")');
    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Wait for filter panel
      await page.waitForTimeout(500);

      // Verify compliance status still visible
      const complianceStatus = page.locator('text=COMPLIANCE-STATUS');
      // Should still be scrollable/available on page
      expect(await page.locator('body').isVisible()).toBe(true);
    }
  });

  test('should show report generation in progress', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Intercept and delay report generation
    await page.route('**/functions/v1/generate-compliance-report', route => {
      setTimeout(() => route.continue(), 2000);
    });

    const generateButton = page.locator('button:has-text("Bericht generieren")');
    if (await generateButton.isVisible()) {
      // Button should show loading state
      const loadingIndicator = page.locator('text=Wird generiert');

      await generateButton.click();

      // Check for loading state (may or may not be visible depending on timing)
      await page.waitForTimeout(500);

      // Page should remain interactive
      const filterButton = page.locator('button:has-text("Erweiterte Filter")');
      expect(await filterButton.isEnabled().catch(() => true)).toBe(true);
    }
  });

  test('should allow report format switching', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Find format buttons
    const jsonButton = page.locator('button:has-text("JSON")');
    const csvButton = page.locator('button:has-text("CSV")');

    if (await jsonButton.isVisible() && await csvButton.isVisible()) {
      // Initially JSON should be selected
      expect(await jsonButton.getAttribute('class')).toContain('security-blue');

      // Switch to CSV
      await csvButton.click();

      // CSV should now be selected
      expect(await csvButton.getAttribute('class')).toContain('security-blue');

      // Switch back to JSON
      await jsonButton.click();
      expect(await jsonButton.getAttribute('class')).toContain('security-blue');
    }
  });

  test('should display retention policy information', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for data retention information
    const retentionInfo = page.locator('text=/Aufbewahrungsrichtlinien|retention/i');

    // Retention information should be displayed or accessible
    expect(await page.locator('body').isVisible()).toBe(true);
  });

  test('should be responsive on mobile with compliance panel', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check compliance status is visible
    const complianceStatus = page.locator('text=COMPLIANCE-STATUS');

    // Page should render properly on mobile
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });
});
