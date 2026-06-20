import { test, expect } from '@playwright/test';

/**
 * Demo Auth E2E Tests — Mock authentication flow
 *
 * Tests the complete login → dashboard → logout cycle
 * Uses hardcoded credentials: test@example.com / password123
 */

test.describe('Demo Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('Login Flow: Should login with demo credentials and navigate to dashboard', async ({
    page,
  }) => {
    // Navigate to login page
    await page.goto('/demo-login');

    // Verify login page is loaded
    await expect(page.locator('text=Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Verify demo credentials are pre-filled
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    const emailValue = await emailInput.inputValue();
    const passwordValue = await passwordInput.inputValue();

    expect(emailValue).toBe('test@example.com');
    expect(passwordValue).toBe('password123');

    // Click login button
    await page.locator('button:has-text("Login")').click();

    // Wait for navigation to dashboard
    await page.waitForURL('/demo-app');

    // Verify dashboard is loaded
    await expect(page.locator('text=Governance Dashboard')).toBeVisible();
    await expect(page.locator('text=Welcome, test@example.com')).toBeVisible();
  });

  test('Dashboard Load: Should display all widgets with correct data', async ({ page }) => {
    // Login first
    await page.goto('/demo-login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL('/demo-app');

    // Verify Risk Score widget
    await expect(page.locator('text=Governance Score')).toBeVisible();
    await expect(page.locator('text=87')).toBeVisible();
    await expect(page.locator('text=/100/')).toBeVisible();

    // Verify Evidence Counter widget
    await expect(page.locator('text=Evidence Count')).toBeVisible();
    // The counter should show 1248 (animated)
    await expect(page.locator('text=1248').first()).toBeVisible({ timeout: 5000 });

    // Verify DSGVO Status
    await expect(page.locator('text=DSGVO Status')).toBeVisible();
    await expect(page.locator('text=Compliant')).toBeVisible();

    // Verify AI Act Status
    await expect(page.locator('text=AI Act Status')).toBeVisible();
    await expect(page.locator('text=Ready')).toBeVisible();

    // Verify Monitoring Status section
    await expect(page.locator('text=Monitoring Status')).toBeVisible();
    await expect(page.locator('text=System Monitoring')).toBeVisible();
    await expect(page.locator('text=Evidence Sync')).toBeVisible();
    await expect(page.locator('text=Compliance Alerts')).toBeVisible();

    // Verify Evidence List
    await expect(page.locator('text=Recent Evidence')).toBeVisible();
    await expect(page.locator('text=GDPR Compliance Audit')).toBeVisible();
    await expect(page.locator('text=AI Act Risk Assessment')).toBeVisible();
  });

  test('Evidence List: Should display pagination controls', async ({ page }) => {
    // Login
    await page.goto('/demo-login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL('/demo-app');

    // Check pagination info
    await expect(page.locator('text=Showing 1-5 of 1248')).toBeVisible();

    // Previous button should be disabled
    const prevButton = page.locator('button:has-text("Previous")');
    await expect(prevButton).toBeDisabled();

    // Next button should be enabled
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
  });

  test('Logout Flow: Should logout and redirect to login page', async ({ page }) => {
    // Login first
    await page.goto('/demo-login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL('/demo-app');

    // Verify we're on dashboard
    await expect(page.locator('text=Governance Dashboard')).toBeVisible();

    // Click logout button
    await page.locator('button:has-text("Logout")').click();

    // Wait for navigation to login page
    await page.waitForURL('/demo-login');

    // Verify we're back on login page
    await expect(page.locator('text=Login')).toBeVisible();
    await expect(page.locator('text=RealSyncDynamics')).toBeVisible();
  });

  test('Session Persistence: Should persist login across page reload', async ({ page }) => {
    // Login
    await page.goto('/demo-login');
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button:has-text("Login")').click();
    await page.waitForURL('/demo-app');

    // Verify dashboard is loaded
    await expect(page.locator('text=Governance Dashboard')).toBeVisible();

    // Reload page
    await page.reload();

    // Should still be on dashboard (session persisted in localStorage)
    await expect(page.locator('text=Governance Dashboard')).toBeVisible();
    await expect(page.locator('text=Welcome, test@example.com')).toBeVisible();
  });

  test('Protected Route: Should redirect to login if accessing /demo-app without auth', async ({
    page,
  }) => {
    // Try to access protected route without logging in
    await page.goto('/demo-app');

    // Should redirect to login
    await page.waitForURL('/demo-login');

    // Verify we're on login page
    await expect(page.locator('text=Login')).toBeVisible();
  });

  test('Landing Page: Should have working CTA buttons to login', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/demo-landing');

    // Verify landing page content
    await expect(page.locator('text=AI Governance Reimagined')).toBeVisible();
    await expect(page.locator('text=Compliance Ready')).toBeVisible();

    // Find and click "Kostenlos starten" button
    const cta = page.locator('button:has-text("Kostenlos starten")').first();
    await expect(cta).toBeVisible();

    // Click CTA
    await cta.click();

    // Should navigate to login
    await page.waitForURL('/demo-login');
    await expect(page.locator('text=Login')).toBeVisible();
  });

  test('Login Error Handling: Should show error on invalid credentials', async ({ page }) => {
    // Navigate to login
    await page.goto('/demo-login');

    // Fill with wrong credentials
    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');

    // Click login
    await page.locator('button:has-text("Login")').click();

    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();

    // Should still be on login page
    await expect(page.url()).toContain('/demo-login');
  });
});
