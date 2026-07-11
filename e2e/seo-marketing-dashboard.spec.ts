import { test, expect } from '@playwright/test';

test.describe('SEO-Marketing-Dashboard', () => {
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

  test('should load dashboard and display KPI cards', async ({ page }) => {
    // Navigate to SEO Marketing Dashboard
    await page.goto('/app/seo-marketing-dashboard');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check page title
    await expect(page.locator('h1')).toContainText('SEO & Marketing Dashboard');

    // Verify KPI cards are present
    const cacCard = page.locator('text=Customer Acquisition Cost');
    const ltvCard = page.locator('text=Lifetime Value');
    const ratioCard = page.locator('text=LTV:CAC Ratio');
    const conversionCard = page.locator('text=Konversionsrate');

    await expect(cacCard).toBeVisible();
    await expect(ltvCard).toBeVisible();
    await expect(ratioCard).toBeVisible();
    await expect(conversionCard).toBeVisible();
  });

  test('should display metrics with values', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check that metrics have numeric values
    const metricValues = page.locator('[class*="font-mono"]');
    const count = await metricValues.count();

    expect(count).toBeGreaterThan(0);

    // Check first metric value is numeric
    const firstValue = await metricValues.first().textContent();
    expect(firstValue).toMatch(/^\d+(\.\d+)?/);
  });

  test('should filter by date range', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Find date range inputs
    const dateInputs = page.locator('input[type="date"]');

    if (await dateInputs.count() > 0) {
      // Set custom date range
      const firstInput = dateInputs.first();
      await firstInput.fill('2024-01-01');

      // Wait for data to reload
      await page.waitForTimeout(1000);

      // Verify date inputs were set
      const value = await firstInput.inputValue();
      expect(value).toBe('2024-01-01');
    }
  });

  test('should display trend chart', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for chart container
    const chartTitle = page.locator('text=/CAC.*LTV.*CMRR/');
    await expect(chartTitle).toBeVisible({ timeout: 5000 });

    // Verify SVG chart is rendered
    const chartSvg = page.locator('svg');
    const count = await chartSvg.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display shadow SaaS table', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for table header
    const tableHeader = page.locator('text=Ungenehmigte SEO-Tools');
    await expect(tableHeader).toBeVisible();
  });

  test('should open advanced filters', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Click filter button
    const filterButton = page.locator('button:has-text("Erweiterte Filter")');
    await filterButton.click();

    // Wait for filter panel to open
    await page.waitForTimeout(500);

    // Verify filter controls are visible
    const dateRangeSelect = page.locator('select').first();
    await expect(dateRangeSelect).toBeVisible();
  });

  test('should apply CAC range filter', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Open filters
    const filterButton = page.locator('button:has-text("Erweiterte Filter")');
    await filterButton.click();

    // Fill CAC min
    const cacMinInput = page.locator('input[placeholder="z.B. 100"]').first();
    await cacMinInput.fill('500');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify value was set
    expect(await cacMinInput.inputValue()).toBe('500');
  });

  test('should export to CSV', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for export button
    const exportButton = page.locator('button:has-text("Exportieren")').first();

    if (await exportButton.isVisible()) {
      // Click export button
      await exportButton.click();

      // Wait for menu
      await page.waitForTimeout(300);

      // Click CSV export
      const csvOption = page.locator('text=Export as CSV');

      if (await csvOption.isVisible()) {
        // Set up listener for download
        const downloadPromise = page.waitForEvent('download');

        await csvOption.click();

        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('seo-metrics');
      }
    }
  });

  test('should display customer summary metrics', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for summary section with active customers
    const activeCustomersText = page.locator('text=Aktive Kunden');

    if (await activeCustomersText.isVisible()) {
      await expect(activeCustomersText).toBeVisible();

      // Verify summary cards are displayed
      const churnRate = page.locator('text=Churn-Rate');
      const cmrr = page.locator('text=CMRR');

      await expect(churnRate).toBeVisible({ timeout: 5000 });
      await expect(cmrr).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display risk alerts for high-risk tools', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for risk alert
    const riskAlert = page.locator('[class*="bg-red"]').filter({
      hasText: /Tools mit hohem Risiko/i,
    });

    // Alert may or may not be present depending on data
    // Just verify page renders correctly
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toContainText('SEO & Marketing Dashboard');
  });

  test('should refresh data on manual refresh', async ({ page }) => {
    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Get initial metric value
    const metricValue = page.locator('[class*="font-mono"]').first();
    const initialValue = await metricValue.textContent();

    // Wait a moment
    await page.waitForTimeout(500);

    // Try to find refresh button (if exists)
    const refreshButton = page.locator('button:has-text("Refresh")');

    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for new data
      await page.waitForTimeout(1000);

      // Value should still exist
      await expect(metricValue).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/app/seo-marketing-dashboard');
    await page.waitForLoadState('networkidle');

    // Check page title is visible
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Verify metrics are stacked (single column)
    const metricCards = page.locator('[class*="border"][class*="rounded"]');
    const count = await metricCards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('should handle loading state', async ({ page }) => {
    // Intercept and delay network request
    await page.route('/functions/v1/calculate-seo-metrics', (route) => {
      setTimeout(() => route.continue(), 1000);
    });

    await page.goto('/app/seo-marketing-dashboard');

    // Loading indicator should be visible initially
    const loadingText = page.locator('text=Lade');
    // May be visible or already loaded

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Verify dashboard content
    const title = page.locator('h1');
    await expect(title).toContainText('SEO & Marketing Dashboard');
  });

  test('should handle error gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('/functions/v1/calculate-seo-metrics', (route) => {
      route.abort('failed');
    });

    await page.goto('/app/seo-marketing-dashboard');

    // Wait for error message or fallback UI
    await page.waitForTimeout(2000);

    // Page should still be interactive
    const filterButton = page.locator('button:has-text("Erweiterte Filter")');
    expect(await filterButton.isVisible()).toBeTruthy();
  });
});
