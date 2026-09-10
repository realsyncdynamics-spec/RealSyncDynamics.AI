import { test, expect } from '@playwright/test';
import { aiActUsecases } from '../fixtures/ai-act-usecases';

test.describe('[GOV-004/005] EU AI Act Seite', () => {
  test('[GOV-004] AI-Act-Seite stellt Risikoklassen-Hierarchie dar', async ({ page }) => {
    await page.goto('/ai-act/', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: /AI Act compliance without a consulting engagement/i }),
    ).toBeVisible();

    await expect(
      page.getByText(/minimal \/ limited \/ high \/ prohibited/i),
    ).toBeVisible();
  });

  test('[GOV-005] Oversight-, Policy- und Evidence-Hinweise sichtbar', async ({ page }) => {
    await page.goto('/ai-act/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/menschlicher Freigabe/i)).toBeVisible();
    await expect(page.getByText(/Oversight/i).first()).toBeVisible();
    await expect(page.getByText(/Evidence-Chain/i)).toBeVisible();
  });

  test.skip('[GOV-005b] Usecase aus Fixture ist auswählbar', async ({ page }) => {
    await page.goto('/ai-act/', { waitUntil: 'domcontentloaded' });
    const firstUsecase = aiActUsecases[0];
    const el = page.locator(`[data-usecase-id="${firstUsecase.id}"]`);
    await el.click();
    await expect(page.locator('[data-testid="risk-result"]')).toBeVisible();
  });
});
