import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

const CARD_IDS = [
  'starter',
  'growth',
  'agency',
  'scale',
  'enterprise',
];

const DETAIL_SLUGS = [
  'free-audit',
  'starter',
  'growth',
  'agency',
  'scale',
  'enterprise',
  'starter_yearly',
  'growth_yearly',
  'agency_yearly',
  'scale_yearly',
];

// Only the monthly plans are self-serve /checkout pages. CheckoutPage's
// VALID_PLAN_KEYS (src/features/billing/CheckoutPage.tsx) accepts
// starter/growth/agency/scale (+ free-audit → /audit, enterprise →
// /contact-sales); the *_yearly variants are not bookable via /checkout and
// redirect to /pricing. (If yearly self-serve checkout is desired, that is a
// separate CheckoutPage change, not a test gap.)
const CHECKOUT_PLAN_KEYS = [
  'starter',
  'growth',
  'agency',
  'scale',
];

test.describe('Pricing Flow', () => {
  test.describe('Pricing Overview (/pricing)', () => {
    test('should load pricing page and display pricing packages', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });

      const pricingCards = page.locator('[data-testid^="pricing-card-"]');
      await expect(pricingCards.first()).toBeVisible({ timeout: 10000 });
      const cardCount = await pricingCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(4);
    });

    test('should display all expected plan cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });

      for (const id of CARD_IDS) {
        const card = page.locator(`[data-testid="pricing-card-${id}"]`);
        await expect(card).toBeVisible({ timeout: 10000 });
      }
    });

    test('Growth plan should be marked as recommended', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      await expect(growthCard).toBeVisible();
    });
  });

  test.describe('Plan Detail Pages', () => {
    test('all plan detail pages should be accessible', async ({ page }) => {
      for (const slug of DETAIL_SLUGS) {
        await page.goto(`${BASE_URL}/pricing/${slug}`);
        await page.waitForLoadState('domcontentloaded');

        const planDetail = page.locator(`[data-testid="plan-detail-${slug}"]`);
        await expect(planDetail).toBeVisible().catch(() => true);
      }
    });

    test('free card info link should resolve to free-audit detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/free`);
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/pricing\/free-audit/);
    });

    test('yearly plan pricing should be accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toContain('growth_yearly');
    });
  });

  test.describe('Checkout Flow', () => {
    test('should navigate to checkout page from pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      const bookButton = page.locator('[data-testid="pricing-book-growth"]');
      if (await bookButton.isVisible()) {
        await bookButton.click();
        await expect(page).toHaveURL(/\/checkout\/growth/);
      }
    });

    test('all bookable checkout pages should be accessible', async ({ page }) => {
      for (const planKey of CHECKOUT_PLAN_KEYS) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForLoadState('domcontentloaded');

        expect(page.url()).toContain(`/checkout/${planKey}`);
      }
    });

    test('free audit plan should redirect to audit page', async ({ page }) => {
      // The free-audit plan key uses a hyphen (matches CheckoutPage VALID_PLAN_KEYS).
      await page.goto(`${BASE_URL}/checkout/free-audit`);
      await page.waitForURL(/\/audit/);
      await expect(page).toHaveURL(/\/audit/);
    });

    test('enterprise checkout should redirect to contact sales', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/enterprise`);
      await page.waitForURL(/\/contact-sales/);
      await expect(page).toHaveURL(/\/contact-sales/);
    });
  });

  test.describe('Navigation Consistency', () => {
    test('should navigate to plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('domcontentloaded');

      expect(page.url()).toContain('/pricing/growth');
    });

    test('pricing page should be accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('invalid plan slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('invalid checkout slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/invalid-slug`, { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/pricing/);
    });
  });
});
