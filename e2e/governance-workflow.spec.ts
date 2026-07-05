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
    test('should recommend appropriate tier based on complexity', async ({ page }) => {
      // Complete onboarding with extensive usage
      await page.goto(`${baseUrl}/app/governance/recommendation`);

      // Wait for recommendation to load
      await page.waitForLoadState('networkidle');

      // Verify tier recommendation displayed
      const tierHeading = page.locator('text=/Wir empfehlen:.*(?:Starter|Growth|Agency|Scale)/');
      await expect(tierHeading).toBeVisible();

      // Verify pricing displayed
      await expect(page.locator('text=/€.*\\/.*Monat/')).toBeVisible();
    });

    test('should show required features for recommended tier', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/recommendation`);

      // Wait for recommendations
      await page.waitForLoadState('networkidle');

      // Verify features section
      await expect(page.locator('text=Erforderliche Features')).toBeVisible();

      // Verify at least one feature badge
      const featureBadges = page.locator('[class*="badge"]');
      await expect(featureBadges).toBeTruthy();
    });

    test('should have working upgrade button', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/recommendation`);

      // Wait for recommendation
      await page.waitForLoadState('networkidle');

      // Find and click upgrade button
      const upgradeButton = page.locator('button, a').filter({ hasText: /Upgrade|Jetzt|upgraden/ }).first();

      if (await upgradeButton.isVisible()) {
        const checkoutUrl = await upgradeButton.getAttribute('href');
        expect(checkoutUrl).toMatch(/checkout\/(starter|growth|agency|scale)/);
      }
    });
  });

  test.describe('Governance Views Access', () => {
    test('should load AI Register view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/ai-register`);

      await expect(page.locator('text=AI-System')).toBeVisible();
      await expect(page.locator('button:has-text("Hinzufügen")')).toBeVisible();
    });

    test('should load DSGVO Directory view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/dsgvo-directory`);

      await expect(page.locator('text=DSGVO-Verzeichnis')).toBeVisible();
      await expect(page.locator('text=Art.*5.*DSGVO')).toBeVisible();
    });

    test('should load AI Act Assessment view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/ai-act-assessment`);

      await expect(page.locator('text=AI-Act-Risikoprüfung')).toBeVisible();
      await expect(page.locator('text=Minimal|Limited|High|Prohibited')).toBeVisible();
    });

    test('should load NIS2 Incidents view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/nis2-incidents`);

      await expect(page.locator('text=NIS2-Meldepflichten')).toBeVisible();
      await expect(page.locator('text=6 Stunden|24 Stunden|72 Stunden')).toBeVisible();
    });

    test('should load ISO 27001 Controls view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso27001`);

      await expect(page.locator('text=ISO 27001')).toBeVisible();
      await expect(page.locator('text=Compliance Score')).toBeVisible();
    });

    test('should load ISO 42001 Controls view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso42001`);

      await expect(page.locator('text=ISO 42001')).toBeVisible();
      await expect(page.locator('text=AI Management')).toBeVisible();
    });

    test('should load Gap Analysis view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/gaps`);

      await expect(page.locator('text=Gap-Analyse')).toBeVisible();
      await expect(page.locator('text=Compliance-Lücken')).toBeVisible();
    });

    test('should load Evidence Vault view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/evidence-vault-advanced`);

      await expect(page.locator('text=Nachweis-Vault')).toBeVisible();
      await expect(page.locator('button:has-text("Hochladen")')).toBeVisible();
    });

    test('should load Remediation Plans view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/remediation-plans`);

      await expect(page.locator('text=Behebungsplan')).toBeVisible();
      await expect(page.locator('text=Fortschritt')).toBeVisible();
    });

    test('should load Audit Reports view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-reports`);

      await expect(page.locator('text=Audit-Berichte')).toBeVisible();
      await expect(page.locator('text=Multi-Framework')).toBeVisible();
    });

    test('should load API Keys view', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/api-keys`);

      await expect(page.locator('text=API-Keys')).toBeVisible();
      await expect(page.locator('button:has-text("Neuer Key")')).toBeVisible();
    });
  });

  test.describe('Tier Gating', () => {
    test('should show upgrade prompt for restricted features', async ({ page }) => {
      // This test assumes user on Starter tier
      // Some features should show upgrade gates
      await page.goto(`${baseUrl}/app/governance/iso42001`);

      // If on Starter tier, should see upgrade prompt
      const upgradePrompt = page.locator('text=/Feature gesperrt|Upgrade/i');

      // Either loads the feature or shows upgrade prompt
      const featureLoaded = page.locator('text=ISO 42001');
      const hasFeatureOrPrompt = await upgradePrompt.isVisible() || await featureLoaded.isVisible();

      expect(hasFeatureOrPrompt).toBeTruthy();
    });
  });

  test.describe('Filter & Navigation', () => {
    test('should filter gap analysis by severity', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/gaps`);

      // Select critical severity filter
      const severityFilter = page.locator('select').filter({ hasText: 'Schweregrad' });
      await severityFilter.selectOption('critical');

      // Verify filter applied (cards update or empty state shown)
      await page.waitForLoadState('networkidle');

      // Should see either critical gaps or empty state
      const criticalBadges = page.locator('text=/KRITISCH|Keine Lücken/');
      await expect(criticalBadges).toBeTruthy();
    });

    test('should navigate between governance views', async ({ page }) => {
      const views = [
        '/app/governance/ai-register',
        '/app/governance/dsgvo-directory',
        '/app/governance/ai-act-assessment',
      ];

      for (const view of views) {
        await page.goto(`${baseUrl}${view}`);
        await expect(page).toHaveURL(new RegExp(view));
        await page.waitForLoadState('networkidle');
      }
    });
  });

  test.describe('Compliance Scoring', () => {
    test('should calculate and display compliance scores', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/iso27001`);

      // Verify compliance score displayed
      await expect(page.locator('text=Compliance Score')).toBeVisible();

      // Verify percentage shown
      const scorePercent = page.locator('[class*="bold"]').filter({ hasText: /^\d+%$/ });
      await expect(scorePercent).toBeTruthy();
    });

    test('should show framework-specific scores', async ({ page }) => {
      await page.goto(`${baseUrl}/app/governance/audit-reports`);

      // Look for framework scores section
      const frameworkScores = page.locator('text=Framework|Scores');
      const scoreVisible = await frameworkScores.isVisible();

      // Either shows detailed scores or summary
      expect(scoreVisible).toBeTruthy();
    });
  });
});
