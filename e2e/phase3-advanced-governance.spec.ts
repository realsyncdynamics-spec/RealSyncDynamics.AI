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

  test('Framework cards show no fabricated completion percentage', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Ein Erfüllungsgrad wird nicht aus Mandantendaten berechnet → keiner wird gezeigt.
    await expect(page.getByText(/COMPLETION/i)).toHaveCount(0);
  });

  test('Framework cards show tier requirements and status', async ({ page }) => {
    await page.goto('/app/governance/frameworks');

    // Status kommt aus dem Plan (Entitlement), nicht aus festen Werten
    await expect(page.getByText(/Im Plan enthalten|Nicht im Plan|In Vorbereitung/i).first()).toBeVisible();

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

  test('Iso42001ComplianceHub zeigt ehrlich unzureichende Daten statt erfundener Kennzahlen', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    await expect(
      page.getByRole('heading', {
        name: /ISO 42001 Compliance Hub/i,
      }),
    ).toBeVisible();

    // Keine Kontrollpunkte hinterlegt → kein Konformitätsgrad, kein Status.
    await expect(page.getByTestId('iso42001-insufficient-data')).toBeVisible();
    await expect(page.getByText(/GESAMTKONFORMITÄT/i)).toHaveCount(0);
    await expect(page.getByText(/Vor 2 Stunden/i)).toHaveCount(0);
    await expect(page.getByText(/^Konform$/)).toHaveCount(0);
  });

  test('ISO 42001 hub verweist auf das echte KI-Inventar', async ({ page }) => {
    await page.goto('/app/governance/iso-42001-hub');

    // Keine Upgrade-Versprechen für Funktionen, die es nicht gibt; der Weg führt ins Inventar.
    await expect(page.getByRole('heading', { name: /Zusätzliche Funktionen freischalten/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Zum KI-Inventar/i }).click();
    await expect(page).toHaveURL(/\/app\/ai-systems/);
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
