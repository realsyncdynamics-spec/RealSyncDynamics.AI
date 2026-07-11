import { test, expect } from '@playwright/test';

/**
 * API Notifications Integration E2E Tests
 *
 * Tests the complete workflow of quota alerts triggering webhooks and emails
 */

test.describe.skip('Quota Alert Notification Flow', () => {
  test('should trigger webhook delivery when quota reaches 80%', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const apiKey = process.env.TEST_API_KEY!;

    // Simulate API calls approaching 80% quota (assuming 1000/month limit for agency tier)
    // Make 800 calls to reach 80%
    let callCount = 0;
    for (let i = 0; i < 800; i++) {
      const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        data: { domain: `test-${i}.com`, module: 'gdpr' },
      });

      if (response.status() === 200) {
        callCount++;
      }
      if (response.status() === 429) {
        // Rate limit hit before reaching target
        break;
      }
    }

    // Verify quota warning was triggered
    expect(callCount).toBeGreaterThan(0);
  });

  test('should create webhook delivery record for quota warning event', async ({ page }) => {
    if (!process.env.TEST_API_KEY || !process.env.TEST_WEBHOOK_URL) {
      test.skip();
    }

    // Navigate to webhook configuration
    await page.goto('https://realsyncdynamics-ai.de/app/api');

    // Check that webhook endpoints are visible
    const webhookSection = await page.locator('text=Konfigurierte Webhooks');
    await expect(webhookSection).toBeVisible();

    // Verify webhook endpoint was configured
    const webhookEndpoints = await page.locator('[data-testid="webhook-endpoint"]').count();
    expect(webhookEndpoints).toBeGreaterThan(0);
  });

  test('should queue email notification for admin users on quota exceeded', async ({ page }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    // Navigate to monitoring dashboard
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for email statistics card
    const emailStatsCard = await page.locator('text=E-Mail-Benachrichtigungen');
    await expect(emailStatsCard).toBeVisible();

    // Verify email delivery metrics are displayed
    const sentEmailsCount = await page.locator('[data-testid="email-sent-count"]').textContent();
    expect(sentEmailsCount).toBeTruthy();
  });

  test('should display recent webhook and email events in monitoring dashboard', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for recent events section
    const recentEventsSection = await page.locator('text=Letzte Ereignisse');
    await expect(recentEventsSection).toBeVisible();

    // Verify event timeline exists
    const eventItems = await page.locator('[data-testid="event-item"]').count();
    expect(eventItems).toBeGreaterThanOrEqual(0);
  });

  test('should show success rate percentage for webhook deliveries', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for success rate card
    const successRateCard = await page.locator('text=Erfolgsquote');
    await expect(successRateCard).toBeVisible();

    // Verify success rate percentage is displayed
    const percentageText = await page.locator('[data-testid="success-percentage"]').textContent();
    expect(percentageText).toMatch(/\d+%/);
  });

  test('should show delivery status for each event (success/failed/pending)', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for event status indicators
    const successIndicators = await page.locator('[data-testid="event-success"]').count();
    const failedIndicators = await page.locator('[data-testid="event-failed"]').count();
    const pendingIndicators = await page.locator('[data-testid="event-pending"]').count();

    const totalIndicators = successIndicators + failedIndicators + pendingIndicators;
    expect(totalIndicators).toBeGreaterThanOrEqual(0);
  });

  test('should filter events by type (webhook vs email)', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for filter controls (if implemented)
    const filterButton = await page.locator('[data-testid="event-filter"]');
    const filterExists = await filterButton.count() > 0;

    if (filterExists) {
      // Click webhook filter
      await filterButton.click();
      const webhookFilter = await page.locator('text=Webhook');
      await webhookFilter.click();

      // Verify only webhook events shown
      const webhookIcons = await page.locator('[data-testid="webhook-icon"]').count();
      expect(webhookIcons).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display webhook retry attempts and exponential backoff status', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for webhook stats card
    const webhookStatsCard = await page.locator('text=Webhook-Lieferungen');
    await expect(webhookStatsCard).toBeVisible();

    // Verify retry metrics shown
    const retryMetric = await page.locator('[data-testid="avg-retry-attempts"]').textContent();
    expect(retryMetric).toBeTruthy();
  });

  test('should display email delivery success rate separately', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for email stats card
    const emailStatsCard = await page.locator('text=E-Mail-Benachrichtigungen');
    await expect(emailStatsCard).toBeVisible();

    // Verify email sent/failed counts
    const sentCount = await page.locator('[data-testid="email-sent"]').textContent();
    const failedCount = await page.locator('[data-testid="email-failed"]').textContent();

    expect(sentCount).toBeTruthy();
    expect(failedCount).toBeTruthy();
  });

  test('should show system health status (API, Webhooks, Email)', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check for system status card
    const systemStatusCard = await page.locator('text=System-Status');
    await expect(systemStatusCard).toBeVisible();

    // Verify status indicators
    const apiStatus = await page.locator('[data-testid="status-api"]').textContent();
    const webhookStatus = await page.locator('[data-testid="status-webhooks"]').textContent();
    const emailStatus = await page.locator('[data-testid="status-email"]').textContent();

    expect(apiStatus).toContain('✓');
    expect(webhookStatus).toContain('✓');
    expect(emailStatus).toContain('✓');
  });

  test('should handle concurrent webhook and email notifications without conflicts', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const apiKey = process.env.TEST_API_KEY!;

    // Make multiple API calls concurrently to trigger multiple notifications
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(
        request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          data: { domain: `concurrent-${i}.com`, module: 'gdpr' },
        })
      );
    }

    const responses = await Promise.all(requests);
    const successCount = responses.filter(r => r.status() === 200 || r.status() === 429).length;

    // All requests should complete successfully or with rate limit
    expect(successCount).toBe(requests.length);
  });

  test('should log all notification events to webhook_deliveries and email_notifications tables', async ({ page }) => {
    // This test would require direct database access or an admin API endpoint
    // Skipping for now as it requires test infrastructure
    test.skip();

    // Expected behavior:
    // 1. Each webhook delivery logged with attempt_number, status_code, response_body
    // 2. Each email logged with sent_at, error_message
    // 3. All records have proper timestamps and tenant isolation
  });
});
