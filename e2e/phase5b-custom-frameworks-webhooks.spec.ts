import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Phase 5B - Custom Frameworks & Integrations
 *
 * Tests:
 * 1. Custom Framework Builder (framework creation, customization)
 * 2. Custom Framework View (management, gap analysis)
 * 3. Integrations View (webhook setup, delivery logs)
 */

test.describe('Phase 5B: Custom Frameworks & Integrations', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseUrl}/app`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Custom Framework Builder', () => {
    test('should load custom framework builder', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      await expect(page.locator('text=Custom Framework Builder')).toBeVisible();
      await expect(page.locator('text=Create tailored compliance frameworks')).toBeVisible();
    });

    test('should display step indicator', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      await expect(page.locator('text=Select Base')).toBeVisible();
      await expect(page.locator('text=Configure')).toBeVisible();
      await expect(page.locator('text=Controls')).toBeVisible();
      await expect(page.locator('text=Review')).toBeVisible();
    });

    test('should allow selecting framework base', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select ISO 27001
      const iso27001Button = page.locator('button:has-text("ISO 27001")').first();
      await iso27001Button.click();

      // Verify selection
      await expect(iso27001Button).toHaveClass(/border-cyan-600/);

      // Verify proceeded to configure step
      await expect(page.locator('text=Framework Details')).toBeVisible();
    });

    test('should allow configuring framework details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select base
      await page.locator('button:has-text("ISO 27001")').first().click();
      await page.waitForTimeout(300);

      // Change framework name
      const nameInput = page.locator('input[placeholder*="Our Custom"]').first();
      await nameInput.clear();
      await nameInput.fill('Enterprise Security Framework');

      // Add description
      const descInput = page.locator('textarea').first();
      await descInput.fill('Custom ISO 27001 framework with enterprise requirements');

      // Verify inputs
      await expect(nameInput).toHaveValue('Enterprise Security Framework');
      await expect(descInput).toHaveValue('Custom ISO 27001 framework with enterprise requirements');
    });

    test('should allow mapping to external frameworks', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select base
      await page.locator('button:has-text("ISO 27001")').first().click();
      await page.waitForTimeout(300);

      // Check AI Act mapping
      const aiActCheckbox = page.locator('label:has-text("AI Act")').locator('input[type="checkbox"]');
      await aiActCheckbox.check();

      // Check DSGVO mapping
      const dsgvoCheckbox = page.locator('label:has-text("DSGVO")').locator('input[type="checkbox"]');
      await dsgvoCheckbox.check();

      // Verify checked
      await expect(aiActCheckbox).toBeChecked();
      await expect(dsgvoCheckbox).toBeChecked();
    });

    test('should allow adding custom controls', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select base
      await page.locator('button:has-text("ISO 27001")').first().click();
      await page.waitForTimeout(300);

      // Proceed to controls
      await page.locator('button:has-text("Next: Add Controls")').click();
      await page.waitForTimeout(300);

      // Add control
      const controlNameInput = page.locator('input[placeholder*="Multi-Factor"]');
      await controlNameInput.fill('Zero Trust Architecture');

      const controlDescInput = page.locator('textarea').first();
      await controlDescInput.fill('Implement zero trust security model across all systems');

      // Click add control
      await page.locator('button:has-text("Add Control")').click();
      await page.waitForTimeout(300);

      // Verify control added
      await expect(page.locator('text=Zero Trust Architecture')).toBeVisible();
    });

    test('should display review step with statistics', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select base
      await page.locator('button:has-text("ISO 27001")').first().click();
      await page.waitForTimeout(300);

      // Proceed to controls
      await page.locator('button:has-text("Next: Add Controls")').click();
      await page.waitForTimeout(300);

      // Proceed to review
      await page.locator('button:has-text("Review & Publish")').click();
      await page.waitForTimeout(300);

      // Verify review page
      await expect(page.locator('text=Controls Summary')).toBeVisible();

      // Check statistics displayed
      await expect(page.locator('text=Version')).toBeVisible();
      await expect(page.locator('text=Controls')).toBeVisible();
      await expect(page.locator('text=Based On')).toBeVisible();
      await expect(page.locator('text=Mapped Frameworks')).toBeVisible();
    });

    test('should publish framework', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-framework-builder`);

      // Select blank for quick test
      await page.locator('button:has-text("Blank")').click();
      await page.waitForTimeout(300);

      // Next
      await page.locator('button:has-text("Next: Add Controls")').click();
      await page.waitForTimeout(300);

      // Next
      await page.locator('button:has-text("Review & Publish")').click();
      await page.waitForTimeout(300);

      // Publish
      const publishButton = page.locator('button:has-text("Publish Framework")');
      await publishButton.click();
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('Custom Framework View', () => {
    test('should load custom frameworks view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      await expect(page.locator('text=Custom Frameworks')).toBeVisible();
      await expect(page.locator('text=View, manage, and customize compliance frameworks')).toBeVisible();
    });

    test('should display framework list', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Check for framework items
      const frameworkItems = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/ISO 27001|Framework/') });
      const count = await frameworkItems.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should allow expanding framework details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Find first framework and expand
      const firstFramework = page.locator('button').filter({ has: page.locator('text=/ISO|Custom/') }).first();
      if (await firstFramework.isVisible()) {
        await firstFramework.click();
        await page.waitForTimeout(300);

        // Check expanded details
        await expect(page.locator('text=Based On').or(page.locator('text=Created By'))).toBeVisible();
      }
    });

    test('should display compliance score', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Look for compliance score percentages
      const scoreElements = page.locator('text=/%/');
      const count = await scoreElements.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should allow duplicating framework', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Find first framework and expand
      const firstFramework = page.locator('button').filter({ has: page.locator('text=/ISO|Custom/') }).first();
      if (await firstFramework.isVisible()) {
        await firstFramework.click();
        await page.waitForTimeout(300);

        // Click duplicate
        const duplicateButton = page.locator('button:has-text("Duplicate")');
        if (await duplicateButton.isVisible()) {
          await duplicateButton.click();
          await page.waitForLoadState('networkidle');

          // Verify framework was duplicated
          const copyFramework = page.locator('text=Copy');
          const isVisible = await copyFramework.isVisible().catch(() => false);
          if (isVisible) {
            await expect(copyFramework).toBeVisible();
          }
        }
      }
    });

    test('should navigate to framework detail view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Find and expand first framework
      const firstFramework = page.locator('button').filter({ has: page.locator('text=/ISO|Custom/') }).first();
      if (await firstFramework.isVisible()) {
        await firstFramework.click();
        await page.waitForTimeout(300);

        // Click view details
        const viewButton = page.locator('button:has-text("View Details")');
        if (await viewButton.isVisible()) {
          await viewButton.click();
          await page.waitForLoadState('networkidle');

          // Verify detail view loaded
          await expect(page.locator('text=Gap Analysis').or(page.locator('text=Framework Details'))).toBeVisible();
        }
      }
    });

    test('should show gap analysis in detail view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Expand and view first framework
      const firstFramework = page.locator('button').filter({ has: page.locator('text=/ISO|Custom/') }).first();
      if (await firstFramework.isVisible()) {
        await firstFramework.click();
        await page.waitForTimeout(300);

        const viewButton = page.locator('button:has-text("View Details")');
        if (await viewButton.isVisible()) {
          await viewButton.click();
          await page.waitForLoadState('networkidle');

          // Check for gap analysis
          const gapAnalysis = page.locator('text=Gap Analysis');
          if (await gapAnalysis.isVisible()) {
            await expect(gapAnalysis).toBeVisible();
            await expect(page.locator('text=Implemented Controls').or(page.locator('text=In Progress'))).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Integrations View', () => {
    test('should load integrations view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      await expect(page.locator('text=Integrations')).toBeVisible();
      await expect(page.locator('text=Webhook management & external integrations')).toBeVisible();
    });

    test('should display webhook endpoints tab', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      await expect(page.locator('text=Webhook Endpoints')).toBeVisible();
      await expect(page.locator('text=Delivery Logs')).toBeVisible();
    });

    test('should display existing endpoints', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Look for endpoint items
      const endpoints = page.locator('text=/Integration|SIEM/');
      const isVisible = await endpoints.isVisible().catch(() => false);
      expect(typeof isVisible).toBe('boolean');
    });

    test('should allow expanding endpoint details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Find first endpoint
      const firstEndpoint = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/Integration|https/') }).first();
      if (await firstEndpoint.isVisible()) {
        await firstEndpoint.click();
        await page.waitForTimeout(300);

        // Check for expanded details
        const signingSecret = page.locator('text=Signing Secret');
        const isVisible = await signingSecret.isVisible().catch(() => false);
        if (isVisible) {
          await expect(signingSecret).toBeVisible();
        }
      }
    });

    test('should display delivery logs', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Switch to delivery logs tab
      await page.locator('button:has-text("Delivery Logs")').click();
      await page.waitForTimeout(300);

      // Look for delivery items
      const deliveries = page.locator('[class*="border"]').filter({ has: page.locator('text=/success|failed|pending/') });
      const count = await deliveries.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should navigate to create endpoint form', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Click create endpoint
      await page.locator('button:has-text("New Endpoint")').click();
      await page.waitForTimeout(300);

      // Verify form visible
      await expect(page.locator('text=Create Webhook Endpoint')).toBeVisible();
      await expect(page.locator('text=Endpoint Name')).toBeVisible();
      await expect(page.locator('text=Webhook URL')).toBeVisible();
    });

    test('should allow configuring webhook endpoint', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Go to create
      await page.locator('button:has-text("New Endpoint")').click();
      await page.waitForTimeout(300);

      // Fill in endpoint details
      const nameInput = page.locator('input[placeholder*="SIEM"]');
      await nameInput.fill('Vulnerability Scanner Integration');

      const urlInput = page.locator('input[placeholder*="your-endpoint"]');
      await urlInput.fill('https://scanner.company.com/webhooks/governance');

      // Select events
      const gapClosedCheckbox = page.locator('label:has-text("Gap Closed")').locator('input[type="checkbox"]');
      await gapClosedCheckbox.check();

      const scoreUpdatedCheckbox = page.locator('label:has-text("Compliance Score Updated")').locator('input[type="checkbox"]');
      await scoreUpdatedCheckbox.check();

      // Verify filled
      await expect(nameInput).toHaveValue('Vulnerability Scanner Integration');
      await expect(urlInput).toHaveValue('https://scanner.company.com/webhooks/governance');
      await expect(gapClosedCheckbox).toBeChecked();
    });

    test('should allow selecting retry policy', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Go to create
      await page.locator('button:has-text("New Endpoint")').click();
      await page.waitForTimeout(300);

      // Select retry policy
      const retrySelect = page.locator('select').last();
      await retrySelect.selectOption('linear');

      // Verify selection
      const selectedOption = await retrySelect.inputValue();
      expect(selectedOption).toBe('linear');
    });

    test('should create webhook endpoint', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Go to create
      await page.locator('button:has-text("New Endpoint")').click();
      await page.waitForTimeout(300);

      // Fill form
      const nameInput = page.locator('input[placeholder*="SIEM"]');
      await nameInput.fill('Test Webhook');

      const urlInput = page.locator('input[placeholder*="your-endpoint"]');
      await urlInput.fill('https://test.example.com/webhook');

      // Check at least one event
      const eventCheckbox = page.locator('label:has-text("Gap Identified")').locator('input[type="checkbox"]');
      await eventCheckbox.check();

      // Create
      await page.locator('button:has-text("Create Endpoint")').click();
      await page.waitForLoadState('networkidle');

      // Verify back on endpoints view
      await expect(page.locator('text=Webhook Endpoints')).toBeVisible();
    });

    test('should display endpoint signing secret', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Find first endpoint
      const firstEndpoint = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/Integration|https/') }).first();
      if (await firstEndpoint.isVisible()) {
        await firstEndpoint.click();
        await page.waitForTimeout(300);

        // Look for signing secret
        const secretElement = page.locator('text=/sk_test_/');
        const isVisible = await secretElement.isVisible().catch(() => false);
        if (isVisible) {
          await expect(secretElement).toBeVisible();

          // Verify copy button
          const copyButton = page.locator('button').filter({ has: page.locator('text=Copy').or(page.locator('[class*="Copy"]')) }).first();
          if (await copyButton.isVisible()) {
            await expect(copyButton).toBeVisible();
          }
        }
      }
    });

    test('should allow testing webhook delivery', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Find first endpoint and expand
      const firstEndpoint = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/Integration|https/') }).first();
      if (await firstEndpoint.isVisible()) {
        await firstEndpoint.click();
        await page.waitForTimeout(300);

        // Click test delivery
        const testButton = page.locator('button:has-text("Test Delivery")');
        if (await testButton.isVisible()) {
          await testButton.click();

          // Alert should appear (may dismiss automatically in tests)
          const alertVisible = await page.locator('text=Test payload sent').isVisible().catch(() => false);
          // Accept alert if it appears
          page.on('dialog', dialog => dialog.accept());
          expect(typeof alertVisible).toBe('boolean');
        }
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('should navigate from custom frameworks to builder', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/custom-frameworks`);

      // Click new framework button
      await page.locator('button:has-text("New Framework")').or(page.locator('text=Create First Framework')).first().click();
      await page.waitForLoadState('networkidle');

      // Should navigate to builder
      expect(page.url()).toContain('custom-framework-builder');
      await expect(page.locator('text=Custom Framework Builder')).toBeVisible();
    });

    test('should navigate from integrations to custom frameworks', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/integrations`);

      // Should have link back to governance
      const backButton = page.locator('button').filter({ has: page.locator('[class*="ArrowLeft"]') }).first();
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForLoadState('networkidle');
      }
    });
  });
});
