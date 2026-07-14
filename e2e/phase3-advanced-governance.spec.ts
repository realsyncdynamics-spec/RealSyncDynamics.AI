import { test, expect } from '@playwright/test';

/**
 * E2E tests for Phase 3: Advanced Governance Views
 *
 * Tests framework selection, tier-based access control,
 * and compliance hub functionality.
 */

test.describe('Phase 3: Advanced Governance Views', () => {
  test('ComplianceFrameworkSelector displays all frameworks', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Main heading should be visible
    await expect(
      page.getByRole('heading', {
        name: /Compliance-Frameworks/i,
      }),
    ).toBeVisible();

    // All framework cards should be visible
    await expect(page.getByText(/DSGVO|GDPR/i)).toBeVisible();
    await expect(page.getByText(/ISO 27001/i)).toBeVisible();
    await expect(page.getByText(/ISO 42001/i)).toBeVisible();
    await expect(page.getByText(/NIS2/i)).toBeVisible();
    await expect(page.getByText(/DORA/i)).toBeVisible();
    await expect(page.getByText(/EU AI Act/i)).toBeVisible();
  });

  test('Framework cards show completion percentage', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Look for completion percentage badges
    await expect(page.getByText(/COMPLETION/i).first()).toBeVisible();

    // Progress bars should be visible
    const progressBars = page.locator('[style*="width"]').filter({ hasText: /\d+%/ });
    const count = await progressBars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Framework cards show tier requirements and status', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Status badges should be visible (Active, In Progress)
    await expect(page.getByText(/Active|In Progress/i).first()).toBeVisible();

    // Framework tier info section should be visible
    await expect(
      page.getByRole('heading', {
        name: /Frameworks nach Plan/i,
      }),
    ).toBeVisible();

    // Tier listings should show which frameworks are available
    await expect(page.getByText(/FREE TIER/i)).toBeVisible();
    await expect(page.getByText(/STARTER/i)).toBeVisible();
    await expect(page.getByText(/GROWTH\+/i)).toBeVisible();
  });

  test('Free tier users can access DSGVO framework', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // DSGVO card should be clickable (not disabled)
    const dsgvoCard = page.locator('button').filter({ hasText: /DSGVO|GDPR/ }).first();
    await expect(dsgvoCard).not.toHaveClass(/opacity-60/);

    // Should be able to click it
    await dsgvoCard.click();

    // Should navigate to DSGVO directory
    await expect(page).toHaveURL(/\/app\/governance\/dsgvo-directory/);
  });

  test('Locked frameworks show lock icon for restricted tiers', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Premium frameworks should have lock icons
    const lockIcons = page.locator('svg[class*="text-amber"]');
    const lockCount = await lockIcons.count();
    expect(lockCount).toBeGreaterThan(0);
  });

  test('Iso42001ComplianceHub displays compliance dashboard', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Should show main heading
    await expect(
      page.getByRole('heading', {
        name: /ISO 42001 Compliance Hub/i,
      }),
    ).toBeVisible();

    // Key metrics should be displayed
    await expect(page.getByText(/GESAMTKONFORMITÄT/i)).toBeVisible();
    await expect(page.getByText(/KONFORME KONTROLLEN/i)).toBeVisible();
    await expect(page.getByText(/KRITISCHE PROBLEME/i)).toBeVisible();
  });

  test('ISO 42001 hub shows compliance metrics in percentages', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Overall compliance should show percentage
    const compliancePercent = page.locator('text=/%/').first();
    await expect(compliancePercent).toBeVisible();

    // Progress bar should be visible
    const progressBar = page.locator('[style*="width: 1"]');
    await expect(progressBar.first()).toBeVisible();
  });

  test('ISO 42001 hub displays control points list', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Control points section heading
    await expect(
      page.getByRole('heading', {
        name: /Kontrollpunkte/i,
      }),
    ).toBeVisible();

    // Control items should be visible with status badges
    await expect(page.getByText(/Konform|In Arbeit|Nicht konform/i).first()).toBeVisible();
  });

  test('ISO 42001 hub shows risk levels on controls', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Risk level badges should be visible
    await expect(
      page.getByText(/Kritisch|Hoch|Mittel|Niedrig/i).first(),
    ).toBeVisible();
  });

  test('Critical issues alert displays when there are critical problems', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // If critical issues exist, alert should show
    const criticalAlert = page.getByText(/kritische Probleme/i).first();
    if (await criticalAlert.isVisible()) {
      // Alert should list the critical items
      const criticalItems = page.locator('text=/kritische/i');
      expect(await criticalItems.count()).toBeGreaterThan(0);
    }
  });

  test('ISO 42001 hub shows upgrade CTA for Scale plan features', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Upgrade section should be visible
    await expect(
      page.getByRole('heading', {
        name: /Zusätzliche Funktionen freischalten/i,
      }),
    ).toBeVisible();

    // Upgrade button should be visible
    const upgradeBtn = page.getByRole('button', {
      name: /Jetzt upgraden/i,
    });
    await expect(upgradeBtn).toBeVisible();
  });

  test('Navigation back button works from ISO 42001 hub', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Click back button
    await page.getByText(/Zurück zu Governance/i).click();

    // Should navigate back to governance
    await expect(page).toHaveURL(/\/app\/governance/);
  });

  test('Framework selector shows info section about tier access', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Info section should explain tier access
    const infoBox = page.getByText(/Frameworks nach Plan/i);
    await expect(infoBox).toBeVisible();

    // Each tier should have framework listings
    const tiers = page.locator('text=/(FREE|STARTER|GROWTH|AGENCY) TIER/');
    expect(await tiers.count()).toBeGreaterThan(0);
  });
});
