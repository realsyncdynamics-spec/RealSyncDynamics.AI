import { test, expect } from '@playwright/test';
import { aiActUsecases } from '../fixtures/ai-act-usecases';

const BASE_URL = process.env.E2E_BASE_URL || 'https://realsyncdynamicsai.de';

test.describe('[GOV-004/005] EU AI Act Seite', () => {
  test('[GOV-004] AI-Act-Seite stellt Risikoklassen-Hierarchie dar', async ({ page }) => {
    await page.goto(BASE_URL + '/ai-act/', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveTitle(/.+/);

    // Konkrete Hero-Headline statt generischem Inhaltsblock.
    await expect(
      page.getByRole('heading', { level: 1, name: /AI Act compliance without a consulting engagement/i }),
    ).toBeVisible({ timeout: 10000 });

    // EU-AI-Act-Risikoklassen (minimal / limited / high / prohibited) als
    // Pflichtenhierarchie sichtbar.
    await expect(
      page.getByText(/minimal \/ limited \/ high \/ prohibited/i),
    ).toBeVisible();
  });

  test('[GOV-005] Oversight-, Policy- und Evidence-Hinweise sichtbar', async ({ page }) => {
    await page.goto(BASE_URL + '/ai-act/', { waitUntil: 'domcontentloaded' });

    // Risikobasierte Pflichten: menschliche Freigabe, Oversight, Evidence-Chain.
    await expect(page.getByText(/menschlicher Freigabe/i)).toBeVisible();
    await expect(page.getByText(/Oversight/i).first()).toBeVisible();
    await expect(page.getByText(/Evidence-Chain/i)).toBeVisible();
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
