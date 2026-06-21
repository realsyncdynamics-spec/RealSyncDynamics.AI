import { test, expect } from '@playwright/test';

/**
 * Demo Auth E2E Tests — Supabase authentication flow
 *
 * Tests the complete login → dashboard → logout cycle
 * Uses test credentials from environment variables:
 *   E2E_TEST_EMAIL - test account email
 *   E2E_TEST_PASSWORD - test account password
 *
 * Requirements:
 *   - Test account must exist in Supabase project
 *   - Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD before running tests
 */

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password123';

async function loginWithCredentials(page: any, email: string, password: string) {
  await page.goto('/demo-login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("Login")').click();
  await page.waitForURL('/demo-app');
}

test.describe('Demo Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage and cookies before each test
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('Login Flow: Should login with test credentials and navigate to dashboard', async ({
    page,
  }) => {
    // Navigate to login page
    await page.goto('/demo-login');

    // Verify login page is loaded
    await expect(page.locator('text=Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Fill in credentials
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    // Click login button
    await page.locator('button:has-text("Login")').click();

    // Wait for navigation to dashboard
    await page.waitForURL('/demo-app');

    // Verify dashboard is loaded
    await expect(page.locator('text=Governance Dashboard')).toBeVisible();
    await expect(page.locator(`text=Welcome, ${TEST_EMAIL}`)).toBeVisible();
  });

  test('Dashboard Load: Should display all widgets and sections', async ({ page }) => {
    // Login first
    await loginWithCredentials(page, TEST_EMAIL, TEST_PASSWORD);

    // Verify all dashboard sections load
    // Top metrics section
    await expect(page.locator('text=Governance Score')).toBeVisible();
    await expect(page.locator('text=/\d+\/100/')).toBeVisible(); // Flexible score match

    // Evidence counter
    await expect(page.locator('text=Evidence Count')).toBeVisible();
    await page.waitForTimeout(2500); // Wait for animation

    // Status cards
    await expect(page.locator('text=DSGVO Status')).toBeVisible();
    await expect(page.locator('text=AI Act Status')).toBeVisible();

    // Monitoring section
    await expect(page.locator('text=Monitoring Status')).toBeVisible();
    await expect(page.locator('text=System Monitoring')).toBeVisible();
    await expect(page.locator('text=Evidence Sync')).toBeVisible();
    await expect(page.locator('text=Compliance Alerts')).toBeVisible();

    // Evidence list section
    await expect(page.locator('text=Recent Evidence')).toBeVisible();
  });

  test('Evidence List: Should display pagination controls', async ({ page }) => {
    // Login
    await loginWithCredentials(page, TEST_EMAIL, TEST_PASSWORD);

    // Check pagination info exists (flexible count match for real data)
    await expect(page.locator('text=/Showing \\d+-\\d+ of \\d+/')).toBeVisible();

    // Previous button should be disabled (first page)
    const prevButton = page.locator('button:has-text("Previous")');
    await expect(prevButton).toBeDisabled();

    // Next button state depends on evidence count
    const nextButton = page.locator('button:has-text("Next")');
    // Just verify the button exists
    await expect(nextButton).toBeVisible();
  });

  test('Logout Flow: Should logout and redirect to login page', async ({ page }) => {
    // Login first
    await loginWithCredentials(page, TEST_EMAIL, TEST_PASSWORD);

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
    await loginWithCredentials(page, TEST_EMAIL, TEST_PASSWORD);

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
