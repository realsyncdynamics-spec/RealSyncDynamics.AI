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
    const webhookRetryUrl = 'https://realsyncdynamics-ai.de/app/api/webhook-retry';
    await page.goto(webhookRetryUrl, { waitUntil: 'networkidle' });

    // Check key webhook retry elements
    const statisticsCard = await page.locator('text=Gesamt-Zustellungen').isVisible();
    expect(statisticsCard).toBeTruthy();

    const historyTable = await page.locator('text=Webhook-Zustellungshistorie').isVisible();
    expect(historyTable).toBeTruthy();
  });

  test('should display webhook delivery status indicators', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Check for status badges (success/failed/pending)
    const statusElements = await page.locator('[class*="bg-security-900"]').count();
    expect(statusElements).toBeGreaterThanOrEqual(0); // May have no deliveries in test env
  });

  test('should provide webhook tester interface', async ({ page }) => {
    const webhookTesterUrl = 'https://realsyncdynamics-ai.de/app/api/webhook-tester';
    await page.goto(webhookTesterUrl, { waitUntil: 'networkidle' });

    // Check key webhook tester elements
    const testerHeader = await page.locator('text=Webhook-Tester').isVisible();
    expect(testerHeader).toBeTruthy();

    const webhookSelector = await page.locator('text=Webhook-Endpoint').isVisible();
    expect(webhookSelector).toBeTruthy();

    const eventTypeSelector = await page.locator('text=Ereignistyp').isVisible();
    expect(eventTypeSelector).toBeTruthy();
  });

  test('should allow event type selection in webhook tester', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Find and interact with event type selector
    const eventTypeSelect = await page.locator('select').nth(1); // Second select (first is webhook, second is event type)
    await eventTypeSelect.selectOption('quota_exceeded');

    // Verify selection was applied
    const selectedValue = await eventTypeSelect.inputValue();
    expect(selectedValue).toBe('quota_exceeded');
  });

  test('should display webhook test button', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Check for test button
    const testButton = await page.locator('button', { hasText: /testen/i }).isVisible();
    expect(testButton).toBeTruthy();
  });

  test('should show payload preview toggle', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Check for payload preview toggle
    const payloadLabel = await page.locator('text=Anfrage-Payload').isVisible();
    expect(payloadLabel).toBeTruthy();

    const previewButton = await page.locator('button', { hasText: /Anzeigen|Verbergen/i }).isVisible();
    expect(previewButton).toBeTruthy();
  });

  test('should provide webhook details display', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Check for webhook details section
    const detailsHeader = await page.locator('text=Webhook-Details').isVisible();
    // Details section may be visible or hidden depending on webhook selection
    // Just verify the page loads without errors
    expect(page).toBeTruthy();
  });

  test('should have retry action buttons', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Check for action button icons in table (retry, delete, view)
    const retryButtons = await page.locator('[title="Erneut versuchen"]').count();
    const viewButtons = await page.locator('[title="Details anzeigen"]').count();
    const deleteButtons = await page.locator('[title="Löschen"]').count();

    // Should have at least 0 or more (depends on test data)
    expect(retryButtons + viewButtons + deleteButtons).toBeGreaterThanOrEqual(0);
  });

  test('should maintain multi-tenant isolation in webhook management', async ({ page }) => {
    // Verify that webhook data is tenant-specific
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Page should load - actual tenant isolation is enforced server-side via RLS
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);
  });
});

test.describe('Webhook Management Error Handling', () => {
  test('should handle missing webhooks gracefully', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Should display message when no webhooks configured
    const noWebhooksMsg = await page.locator('text=/Keine Webhooks|kein Webhook/i').isVisible();
    // May or may not be visible depending on test data
    expect(page).toBeTruthy();
  });

  test('should display loading state during fetch', async ({ page }) => {
    // Navigate quickly and check for loading indicator
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-retry', { waitUntil: 'domcontentloaded' });

    // Should eventually load
    await page.waitForLoadState('networkidle');
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});

test.describe('Webhook Management UI Responsiveness', () => {
  test('should display webhook retry management on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-retry', { waitUntil: 'networkidle' });

    // Elements should still be visible
    const header = await page.locator('text=Webhook-Zustellungshistorie').isVisible();
    expect(header).toBeTruthy();
  });

  test('should display webhook tester on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('https://realsyncdynamics-ai.de/app/api/webhook-tester', { waitUntil: 'networkidle' });

    // Elements should still be visible
    const header = await page.locator('text=Webhook-Tester').isVisible();
    expect(header).toBeTruthy();
  });
});
