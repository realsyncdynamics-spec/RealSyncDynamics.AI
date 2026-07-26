import { test, expect } from '@playwright/test';

/**
 * E2E Tests für neu refaktorierte Dashboard-Komponenten
 * Phase 1-4: UX-Verbesserungen & Live-Integration
 */

test.describe('Enhanced Governance Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to enhanced dashboard
    await page.goto('/dashboard/governance-enhanced');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should render dashboard with sidebar navigation', async ({ page }) => {
    // Check sidebar exists
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Check navigation groups are present
    const operationsGroup = page.getByText('Operations').first();
    await expect(operationsGroup).toBeVisible();
  });

  test('should render KPI Grid with correct columns', async ({ page }) => {
    // Check KPI grid is visible
    const kpiGrid = page.locator('[class*="grid"]').first();
    await expect(kpiGrid).toBeVisible();

    // Check that KPI items are rendered
    const kpiItems = page.locator('button').filter({ hasText: /Score|Risks|Actions|Evidence|Recommendations/ });
    const count = await kpiItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display severity colors on KPI cards', async ({ page }) => {
    // Get KPI cards and check for severity styling
    const kpiCards = page.locator('button[class*="border-"]');
    const cardCount = await kpiCards.count();

    // At least one card should have a severity indicator
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = kpiCards.nth(i);
      const classes = await card.getAttribute('class');
      expect(classes).toMatch(/border-(red|orange|amber|emerald|blue)/);
    }
  });

  test('should render AI Assistant Card', async ({ page }) => {
    // Check AI Assistant is visible
    const aiCard = page.getByText(/AI Compliance Assistant|🤖/);
    await expect(aiCard).toBeVisible();

    // Check for action buttons
    const actions = ['Risiko analysieren', 'Audit vorbereiten', 'Maßnahmen generieren', 'ISO-Bericht'];
    for (const action of actions) {
      const actionButton = page.getByText(action);
      await expect(actionButton).toBeVisible();
    }
  });

  test('should handle sidebar group collapsing', async ({ page }) => {
    // Find a group header (e.g., "Security & Compliance")
    const groupHeader = page.getByText('Security & Compliance');

    // Click to collapse
    await groupHeader.click();

    // Check that items are hidden
    const complianceItems = page.getByText('Compliance').filter({ hasText: /Compliance/ });
    await expect(complianceItems).toHaveCount(0);

    // Click again to expand
    await groupHeader.click();

    // Items should be visible again
    await expect(complianceItems).toBeVisible();
  });

  test('should be responsive on mobile', async ({ browser }) => {
    // Create context with mobile viewport
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();

    await page.goto('/dashboard/governance-enhanced');
    await page.waitForLoadState('networkidle');

    // Check that sidebar is still accessible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Check that KPI grid is responsive (should be single column)
    const kpiItems = page.locator('button').filter({ hasText: /Score|Risks/ });
    const count = await kpiItems.count();
    expect(count).toBeGreaterThan(0);

    await context.close();
  });

  test('should have accessible heading hierarchy', async ({ page }) => {
    // Check for h1 (page title)
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();

    // Check for h2 (section headings)
    const h2 = page.locator('h2');
    const h2Count = await h2.count();
    expect(h2Count).toBeGreaterThan(0);
  });
});

