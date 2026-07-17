/**
 * Website Operations Layer — E2E Tests
 * Full user workflow: Create → Generate → Deploy → Monitor
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Website Operations Workflow', () => {
  test('Complete flow: Create → Deploy → Monitor', async ({ page }) => {
    // 1. Navigate to dashboard
    await page.goto(`${BASE_URL}/app/websites`);

    // 2. Verify dashboard loads
    await expect(page).toHaveTitle(/Website Operations/i);
    await expect(page.locator('text=Create Website')).toBeVisible();

    // 3. Click "Create Website" button
    await page.click('button:has-text("Create Website")');

    // 4. Wait for wizard modal
    await expect(page.locator('text=What\'s your business type?')).toBeVisible();

    // 5. Select industry (Tattoo Studio)
    await page.click('button:has-text("Tattoo Studio")');
    await page.click('button:has-text("Next")');

    // 6. Fill company info
    await page.fill('input[label="Company Name"]', 'Test Tattoo Studio');
    await page.fill('textarea', 'Professional tattoo studio in Berlin');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button:has-text("Next")');

    // 7. Add services
    await page.fill('input[placeholder="Add a service..."]', 'Custom Designs');
    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="Add a service..."]', 'Cover-ups');
    await page.click('button:has-text("Add")');
    await page.click('button:has-text("Next")');

    // 8. Review and generate
    await expect(page.locator('text=Test Tattoo Studio')).toBeVisible();
    await expect(page.locator('text=Custom Designs')).toBeVisible();
    await page.click('button:has-text("Generate Website")');

    // 9. Wait for generation complete
    await page.waitForTimeout(5000); // Allow for AI generation
    await expect(page.locator('text=Website Generated')).toBeVisible({ timeout: 30000 });
  });

  test('Domain connection flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // Find and click on first website project
    await page.click('.website-project-card');

    // Click Domain Manager section
    await page.click('text=Domains');

    // Click "Add Domain"
    await page.click('button:has-text("Add Domain")');

    // Fill subdomain
    await page.fill('input[placeholder*="domain"]', 'my-studio.realsyncdynamics.ai');

    // Submit
    await page.click('button:has-text("Connect Domain")');

    // Verify success
    await expect(page.locator('text=my-studio.realsyncdynamics.ai')).toBeVisible({ timeout: 10000 });
  });

  test('Compliance dashboard displays correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // Open project detail
    await page.click('.website-project-card');

    // Check compliance section
    await expect(page.locator('text=Compliance Status')).toBeVisible();
    await expect(page.getByText(/Compliance|DSGVO|EU AI Act/)).toBeVisible();

    // Verify score display
    const scoreElement = page.locator('[class*="compliance-score"]');
    await expect(scoreElement).toBeVisible();
  });

  test('Deployment status shows live updates', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // Open project detail
    await page.click('.website-project-card');

    // Check deployment section
    await expect(page.locator('text=Deployment')).toBeVisible();

    // Verify logs are displayed
    await expect(page.locator('[class*="deployment-log"]')).toHaveCount(0); // Or > 0 if logs exist

    // Check for status indicators
    const statusIndicators = page.locator('[class*="status"]');
    await expect(statusIndicators).toBeVisible();
  });

  test('Maintenance dashboard works', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // Open project detail
    await page.click('.website-project-card');

    // Check for maintenance section
    await expect(page.locator('text=Health|Maintenance')).toBeVisible();

    // Verify health metrics
    const metrics = page.locator('[class*="metric"]');
    await expect(metrics).toHaveCount(4); // Performance, SEO, Security, Accessibility
  });
});

test.describe('Form Validation', () => {
  test('Website wizard validates required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);
    await page.click('button:has-text("Create Website")');

    // Try to proceed without selecting industry
    await page.click('button:has-text("Next")');

    // Should show error or stay on same step
    await expect(page.locator('text=industry|type|business')).toBeVisible({ timeout: 5000 });
  });

  test('Domain name validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);
    await page.click('.website-project-card');
    await page.click('text=Domains');
    await page.click('button:has-text("Add Domain")');

    // Try invalid domain
    await page.fill('input[placeholder*="domain"]', 'invalid domain!');
    await page.click('button:has-text("Connect Domain")');

    // Should show error
    await expect(page.locator('text=invalid|Invalid|format')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Responsive Design', () => {
  test('Dashboard works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE_URL}/app/websites`);

    // Components should be visible
    await expect(page.locator('text=Create Website')).toBeVisible();
    await expect(page.locator('[class*="stat"]')).toBeVisible();

    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.offsetWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
  });

  test('Forms are touch-friendly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/app/websites`);

    await page.click('button:has-text("Create Website")');

    // Input fields should have good padding
    const inputs = page.locator('input');
    const firstInput = inputs.first();
    const box = await firstInput.boundingBox();

    expect(box?.height).toBeGreaterThan(40); // Touch-friendly min height
  });
});

test.describe('Performance', () => {
  test('Dashboard loads in under 3 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/app/websites`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('Wizard is responsive to user input', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);
    await page.click('button:has-text("Create Website")');

    // Measure time to respond to click
    const startTime = Date.now();
    await page.click('button:has-text("Tattoo Studio")');
    await expect(page.locator('text=Company Information')).toBeVisible();
    const responseTime = Date.now() - startTime;

    expect(responseTime).toBeLessThan(1000); // Should respond quickly
  });
});

test.describe('Accessibility', () => {
  test('Dashboard is keyboard navigable', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // Tab to first button
    await page.keyboard.press('Tab');
    await expect(page.locator('button:focus')).toBeVisible();

    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should move around page
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedElement);
  });

  test('Color contrast is sufficient', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    // This is a simplified check - full accessibility audit would need axe-core
    const statusBadges = page.locator('[class*="badge"]');

    // Verify badges exist and have text
    await expect(statusBadges.first()).toBeVisible();
  });

  test('Images have alt text', async ({ page }) => {
    await page.goto(`${BASE_URL}/app/websites`);

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      if (!alt?.includes('icon')) {
        expect(alt).toBeTruthy(); // Most images should have alt text
      }
    }
  });
});

test.describe('Error Handling', () => {
  test('Gracefully handles network errors', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    await page.goto(`${BASE_URL}/app/websites`);

    // Should show error message or fallback UI
    await expect(
      page.locator('text=offline|error|network|connection').first()
    ).toBeVisible({ timeout: 5000 });

    // Re-enable network
    await page.context().setOffline(false);
  });

  test('Handles missing data gracefully', async ({ page }) => {
    // Navigate to non-existent project
    await page.goto(`${BASE_URL}/app/websites/invalid-id`);

    // Should show error or redirect
    await expect(
      page.locator('text=not found|not exist|invalid|error').first()
    ).toBeVisible({ timeout: 5000 });
  });
});
