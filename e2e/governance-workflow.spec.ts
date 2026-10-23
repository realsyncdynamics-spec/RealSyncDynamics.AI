import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Governance OS Multi-Framework Workflow
 *
 * Tests complete flow:
 * 1. Governance onboarding (Step 1-10)
 * 2. Tier recommendation based on complexity
 * 3. Access to governance views (with tier gating)
 * 4. Gap analysis workflow
 * 5. Evidence vault management
 * 6. Compliance reporting
 */

test.describe('Governance OS Workflow', () => {
  const baseUrl = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Note: In production, would use test auth fixtures
    // For now, navigate to app and assume logged in
    await page.goto(`${baseUrl}/app`);
  });

  test.describe('10-Step Governance Onboarding', () => {
    test('should display onboarding wizard', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/onboarding`);

      // Wait for step 1
      await expect(page.locator('text=Step 1')).toBeVisible();
      await expect(page.locator('text=KI-Nutzung')).toBeVisible();
    });

    test('should progress through all 10 steps', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/onboarding`);

      const steps = [
        { number: 1, label: 'KI-Nutzung' },
        { number: 2, label: 'Personendaten' },
        { number: 3, label: 'Externe Anbieter' },
        { number: 4, label: 'Kritische Prozesse' },
        { number: 5, label: 'Vorfälle' },
        { number: 6, label: 'DSGVO-Dokumente' },
        { number: 7, label: 'ISMS' },
        { number: 8, label: 'ISO-Zertifikate' },
        { number: 9, label: 'Gap-Analyse' },
        { number: 10, label: 'Empfehlung' },
      ];

      for (const step of steps) {
        // Verify step visible
        await expect(page.locator(`text=Step ${step.number}`)).toBeVisible();
        await expect(page.locator(`text=${step.label}`)).toBeVisible();

        // Click Next (except on final step)
        if (step.number < 10) {
          const nextButton = page.locator('button:has-text("Weiter")').first();
          if (await nextButton.isVisible()) {
            await nextButton.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }
    });

    test('should submit workflow data', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/onboarding?step=1`);

      // Select extensive AI usage
      await page.locator('label:has-text("Umfangreich")').click();
      await page.locator('button:has-text("Weiter")').click();

      // Select high personal data volume
      await page.locator('label:has-text("Hohe Mengen")').click();
      await page.locator('button:has-text("Weiter")').click();

      // Verify data persists by going back
      await page.locator('button:has-text("Zurück")').click();
      await expect(page.locator('input[type="radio"][value="high_volume"]')).toBeChecked();
    });
  });

  test.describe('Tier Recommendation Engine', () => {
    // Die frühere Ansicht lud nie Daten (GET auf eine POST-only-Function).
    test('legacy recommendation path forwards to the dashboard', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/recommendation`);
      await expect(page).toHaveURL(/\/app\/dashboard$/);
    });
  });

  test.describe('Governance Views Access', () => {
    test('legacy AI Register path forwards to the AI system inventory', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/ai-register`);

      await expect(page).toHaveURL(/\/app\/ai-systems$/);
      await expect(page.getByTestId('ai-systems-view')).toBeVisible();
    });

    test('legacy DSGVO directory path forwards to the document generator', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/dsgvo-directory`);

      await expect(page).toHaveURL(/\/app\/documents$/);
    });

    test('legacy AI Act assessment path forwards to the AI system inventory', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/ai-act-assessment`);

      await expect(page).toHaveURL(/\/app\/ai-systems$/);
    });

    test('legacy NIS2 and ISO 27001 paths forward to the policy packs', async ({ page }) => {
      for (const legacy of ['/app/governance/nis2-incidents', '/app/governance/iso27001']) {
        await page.goto(`${baseUrl}${legacy}`);
        await expect(page).toHaveURL(/\/app\/policy-packs$/);
      }
    });

    // Diese Pfade zeigten Ansichten ohne funktionierendes Backend; sie leiten
    // jetzt auf die Flächen um, die die Funktion wirklich bereitstellen.
    test('legacy governance paths forward to working surfaces', async ({ page }) => {
      const forwards: Array<[string, RegExp]> = [
        ['/app/governance/iso42001', /\/app\/governance\/iso42001-library$/],
        ['/app/governance/gaps', /\/app\/risks$/],
        ['/app/governance/evidence-vault-advanced', /\/app\/evidence-vault$/],
        ['/app/governance/remediation-plans', /\/app\/remediation$/],
        ['/app/governance/audit-reports', /\/app\/reports$/],
        ['/app/governance/api-keys', /\/app\/keys$/],
      ];
      for (const [legacy, target] of forwards) {
        await page.goto(`${baseUrl}${legacy}`);
        await expect(page).toHaveURL(target);
      }
    });
  });

  test.describe('Tier Gating', () => {
    test('should show upgrade prompt for restricted features', async ({ page }) => {
      // This test assumes user on Starter tier
      // Some features should show upgrade gates
      await page.goto(`${baseUrl}/app/governance/iso42001-library`);

      // If on Starter tier, should see upgrade prompt
      const upgradePrompt = page.locator('text=/Feature gesperrt|Upgrade/i');

      // Either loads the feature or shows upgrade prompt
      const featureLoaded = page.locator('text=ISO 42001');
      const hasFeatureOrPrompt = await upgradePrompt.isVisible() || await featureLoaded.isVisible();

      expect(hasFeatureOrPrompt).toBeTruthy();
    });
  });

  test.describe('Filter & Navigation', () => {
    test('should navigate between governance views', async ({ page }) => {
      const views = [
        '/app/ai-systems',
        '/app/documents',
      ];

      for (const view of views) {
        await page.goto(`${baseUrl}${view}`);
        await expect(page).toHaveURL(new RegExp(view));
        await page.waitForLoadState('networkidle');
      }
    });
  });
});
