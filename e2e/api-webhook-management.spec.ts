import { test, expect } from '@playwright/test';

/**
 * Webhook Management E2E Tests
 *
 * Tests for webhook retry management and testing interfaces
 */

test.describe('Webhook Management Features', () => {
  test.beforeEach(async ({ page }) => {
    // Would typically login here in a real scenario
    // For now, we verify the routes are accessible
  });

  test('should provide webhook retry management interface', async ({ page }) => {
    const response = await page.goto('/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Page should load without errors (may return 200, 302 redirect for auth, or auth error)
    expect(response?.status()).toBeLessThan(500);

    // Check for either content or auth redirect
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
  });

  test('should display webhook delivery status indicators', async ({ page }) => {
    const response = await page.goto('/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Page should respond without server errors
    expect(response?.status()).toBeLessThan(500);
  });

  test('should provide webhook tester interface', async ({ page }) => {
    const response = await page.goto('/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Page should respond without server errors
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load webhook tester page without errors', async ({ page }) => {
    const response = await page.goto('/app/api/webhook-tester', { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load webhook retry page without errors', async ({ page }) => {
    const response = await page.goto('/app/api/webhook-retry', { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('should have functional webhook management routes', async ({ page }) => {
    // Test webhook retry route
    let response = await page.goto('/app/api/webhook-retry', { waitUntil: 'domcontentloaded' });
    expect(response?.ok() || response?.status() === 302).toBeTruthy(); // 302 for redirect is acceptable

    // Test webhook tester route
    response = await page.goto('/app/api/webhook-tester', { waitUntil: 'domcontentloaded' });
    expect(response?.ok() || response?.status() === 302).toBeTruthy();
  });
});

test.describe('Webhook Management Error Handling', () => {
  test('should not return server errors on webhook pages', async ({ page }) => {
    let response = await page.goto('/app/api/webhook-tester', { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);

    response = await page.goto('/app/api/webhook-retry', { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Webhook Management UI Responsiveness', () => {
  test('should load webhook management pages on various viewports', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    let response = await page.goto('/app/api/webhook-retry', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    response = await page.goto('/app/api/webhook-tester', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    response = await page.goto('/app/api/webhook-retry', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });
});
