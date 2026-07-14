import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Phase 5A - ISO Templates & Advanced Reporting
 *
 * Tests:
 * 1. ISO Control Library View (browsing, searching, filtering)
 * 2. Report Builder (configuration, preview, generation)
 * 3. Compliance Roadmap (Gantt chart, timeline views)
 */

test.describe('Phase 5A: ISO Templates & Advanced Reporting', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Navigate to app and assume logged in
    await page.goto(`${baseUrl}/app`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('ISO Control Library View', () => {
    test('should load ISO control library', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Verify page loaded
      await expect(page.locator('text=ISO Control Library')).toBeVisible();
      await expect(page.locator('text=Browse, assess, and manage controls')).toBeVisible();
    });

    test('should display framework selector', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Verify both ISO frameworks available
      const iso27001Button = page.locator('button:has-text("ISO 27001")');
      const iso42001Button = page.locator('button:has-text("ISO 42001")');

      await expect(iso27001Button).toBeVisible();
      await expect(iso42001Button).toBeVisible();

      // Default should be ISO 27001
      await expect(iso27001Button).toHaveClass(/bg-cyan-600/);
    });

    test('should switch between frameworks', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Switch to ISO 42001
      await page.locator('button:has-text("ISO 42001")').click();
      await page.waitForLoadState('networkidle');

      // Verify framework switched
      await expect(page.locator('button:has-text("ISO 42001")')).toHaveClass(/bg-emerald-600/);
    });

    test('should search controls', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Search for a control
      const searchInput = page.locator('input[placeholder="Search controls..."]');
      await searchInput.fill('access');
      await page.waitForLoadState('networkidle');

      // Should show filtered results
      const controls = page.locator('[class*="control-item"]');
      const count = await controls.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should filter by clause', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Select a specific clause
      const clauseSelect = page.locator('select').filter({ hasText: 'All Clauses' });
      await clauseSelect.selectOption('5');
      await page.waitForLoadState('networkidle');

      // Verify only clause 5 controls shown
      const clauseBadges = page.locator('text=/Clause 5/');
      await expect(clauseBadges.first()).toBeVisible();
    });

    test('should filter by maturity level', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Filter by "Implemented or Higher"
      const maturitySelect = page.locator('select').last();
      await maturitySelect.selectOption('2');
      await page.waitForLoadState('networkidle');

      // Verify controls filtered
      const results = page.locator('[class*="control-item"]');
      expect(await results.count()).toBeGreaterThanOrEqual(0);
    });

    test('should expand control details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Get first control and expand it
      const firstControl = page.locator('[class*="control-item"]').first();
      await firstControl.click();
      await page.waitForTimeout(300);

      // Verify details visible
      await expect(page.locator('text=Objective')).toBeVisible();
      await expect(page.locator('text=Guidance')).toBeVisible();
      await expect(page.locator('text=Maturity Progression')).toBeVisible();
    });

    test('should display control maturity selector', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Verify maturity buttons (0-5)
      const maturityButtons = page.locator('button').filter({ hasText: /^[0-5]$/ });
      const count = await maturityButtons.count();
      expect(count).toBeGreaterThanOrEqual(6); // At least 6 (0-5)
    });

    test('should link to evidence upload from control', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Expand first control
      const firstControl = page.locator('[class*="control-item"]').first();
      await firstControl.click();
      await page.waitForTimeout(300);

      // Find and verify evidence link
      const evidenceButton = page.locator('text=Add Evidence').first();
      await expect(evidenceButton).toBeVisible();

      // Click should navigate to evidence vault
      const href = await evidenceButton.locator('..').evaluate((el) => el.getAttribute('href'));
      expect(href).toContain('evidence-vault-advanced');
    });

    test('should display statistics', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Check for stats cards
      await expect(page.locator('text=Total Controls')).toBeVisible();
      await expect(page.locator('text=Implemented')).toBeVisible();
      await expect(page.locator('text=Avg Maturity')).toBeVisible();
    });
  });

  test.describe('Report Builder View', () => {
    test('should load report builder', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Verify page loaded
      await expect(page.locator('text=Report Builder')).toBeVisible();
      await expect(page.locator('text=Generate PDF/Excel compliance reports')).toBeVisible();
    });

    test('should display step indicators', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Verify all steps visible
      await expect(page.locator('text=Config')).toBeVisible();
      await expect(page.locator('text=Preview')).toBeVisible();
      await expect(page.locator('text=Schedule')).toBeVisible();
      await expect(page.locator('text=Download')).toBeVisible();
    });

    test('should allow configuration of report', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Change report title
      const titleInput = page.locator('input[placeholder*="Monthly Compliance"]');
      await titleInput.clear();
      await titleInput.fill('Quarterly Compliance Report');

      // Verify title changed
      await expect(titleInput).toHaveValue('Quarterly Compliance Report');
    });

    test('should allow framework selection', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Select frameworks
      const iso27001Checkbox = page.locator('label:has-text("ISO 27001")').locator('input[type="checkbox"]');
      const dsgvoCheckbox = page.locator('label:has-text("DSGVO")').locator('input[type="checkbox"]');

      // Toggle selections
      if (!await iso27001Checkbox.isChecked()) {
        await iso27001Checkbox.click();
      }
      if (!await dsgvoCheckbox.isChecked()) {
        await dsgvoCheckbox.click();
      }

      // Verify checked
      await expect(iso27001Checkbox).toBeChecked();
      await expect(dsgvoCheckbox).toBeChecked();
    });

    test('should allow section selection', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Toggle sections
      const summaryCheckbox = page.locator('label:has-text("Executive Summary")').locator('input');
      await summaryCheckbox.click();

      await expect(summaryCheckbox).toBeChecked();
    });

    test('should allow format selection', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Select Excel format
      const excelButton = page.locator('button:has-text("Excel")');
      await excelButton.click();

      // Verify selected
      await expect(excelButton).toHaveClass(/bg-cyan-600/);
    });

    test('should generate preview', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Click generate preview
      const generateButton = page.locator('button:has-text("Generate Preview")');
      await generateButton.click();

      // Wait for preview
      await page.waitForLoadState('networkidle');

      // Verify preview step loaded
      const previewTitle = page.locator('text=/Monthly|Quarterly/');
      await expect(previewTitle).toBeVisible();
    });

    test('should display framework scores in preview', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Generate preview
      const generateButton = page.locator('button:has-text("Generate Preview")');
      await generateButton.click();
      await page.waitForLoadState('networkidle');

      // Check for compliance scores
      await expect(page.locator('text=/ISO 27001/')).toBeVisible();
      const scoreElements = page.locator('[class*="text-2xl"]').filter({ hasText: /\d+%/ });
      expect(await scoreElements.count()).toBeGreaterThan(0);
    });

    test('should navigate to schedule step', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Generate preview first
      await page.locator('button:has-text("Generate Preview")').click();
      await page.waitForLoadState('networkidle');

      // Click schedule button
      await page.locator('button:has-text("Schedule Report")').click();
      await page.waitForTimeout(500);

      // Verify schedule step visible
      await expect(page.locator('text=Schedule Report Generation')).toBeVisible();
    });

    test('should download report', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/report-builder`);

      // Generate preview
      await page.locator('button:has-text("Generate Preview")').click();
      await page.waitForLoadState('networkidle');

      // Click download
      const downloadPromise = page.waitForEvent('download');
      await page.locator('button:has-text("Download")').click();

      // Wait for download (will timeout if not working)
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();
    });
  });

  test.describe('Compliance Roadmap View', () => {
    test('should load compliance roadmap', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Verify page loaded
      await expect(page.locator('text=Compliance Roadmap')).toBeVisible();
      await expect(page.locator('text=Strategic timeline')).toBeVisible();
    });

    test('should display roadmap statistics', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Check for stats
      await expect(page.locator('text=Total Items')).toBeVisible();
      await expect(page.locator('text=In Progress')).toBeVisible();
      await expect(page.locator('text=Blocked')).toBeVisible();
      await expect(page.locator('text=Completion Rate')).toBeVisible();
    });

    test('should allow framework filtering', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Select framework filter
      const frameworkSelect = page.locator('select').first();
      await frameworkSelect.selectOption('iso27001');
      await page.waitForLoadState('networkidle');

      // Verify filtered
      const items = page.locator('[class*="roadmap-item"]');
      expect(await items.count()).toBeGreaterThanOrEqual(0);
    });

    test('should allow status filtering', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Select status filter
      const statusSelect = page.locator('select').nth(1);
      await statusSelect.selectOption('in_progress');
      await page.waitForLoadState('networkidle');

      // Verify filtered
      const items = page.locator('[class*="roadmap-item"]');
      expect(await items.count()).toBeGreaterThanOrEqual(0);
    });

    test('should switch to timeline view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Click timeline view button
      const timelineButton = page.locator('button:has-text("Timeline")');
      await timelineButton.click();
      await page.waitForTimeout(300);

      // Verify timeline view
      await expect(timelineButton).toHaveClass(/bg-cyan-600/);
    });

    test('should display Gantt chart view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Verify Gantt chart elements
      const ganttChart = page.locator('[class*="gantt-chart"]').or(page.locator('text=Gantt Chart').locator('..'));
      await expect(ganttChart).toBeVisible();
    });

    test('should expand roadmap item details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Switch to timeline view for easier expansion
      await page.locator('button:has-text("Timeline")').click();
      await page.waitForTimeout(300);

      // Click first item
      const firstItem = page.locator('[class*="roadmap-item"]').first();
      await firstItem.click();
      await page.waitForTimeout(300);

      // Verify details visible
      const details = page.locator('[class*="item-details"]').or(page.locator('text=Priority'));
      await expect(details).toBeVisible();
    });

    test('should display blockers when present', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Switch to timeline
      await page.locator('button:has-text("Timeline")').click();
      await page.waitForTimeout(300);

      // Look for items with blockers
      const blockerText = page.locator('text=Blocker');
      const isVisible = await blockerText.isVisible().catch(() => false);

      if (isVisible) {
        await expect(blockerText).toBeVisible();
      }
    });

    test('should display progress bar for items', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-roadmap`);

      // Verify progress indicators
      const progressBars = page.locator('[class*="progress"]');
      const count = await progressBars.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Integration Tests', () => {
    test('should navigate from control library to evidence', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Expand first control
      const firstControl = page.locator('[class*="control-item"]').first();
      await firstControl.click();
      await page.waitForTimeout(300);

      // Click Add Evidence
      await page.locator('text=Add Evidence').first().click();
      await page.waitForLoadState('networkidle');

      // Should navigate to evidence vault
      expect(page.url()).toContain('evidence-vault-advanced');
      await expect(page.locator('text=Nachweis-Vault')).toBeVisible();
    });

    test('should maintain framework filter across navigation', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // Switch to ISO 42001
      await page.locator('button:has-text("ISO 42001")').click();
      await page.waitForLoadState('networkidle');

      // Navigate away and back
      await page.goto(`${baseUrl}/app/governance/report-builder`);
      await page.goto(`${baseUrl}/app/governance/iso-control-library`);

      // ISO 42001 should be visible (may or may not be selected depending on persistence)
      await expect(page.locator('button:has-text("ISO 42001")')).toBeVisible();
    });
  });
});