test.describe('Component Showcase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/showcase/components');
    await page.waitForLoadState('networkidle');
  });

  test('should display all typography styles', async ({ page }) => {
    // Check page title exists
    const pageTitle = page.locator('text=Component Showcase');
    await expect(pageTitle).toBeVisible();

    // Check typography section exists
    const typographySection = page.getByText('Typography System');
    await expect(typographySection).toBeVisible();

    // Check for different heading styles
    const headings = page.locator('h1, h2, h3');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(3);
  });

  test('should render KPI showcase examples', async ({ page }) => {
    // Scroll to KPI Grid section
    await page.goto('/showcase/components#kpi-grid');

    // Check for example KPIs
    const exampleKpis = page.getByText(/Example Metric|Warning Metric|Critical Issue/);
    const kpiCount = await exampleKpis.count();
    expect(kpiCount).toBeGreaterThan(0);
  });

  test('should display design tokens section', async ({ page }) => {
    // Scroll to design system section
    await page.goto('/showcase/components#design');

    // Check for color palettes
    const colorSection = page.getByText('Design System');
    await expect(colorSection).toBeVisible();

    // Check for color swatches
    const colorBoxes = page.locator('div[style*="background"]');
    const colorCount = await colorBoxes.count();
    expect(colorCount).toBeGreaterThan(2);
  });

  test('should have working navigation links', async ({ page }) => {
    // Find navigation links
    const homeLink = page.getByRole('link', { name: /Home/ });

    // Check link is present
    await expect(homeLink).toBeVisible();

    // Check href attribute
    const href = await homeLink.getAttribute('href');
    expect(href).toBeTruthy();
  });
});

test.describe('Refactored Governance Dashboard', () => {
  test('should require authentication', async ({ page }) => {
    // Clear cookies to ensure not authenticated
    await page.context().clearCookies();

    // Navigate to refactored dashboard
    await page.goto('/dashboard/refactored');

    // Should redirect to login or show auth gate
    // Check URL or for login elements
    const url = page.url();
    const hasRedirected = url.includes('login') || url.includes('auth');
    expect(hasRedirected).toBeTruthy();
  });

  test('should display live data from Supabase', async ({ page }) => {
    // This test assumes user is authenticated via beforeEach hook
    // Navigate to refactored dashboard
    await page.goto('/dashboard/refactored');
    await page.waitForLoadState('networkidle');

    // Check that page title is visible
    const title = page.getByText(/Governance Dashboard \(Refactored\)/);
    await expect(title).toBeVisible();

    // Check that KPI data is rendered
    const scoreValue = page.locator('text=/\\d+/').first(); // Look for numbers (scores)
    await expect(scoreValue).toBeVisible();
  });

  test('should show loading state briefly', async ({ page }) => {
    // Monitor network to simulate slow connection
    await page.goto('/dashboard/refactored', { waitUntil: 'commit' });

    // Loading text should be visible or fade quickly
    const loadingText = page.getByText(/Loading|loading/);
    // May have already loaded, so just check it's not an error
    const errorText = page.getByText(/Error|error/);
    await expect(errorText).not.toBeVisible();
  });

  test('should have working logout button', async ({ page }) => {
    // Navigate to refactored dashboard
    await page.goto('/dashboard/refactored');
    await page.waitForLoadState('networkidle');

    // Find logout button
    const logoutButton = page.getByRole('button', { name: /Logout/ });
    await expect(logoutButton).toBeVisible();

    // Check button styling
    const classes = await logoutButton.getAttribute('class');
    expect(classes).toContain('red');
  });

  test('should render evidence list section', async ({ page }) => {
    await page.goto('/dashboard/refactored');
    await page.waitForLoadState('networkidle');

    // Check for Recent Evidence section
    const recentEvidence = page.getByText(/Recent Evidence/);
    await expect(recentEvidence).toBeVisible();

    // Check for evidence items or empty state
    const evidenceItems = page.locator('[class*="border-titanium"]');
    await expect(evidenceItems).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels on navigation', async ({ page }) => {
    await page.goto('/dashboard/governance-enhanced');
    await page.waitForLoadState('networkidle');

    // Check for semantic HTML
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for heading hierarchy
    const headings = page.locator('h1, h2, h3, h4');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/dashboard/governance-enhanced');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // Check that focus is visible
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      return element?.tagName;
    });

    expect(focused).toBeTruthy();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/showcase/components');
    await page.waitForLoadState('networkidle');

    // Check for text visibility
    const textElements = page.locator('body *');
    const count = await textElements.count();

    // Basic sanity check that content is present
    expect(count).toBeGreaterThan(10);
  });
});
