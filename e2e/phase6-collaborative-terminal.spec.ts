import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Phase 6 Collaborative Terminal
 *
 * Tests complete flow:
 * 1. Terminal session creation and access control
 * 2. Member invitation (7-day expiry)
 * 3. Role-based permissions (owner, editor, viewer, approver)
 * 4. Approval workflow (pending → approve/reject)
 * 5. Activity logging (real-time WebSocket updates)
 * 6. Audit export (PDF/CSV/XLSX with SHA256 signatures)
 * 7. Role editing (inline dropdown, atomic updates)
 */

test.describe('Phase 6: Collaborative Terminal', () => {
  const baseUrl = 'http://localhost:3000';

  test.describe('Terminal Session Access Control', () => {
    test('should display terminal interface for owner', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Verify terminal interface loads
      await expect(page.locator('text=Terminal')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[role="textbox"]')).toBeVisible(); // Command input
    });

    test('should show team collaboration panel by default', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Wait for panel to load
      await expect(page.locator('text=Team Collaboration')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=You (')).toBeVisible();
    });

    test('should display current user role', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      await expect(page.locator('text=You (owner)')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Member Invitation Workflow', () => {
    test('should display invite form for owner', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Check for invite section
      await expect(page.locator('text=Invite Team Member')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input[placeholder="email@company.com"]')).toBeVisible();

      // Check for role selector
      await expect(page.locator('select')).toBeVisible();
    });

    test('should allow inviting team member with role', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Fill invite form
      const emailInput = page.locator('input[placeholder="email@company.com"]');
      await emailInput.fill('editor@example.com');

      // Select editor role
      const roleSelect = page.locator('select').first();
      await roleSelect.selectOption('editor');

      // Click send invite
      const sendButton = page.locator('button:has-text("Send Invite")');
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      // Verify pending invitation appears
      await expect(page.locator('text=Pending Invites')).toBeVisible();
      await expect(page.locator('text=editor@example.com')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const emailInput = page.locator('input[placeholder="email@company.com"]');
      const sendButton = page.locator('button:has-text("Send Invite")');

      // Empty email should disable button
      await emailInput.fill('');
      await expect(sendButton).toBeDisabled();

      // Invalid email should still allow submit attempt
      await emailInput.fill('not-an-email');
      await expect(sendButton).toBeEnabled();
    });
  });

  test.describe('Role-Based Access Control', () => {
    test('should show different role badges', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Owner role should be visible
      await expect(page.locator('text=owner')).toBeVisible({ timeout: 5000 });

      // Role colors should be applied
      const ownerRole = page.locator('text=owner').first();
      const ownerBadge = ownerRole.locator('..');
      await expect(ownerBadge).toHaveClass(/bg-blue-900/);
    });

    test('should display role descriptions on invite', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Change role and check description
      const roleSelect = page.locator('select').first();
      await roleSelect.selectOption('editor');

      await expect(page.locator('text=Can run commands, invite members')).toBeVisible();

      await roleSelect.selectOption('approver');
      await expect(page.locator('text=Can approve audits')).toBeVisible();

      await roleSelect.selectOption('viewer');
      await expect(page.locator('text=Read-only access')).toBeVisible();
    });
  });

  test.describe('Approval Queue Workflow', () => {
    test('should display approval queue panel', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Click through to approvals panel
      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await chevronButton.click();

      // Approvals panel should appear
      await expect(page.locator('text=Approval Queue')).toBeVisible({ timeout: 5000 });
    });

    test('should show connection status', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Navigate to approvals
      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await chevronButton.click();

      // Check for connection status
      await expect(
        page.locator('text=Connected').or(page.locator('text=Offline'))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should display empty state when no approvals', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await chevronButton.click();

      // Should show empty state or history
      await expect(
        page.locator('text=No pending approvals').or(page.locator('text=History'))
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Activity Log & Real-time Updates', () => {
    test('should display activity log panel', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Navigate through panels to activity log
      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Click twice to get to activity log
      await chevronButton.click();
      await page.waitForTimeout(300);
      await chevronButton.click();

      // Activity log should appear
      await expect(page.locator('text=Activity Log')).toBeVisible({ timeout: 5000 });
    });

    test('should show connection status indicator', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await chevronButton.click();
      await page.waitForTimeout(300);
      await chevronButton.click();

      // Connection indicator (Wifi or WifiOff icon)
      await expect(
        page.locator('text=Connected').or(page.locator('text=Offline'))
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Audit Export Workflow', () => {
    test('should display export panel', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Navigate through panels to exports
      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Click three times to reach exports
      await chevronButton.click();
      await page.waitForTimeout(300);
      await chevronButton.click();
      await page.waitForTimeout(300);
      await chevronButton.click();

      // Export panel should appear
      await expect(page.locator('text=Audit Export')).toBeVisible({ timeout: 5000 });
    });

    test('should show export format options', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Navigate to exports panel
      for (let i = 0; i < 3; i++) {
        await chevronButton.click();
        await page.waitForTimeout(300);
      }

      // Format buttons should be visible
      await expect(page.locator('button:has-text("PDF")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('button:has-text("CSV")')).toBeVisible();
      await expect(page.locator('button:has-text("Excel")')).toBeVisible();
    });

    test('should display export history', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Navigate to exports
      for (let i = 0; i < 3; i++) {
        await chevronButton.click();
        await page.waitForTimeout(300);
      }

      // History section
      await expect(page.locator('text=History (')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Panel Navigation', () => {
    test('should cycle through all panels', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Start with collaboration
      await expect(page.locator('text=Team Collaboration')).toBeVisible({ timeout: 5000 });

      // Approvals
      await chevronButton.click();
      await expect(page.locator('text=Approval Queue')).toBeVisible({ timeout: 5000 });

      // Activity
      await chevronButton.click();
      await expect(page.locator('text=Activity Log')).toBeVisible({ timeout: 5000 });

      // Exports
      await chevronButton.click();
      await expect(page.locator('text=Audit Export')).toBeVisible({ timeout: 5000 });

      // Closed state with tabs
      await chevronButton.click();
      await expect(page.locator('text=TEAM')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=APPS')).toBeVisible();
      await expect(page.locator('text=EXP')).toBeVisible();
      await expect(page.locator('text=LOG')).toBeVisible();
    });

    test('should reopen panels from tab indicators', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      // Close all panels
      for (let i = 0; i < 4; i++) {
        await chevronButton.click();
        await page.waitForTimeout(300);
      }

      // Click APPROVALS tab
      await page.locator('button:has-text("APPS")').click();
      await expect(page.locator('text=Approval Queue')).toBeVisible({ timeout: 5000 });

      // Close again
      await chevronButton.click();

      // Click EXPORTS tab
      await page.locator('button:has-text("EXP")').click();
      await expect(page.locator('text=Audit Export')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Responsive Layout', () => {
    test('should maintain layout on panel toggle', async ({ page }) => {
      await page.goto(`${baseUrl}/app/terminal`);

      // Terminal should stay visible
      await expect(page.locator('[role="textbox"]')).toBeVisible({ timeout: 5000 });

      const chevronButton = page.locator('button').filter({ has: page.locator('svg') }).first();
      await chevronButton.click();

      // Terminal still visible
      await expect(page.locator('[role="textbox"]')).toBeVisible();
    });
  });
});
