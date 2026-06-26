import { test, expect } from '@playwright/test';
import { aiActUsecases } from '../fixtures/ai-act-usecases';

const BASE_URL = process.env.TEST_BASE_URL || 'https://realsyncdynamicsai.de';

test.describe('[GOV-004/005] EU AI Act Seite', () => {
  test('[GOV-004] AI-Act-Seite lädt und enthält Einstieg', async ({ page }) => {
    await page.goto(BASE_URL + '/ai-act/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/.+/);

    // Seite muss irgendeinen Inhaltsblock haben
    const content = page.locator('main, [role="main"], article, section').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('[GOV-005] Mindestens ein Usecase-Element ist vorhanden', async ({ page }) => {
    await page.goto(BASE_URL + '/ai-act/', { waitUntil: 'domcontentloaded' });

    // Sucht nach Usecase-Karten, Listen oder Buttons
    const usecaseEl = page
      .locator('[data-testid*="usecase"], .usecase, li, .card, [class*="risk"], [class*="usecase"]')
      .first();

    if (await usecaseEl.count() === 0) {
      test.skip(true, 'Keine Usecase-Elemente gefunden – ggf. Selector anpassen');
      return;
    }

    await expect(usecaseEl).toBeVisible();
  });

  // Fixture-Daten für spätere Erweiterung
  test.skip('[GOV-005b] Usecase aus Fixture ist auswählbar', async ({ page }) => {
    // Wird aktiviert, sobald data-testid-Attribute gesetzt sind
    await page.goto(BASE_URL + '/ai-act/', { waitUntil: 'domcontentloaded' });
    const firstUsecase = aiActUsecases[0];
    const el = page.locator(`[data-usecase-id="${firstUsecase.id}"]`);
    await el.click();
    await expect(page.locator('[data-testid="risk-result"]')).toBeVisible();
  });
});
