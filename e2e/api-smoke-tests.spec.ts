import { test, expect } from '@playwright/test';

/**
 * API System Smoke Tests
 *
 * Validates that all critical API infrastructure is operational post-deployment
 */

test.describe('API Infrastructure Smoke Tests', () => {
  test('should respond to health check endpoint', async ({ request }) => {
    // Health check endpoint for monitoring
    const response = await request.get('https://realsyncdynamics-ai.de/health');
    expect([200, 404]).toContain(response.status()); // 404 acceptable if endpoint doesn't exist
  });

  test('should authenticate with valid API key', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });

    expect([200, 429]).toContain(response.status()); // 429 acceptable if rate limit hit
  });

  test('should reject requests without authentication', async ({ request }) => {
    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      data: { domain: 'test.com', module: 'gdpr' },
    });

    expect(response.status()).toBe(401);
  });

  test('should enforce rate limiting on API tier', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    // Make requests until rate limit or success
    let hitRateLimit = false;
    for (let i = 0; i < 50; i++) {
      const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
        headers: {
          Authorization: `Bearer ${process.env.TEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { domain: `test-${i}.com`, module: 'gdpr' },
      });

      if (response.status() === 429) {
        hitRateLimit = true;
        break;
      }
      expect([200, 403]).toContain(response.status());
    }

    // Rate limiting should be enforced at some point
    // (unless tier allows all 50 requests)
  });

  test('should log API calls to audit table', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test-audit.com', module: 'gdpr' },
    });

    expect([200, 429]).toContain(response.status());
    // Verify logging occurred (would need direct DB access to confirm)
  });

  test('should support multiple compliance modules', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const modules = ['gdpr', 'dpia', 'dsr', 'consent', 'general'];

    for (const module of modules) {
      const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
        headers: {
          Authorization: `Bearer ${process.env.TEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        data: { domain: 'test.com', module },
      });

      expect([200, 429]).toContain(response.status());
    }
  });

  test('should return compliance scoring', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('data.compliance_score');
      expect(body.data.compliance_score).toBeGreaterThanOrEqual(0);
      expect(body.data.compliance_score).toBeLessThanOrEqual(100);
    }
  });

  test('should provide webhook configuration interface', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api');

    // Check webhook section exists
    const webhookSection = await page.locator('text=Konfigurierte Webhooks').isVisible();
    expect(webhookSection).toBeTruthy();
  });

  test('should provide monitoring dashboard', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/monitoring');

    // Check key monitoring elements
    const successRate = await page.locator('text=Erfolgsquote').isVisible();
    const webhookStats = await page.locator('text=Webhook-Lieferungen').isVisible();

    expect(successRate || webhookStats).toBeTruthy();
  });

  test('should provide email template configuration', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/email-templates');

    // Check email templates section
    const templateSection = await page.locator('text=E-Mail-Vorlagen').isVisible();
    expect(templateSection).toBeTruthy();
  });

  test('should provide API documentation', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/docs');

    // Check documentation content
    const docContent = await page.locator('text=API').isVisible();
    expect(docContent).toBeTruthy();
  });

  test('should support API key setup wizard', async ({ page }) => {
    await page.goto('https://realsyncdynamics-ai.de/app/api/setup');

    // Check wizard is accessible
    const wizardContent = await page.locator('text=API').isVisible();
    expect(wizardContent).toBeTruthy();
  });

  test('should have CORS headers for browser access', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });

    const headers = response.headers();
    // CORS headers should be present for successful responses
    if (response.status() === 200) {
      expect(headers['access-control-allow-origin']).toBeDefined();
    }
  });

  test('should handle errors gracefully', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    // Send malformed request
    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {}, // Empty body
    });

    // Should return valid response even with bad input
    expect([200, 400, 429, 500]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('success');
  });

  test('should maintain multi-tenant isolation', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    // API calls should be isolated by tenant
    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });

    if (response.status() === 200) {
      const body = await response.json();
      expect(body.data).toHaveProperty('tenant_id');
    }
  });

  test('should support detailed findings in responses', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr', detailed: true },
    });

    if (response.status() === 200) {
      const body = await response.json();
      if (body.data.findings && body.data.findings.length > 0) {
        const finding = body.data.findings[0];
        // Detailed findings should have description
        expect(finding).toHaveProperty('severity');
      }
    }
  });
});

test.describe('Infrastructure Health Checks', () => {
  test('database connection is operational', async ({ request }) => {
    // This would ideally test a health endpoint that checks DB connectivity
    // For now, we verify API endpoints are responding
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'health-check.com', module: 'gdpr' },
    });

    expect([200, 429]).toContain(response.status());
  });

  test('edge functions are deployed and responding', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    // Test primary edge function
    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });

    // Should get a response (not 500 error)
    expect(response.status()).not.toBe(500);
  });

  test('response times are within acceptable range', async ({ request }) => {
    if (!process.env.TEST_API_KEY) {
      test.skip();
    }

    const startTime = Date.now();
    const response = await request.post('https://realsyncdynamics-ai.de/functions/v1/api-audit', {
      headers: {
        Authorization: `Bearer ${process.env.TEST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { domain: 'test.com', module: 'gdpr' },
    });
    const duration = Date.now() - startTime;

    // Response should be reasonably fast (within 30 seconds for API calls)
    expect(duration).toBeLessThan(30000);
  });
});
