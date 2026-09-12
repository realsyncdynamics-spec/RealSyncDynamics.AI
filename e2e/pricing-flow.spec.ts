import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || process.env.TEST_BASE_URL || 'http://localhost:3000';

// Sellable cards on /pricing (SELLABLE_PRICING_TIERS). Partner is legacy.
const CARD_IDS = ['starter', 'growth', 'agency', 'enterprise'] as const;
const SELF_SERVICE_CHECKOUT = ['starter', 'growth', 'agency'] as const;

test.describe('Pricing Flow', () => {
  test.describe('Pricing Overview (/pricing)', () => {
    test('should load pricing page and display sellable packages', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      const pricingCards = page.locator('[data-testid^="pricing-card-"]');
      await expect(pricingCards.first()).toBeVisible({ timeout: 10000 });
      expect(await pricingCards.count()).toBe(CARD_IDS.length);
    });

    test('should display all expected plan slugs as cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      for (const id of CARD_IDS) {
        await expect(page.locator(`[data-testid="pricing-card-${id}"]`)).toBeVisible();
      }
      await expect(page.locator('[data-testid="pricing-card-partner"]')).toHaveCount(0);
    });

    test('Growth plan should be marked as recommended', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      await expect(growthCard).toBeVisible();
      await expect(growthCard.locator('text=Empfohlen')).toBeVisible();
    });

    test('should have checkout buttons for self-service plans', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      for (const id of SELF_SERVICE_CHECKOUT) {
        await expect(
          page.locator(`[data-testid="pricing-card-${id}"] [data-testid="pricing-book-${id}"]`),
        ).toBeVisible();
      }
      await expect(
        page.locator('[data-testid="pricing-card-enterprise"] [data-testid="pricing-book-enterprise"]'),
      ).toBeVisible();
    });
  });

  test.describe('Checkout Flow', () => {
    test('should navigate to checkout page from pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      const bookButton = page.locator('[data-testid="pricing-book-growth"]');
      await bookButton.click();
      await expect(page).toHaveURL(/\/checkout\/growth/);
    });

    test('self-service checkout pages stay on checkout path', async ({ page }) => {
      for (const planKey of SELF_SERVICE_CHECKOUT) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(new RegExp(`/checkout/${planKey}`));
        await expect(page).not.toHaveURL(/source=checkout-retired/);
      }
    });

    test('enterprise and partner checkout redirect to contact-sales', async ({ page }) => {
      for (const planKey of ['enterprise', 'partner', 'partner_yearly']) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForURL(/\/contact-sales/);
        await expect(page).toHaveURL(/plan=/);
      }
    });

    test('free audit plan should redirect to audit page', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/free_audit`);
      await page.waitForURL(/\/audit/);
    });

    test('unwired yearly checkout redirects to monthly', async ({ page }) => {
      for (const [yearly, monthly] of [
        ['starter_yearly', 'starter'],
        ['growth_yearly', 'growth'],
        ['agency_yearly', 'agency'],
      ] as const) {
        await page.goto(`${BASE_URL}/checkout/${yearly}`);
        await page.waitForURL(new RegExp(`/checkout/${monthly}(\\?|$)`));
        expect(page.url()).not.toContain(yearly);
      }
    });
  });

  test.describe('Landing pricing CTAs', () => {
    test('landing Starter/Growth/Agency CTAs point at checkout', async ({ page }) => {
      await page.goto(`${BASE_URL}/`);
      await page.waitForLoadState('domcontentloaded');
      const pricing = page.locator('#pricing');
      if ((await pricing.count()) === 0) {
        test.skip();
        return;
      }
      await pricing.scrollIntoViewIfNeeded();
      for (const plan of SELF_SERVICE_CHECKOUT) {
        const link = pricing.locator(`a[href*="/checkout/${plan}"]`).first();
        await expect(link).toBeVisible();
      }
    });
  });

  test.describe('Navigation Consistency', () => {
    test('invalid checkout slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });
  });
});
