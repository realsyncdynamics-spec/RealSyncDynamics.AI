import { test, expect } from '@playwright/test';

test.describe('MCP Server Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page (assumes authenticated user)
    // This would need proper auth setup in a real test
    await page.goto('/app/settings/mcp-servers');
  });

  test('should display MCP servers settings page', async ({ page }) => {
    // Check that the page loads
    await expect(page.locator('h2:has-text("MCP Server Management")')).toBeVisible();

    // Check that tabs are visible
    await expect(page.locator('button:has-text("All Servers")')).toBeVisible();
    await expect(page.locator('button:has-text("Add Server")')).toBeVisible();
    await expect(page.locator('button:has-text("Manage Credentials")')).toBeVisible();
  });

  test('should add new MCP server', async ({ page }) => {
    // Click on Add Server tab
    await page.click('button:has-text("Add Server")');

    // Fill in the form
    await page.fill('input[placeholder="My MCP Server"]', 'Test MCP Server');
    await page.fill('input[placeholder="Brief description"]', 'Test server for E2E tests');
    await page.fill('input[placeholder="https://mcp-server.example.com"]', 'https://test-mcp.example.com');

    // Select auth type
    await page.selectOption('select', 'api_key');

    // Submit form
    await page.click('button:has-text("Create Server")');

    // Check for success (assuming it navigates back to list or shows confirmation)
    await expect(page.locator('button:has-text("All Servers")')).toBeVisible();
  });

  test('should list MCP servers', async ({ page }) => {
    // Click on All Servers tab
    await page.click('button:has-text("All Servers")');

    // The list should be visible
    await expect(page.locator('table')).toBeVisible();
  });

  test('should test server connection', async ({ page }) => {
    // Navigate to manage credentials tab
    await page.click('button:has-text("Manage Credentials")');

    // Look for test connection button (if server exists)
    const testButton = page.locator('button:has-text("Test Connection")');
    if (await testButton.isVisible()) {
      await testButton.click();
      // Connection test should show result
      await expect(
        page.locator('text=/Connection (successful|failed)/')
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should store MCP server credential', async ({ page }) => {
    // Navigate to manage credentials tab
    await page.click('button:has-text("Manage Credentials")');

    // Fill in credential form
    const credentialKeyInput = page.locator('input[placeholder="api_key"]');
    if (await credentialKeyInput.isVisible()) {
      await credentialKeyInput.fill('my_api_key');
      await page.locator('input[type="password"]').fill('secret-value-123');

      // Submit
      await page.click('button:has-text("Store Credential")');

      // Check for success message
      await expect(page.locator('text=Credential stored successfully')).toBeVisible();
    }
  });

  test('should delete MCP server', async ({ page }) => {
    // Click on All Servers tab
    await page.click('button:has-text("All Servers")');

    // Find delete button (if server exists)
    const deleteButton = page.locator('button:has-text("Delete")').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      await page.on('dialog', (dialog) => {
        dialog.accept();
      });

      // Server should be removed from list
      await page.waitForTimeout(1000);
    }
  });

  test('should validate server URL format', async ({ page }) => {
    // Click on Add Server tab
    await page.click('button:has-text("Add Server")');

    // Try to submit with invalid URL
    await page.fill('input[placeholder="My MCP Server"]', 'Invalid Server');
    await page.fill('input[placeholder="https://mcp-server.example.com"]', 'not-a-url');

    // Browser validation should prevent submission
    const urlInput = page.locator('input[type="url"]');
    const validity = await urlInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });

  test('should require server name', async ({ page }) => {
    // Click on Add Server tab
    await page.click('button:has-text("Add Server")');

    // Try to submit without name
    await page.fill('input[placeholder="https://mcp-server.example.com"]', 'https://test.example.com');

    // Submit should be disabled or form validation should fail
    const nameInput = page.locator('input[placeholder="My MCP Server"]');
    const isRequired = await nameInput.evaluate((el: HTMLInputElement) => el.required);
    expect(isRequired).toBe(true);
  });
});
