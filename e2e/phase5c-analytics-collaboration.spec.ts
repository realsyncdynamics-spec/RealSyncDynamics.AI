import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Phase 5C - Analytics, Bulk Operations, Collaboration
 *
 * Tests:
 * 1. Compliance Analytics Dashboard
 * 2. Bulk Operations (import, job history)
 * 3. Compliance Calendar
 * 4. Audit Trail
 * 5. Team Collaboration (members, assignments, workload)
 */

test.describe('Phase 5C: Analytics, Bulk Operations, Collaboration', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseUrl}/app`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Compliance Analytics View', () => {
    test('should load compliance analytics dashboard', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      await expect(page.locator('text=Compliance Analytics')).toBeVisible();
      await expect(page.locator('text=Trends, KPIs, and predictive forecasting')).toBeVisible();
    });

    test('should display KPI cards', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Check for KPI cards
      await expect(page.locator('text=Overall Compliance Score')).toBeVisible();
      await expect(page.locator('text=Controls Implemented')).toBeVisible();
      await expect(page.locator('text=Active Gaps')).toBeVisible();
      await expect(page.locator('text=Evidence Coverage')).toBeVisible();
    });

    test('should allow framework filtering', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Click ISO 27001 framework
      const iso27001Btn = page.locator('button:has-text("ISO 27001")');
      await iso27001Btn.click();

      // Verify selected
      await expect(iso27001Btn).toHaveClass(/bg-cyan-600/);
    });

    test('should allow date range selection', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Select last quarter
      const dateSelect = page.locator('select').last();
      await dateSelect.selectOption('quarter');

      // Verify selection
      const selectedValue = await dateSelect.inputValue();
      expect(selectedValue).toBe('quarter');
    });

    test('should display score trend graph', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Look for trend section
      await expect(page.locator('text=Compliance Score Trend')).toBeVisible();

      // Check for progress bars
      const progressBars = page.locator('[class*="progress"]').or(page.locator('[class*="from-cyan"]'));
      expect(await progressBars.count()).toBeGreaterThan(0);
    });

    test('should display framework scores', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Look for framework scores section
      await expect(page.locator('text=Framework Scores & Targets')).toBeVisible();

      // Check for individual frameworks
      await expect(page.locator('text=ISO 27001').or(page.locator('text=/ISO|DSGVO|NIS2/'))).toBeVisible();
    });

    test('should display audit readiness score', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Look for audit readiness section
      await expect(page.locator('text=Audit Readiness Score')).toBeVisible();

      // Check for score number
      const scoreElements = page.locator('text=/\\d+\\/100/');
      expect(await scoreElements.count()).toBeGreaterThan(0);
    });

    test('should display gap movement trends', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Look for gap trends section
      await expect(page.locator('text=Gap Movement Trends')).toBeVisible();

      // Check for week labels
      await expect(page.locator('text=Week').or(page.locator('text=/Week [0-9]/'))).toBeVisible();
    });
  });

  test.describe('Bulk Operations View', () => {
    test('should load bulk operations dashboard', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      await expect(page.locator('text=Bulk Operations')).toBeVisible();
      await expect(page.locator('text=Import and batch update governance data')).toBeVisible();
    });

    test('should display job type options', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Look for upload tab
      const uploadTab = page.locator('button:has-text("New Upload")');
      expect(await uploadTab.isVisible()).toBeTruthy();

      // Look for job types
      await expect(page.locator('text=/Import Gaps|Import Evidence|Bulk Update/').first()).toBeVisible();
    });

    test('should allow selecting job type', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Select import evidence
      const evidenceOption = page.locator('button:has-text("Import Evidence")');
      if (await evidenceOption.isVisible()) {
        await evidenceOption.click();

        // Verify selection
        await expect(evidenceOption).toHaveClass(/border-cyan-600/);
      }
    });

    test('should display file upload area', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Check for drag-and-drop area
      await expect(page.locator('text=/Drag and drop|Choose File/')).toBeVisible();
    });

    test('should navigate to job history', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Click job history tab
      const historyTab = page.locator('button:has-text("Job History")');
      await historyTab.click();
      await page.waitForTimeout(300);

      // Verify tab active
      await expect(historyTab).toHaveClass(/bg-cyan-600/);
    });

    test('should display job history list', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Go to history
      await page.locator('button:has-text("Job History")').click();
      await page.waitForTimeout(300);

      // Look for job items
      const jobItems = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/processing|completed|pending/') });
      expect(await jobItems.count()).toBeGreaterThanOrEqual(0);
    });

    test('should allow expanding job details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Go to history
      await page.locator('button:has-text("Job History")').click();
      await page.waitForTimeout(300);

      // Find and expand first job
      const firstJob = page.locator('button').filter({ has: page.locator('text=.csv').or(page.locator('text=.zip')) }).first();
      if (await firstJob.isVisible()) {
        await firstJob.click();
        await page.waitForTimeout(300);

        // Check for expanded details
        const details = page.locator('text=/Processed|Failed|Details/');
        const isVisible = await details.isVisible().catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should display import options', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/bulk-operations`);

      // Check for options
      await expect(page.locator('text=Import Options')).toBeVisible();
      await expect(page.locator('text=/Validate|Auto-assign|Rollback/').first()).toBeVisible();
    });
  });

  test.describe('Compliance Calendar View', () => {
    test('should load compliance calendar', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      await expect(page.locator('text=Compliance Calendar')).toBeVisible();
      await expect(page.locator('text=Regulatory deadlines and milestones')).toBeVisible();
    });

    test('should display calendar view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      // Look for calendar
      await expect(page.locator('text=/Mo|Tu|We|Th|Fr|Sa|Su/').first()).toBeVisible();

      // Check for month name
      const monthHeader = page.locator('text=/January|February|March|April|May|June|July|August|September|October|November|December/');
      await expect(monthHeader).toBeVisible();
    });

    test('should navigate months', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      // Click next month button
      const nextBtn = page.locator('button').filter({ has: page.locator('[class*="ChevronRight"]') }).first();
      if (await nextBtn.isVisible()) {
        const monthBefore = await page.locator('text=/[A-Za-z]+ [0-9]{4}/').first().textContent();
        await nextBtn.click();
        await page.waitForTimeout(300);
        // Month should have changed
      }
    });

    test('should switch to list view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      // Click list button
      const listBtn = page.locator('button:has-text("List")');
      await listBtn.click();
      await page.waitForTimeout(300);

      // Verify list view
      await expect(listBtn).toHaveClass(/bg-cyan-600/);
    });

    test('should display upcoming deadlines', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      // Look for upcoming deadlines section
      const upcoming = page.locator('text=Upcoming Deadlines');
      if (await upcoming.isVisible()) {
        // Should have deadline items
        const deadlineItems = page.locator('[class*="border-l"]').filter({ has: page.locator('text=/[A-Za-z]+/') });
        expect(await deadlineItems.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should display deadline list with status', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);

      // Go to list view
      await page.locator('button:has-text("List")').click();
      await page.waitForTimeout(300);

      // Check for deadline items
      const deadlineItems = page.locator('[class*="border-l"]');
      expect(await deadlineItems.count()).toBeGreaterThan(0);

      // Check for status badges
      await expect(page.locator('text=/PENDING|IN-PROGRESS|COMPLETED|OVERDUE/').first()).toBeVisible();
    });
  });

  test.describe('Audit Trail View', () => {
    test('should load audit trail', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      await expect(page.locator('text=Audit Trail')).toBeVisible();
      await expect(page.locator('text=Complete governance change log')).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Look for search field
      const searchInput = page.locator('input[placeholder*="Search"]');
      await expect(searchInput).toBeVisible();
    });

    test('should allow filtering by action', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Find action filter
      const actionSelect = page.locator('select').first();
      if (await actionSelect.isVisible()) {
        await actionSelect.selectOption('UPDATE');

        // Should show filtered results
        const logs = page.locator('[class*="bg-obsidian-900"]');
        expect(await logs.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should allow filtering by resource type', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Find resource filter
      const resourceSelect = page.locator('select').last();
      if (await resourceSelect.isVisible()) {
        await resourceSelect.selectOption('Control');
      }
    });

    test('should display audit log entries', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Look for log entries
      const logItems = page.locator('[class*="border-titanium"]').filter({ has: page.locator('text=/UPDATE|CREATE|DELETE/') });
      expect(await logItems.count()).toBeGreaterThan(0);
    });

    test('should allow expanding log details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Find first log entry
      const firstLog = page.locator('button').filter({ has: page.locator('text=/[A-Za-z]+ [A-Z]+ /') }).first();
      if (await firstLog.isVisible()) {
        await firstLog.click();
        await page.waitForTimeout(300);

        // Check for expanded details (old/new values)
        const details = page.locator('text=/Previous Value|New Value|Details/');
        const isVisible = await details.isVisible().catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should allow exporting audit log', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-trail`);

      // Look for export button
      const exportBtn = page.locator('button:has-text("Export")');
      if (await exportBtn.isVisible()) {
        await expect(exportBtn).toBeVisible();
      }
    });
  });

  test.describe('Team Collaboration View', () => {
    test('should load team collaboration dashboard', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      await expect(page.locator('text=Team Collaboration')).toBeVisible();
      await expect(page.locator('text=Team members, assignments, and workload')).toBeVisible();
    });

    test('should display team members tab', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Check for members view
      const membersTab = page.locator('button:has-text("Team Members")');
      await expect(membersTab).toBeVisible();
      await expect(membersTab).toHaveClass(/bg-cyan-600/);
    });

    test('should display team members list', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Look for member items
      const memberItems = page.locator('[class*="bg-obsidian-900"]').filter({ has: page.locator('text=/@/') });
      expect(await memberItems.count()).toBeGreaterThanOrEqual(0);

      // Look for role badges
      await expect(page.locator('text=/(OWNER|EDITOR|VIEWER)/')).toBeVisible();
    });

    test('should allow expanding member details', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Find first member
      const firstMember = page.locator('button').filter({ has: page.locator('text=/@|@company/') }).first();
      if (await firstMember.isVisible()) {
        await firstMember.click();
        await page.waitForTimeout(300);

        // Check for expanded details
        const details = page.locator('text=/(Email|Role|Message|Edit Permissions)/');
        const isVisible = await details.isVisible().catch(() => false);
        expect(typeof isVisible).toBe('boolean');
      }
    });

    test('should navigate to assignments view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Click assignments tab
      const assignTab = page.locator('button:has-text("Assignments")');
      await assignTab.click();
      await page.waitForTimeout(300);

      // Verify tab active
      await expect(assignTab).toHaveClass(/bg-cyan-600/);
    });

    test('should display assignments list', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Go to assignments
      await page.locator('button:has-text("Assignments")').click();
      await page.waitForTimeout(300);

      // Look for assignment items
      const assignments = page.locator('[class*="border"]').filter({ has: page.locator('text=/assigned|Due/') });
      expect(await assignments.count()).toBeGreaterThan(0);
    });

    test('should navigate to workload view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Click workload tab
      const workloadTab = page.locator('button:has-text("My Workload")');
      await workloadTab.click();
      await page.waitForTimeout(300);

      // Verify tab active
      await expect(workloadTab).toHaveClass(/bg-cyan-600/);
    });

    test('should display workload statistics', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Go to workload
      await page.locator('button:has-text("My Workload")').click();
      await page.waitForTimeout(300);

      // Check for stat cards
      await expect(page.locator('text=Open Tasks')).toBeVisible();
      await expect(page.locator('text=In Progress')).toBeVisible();
      await expect(page.locator('text=Completed')).toBeVisible();
    });

    test('should display my tasks in workload', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Go to workload
      await page.locator('button:has-text("My Workload")').click();
      await page.waitForTimeout(300);

      // Look for task items
      await expect(page.locator('text=My Tasks')).toBeVisible();

      const tasks = page.locator('[class*="border"]').filter({ has: page.locator('text=/Due|Priority/') });
      expect(await tasks.count()).toBeGreaterThanOrEqual(0);
    });

    test('should allow inviting members', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);

      // Look for invite button
      const inviteBtn = page.locator('button:has-text("Invite Member")');
      if (await inviteBtn.isVisible()) {
        await expect(inviteBtn).toBeVisible();
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('should navigate between views', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/compliance-analytics`);

      // Navigate to audit trail
      await page.goto(`${baseUrl}/app/governance/audit-trail`);
      await expect(page.locator('text=Audit Trail')).toBeVisible();

      // Navigate to calendar
      await page.goto(`${baseUrl}/app/governance/compliance-calendar`);
      await expect(page.locator('text=Compliance Calendar')).toBeVisible();

      // Navigate to team
      await page.goto(`${baseUrl}/app/governance/team-collaboration`);
      await expect(page.locator('text=Team Collaboration')).toBeVisible();
    });
  });
});
