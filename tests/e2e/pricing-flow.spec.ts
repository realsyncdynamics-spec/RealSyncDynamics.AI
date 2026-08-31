import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

// Die Karten, die auf /pricing stehen. Seit AP2 (2026-08-24) sind es drei:
// Agency und Partner sind stillgelegt und erscheinen in keinem Angebot mehr.
// Ihre Detailseiten (`DETAIL_SLUGS`) bleiben erreichbar — geteilte Links und
// Bestandskunden sollen nicht ins Leere laufen.
const CARD_IDS = [
  'starter',
  'growth',
  'enterprise',
];

const DETAIL_SLUGS = [
  'free-audit',
  'starter',
  'growth',
  'agency',
  'partner',
  'enterprise',
  'starter_yearly',
  'growth_yearly',
  'agency_yearly',
  'partner_yearly',
];

// Nur Pläne mit `purchaseMode: 'checkout'` (shared/pricing.ts) bleiben auf der
// Checkout-Seite stehen. `partner` ist 'inquiry' und leitet auf /contact-sales
// um — in dieser Liste erzeugte er ein Rennen zwischen page.goto und dem
// Redirect, das der Test mal gewann und mal verlor. Der Redirect wird unten
// eigens geprüft statt hier ignoriert.
// Die Plan-Keys, die einen Self-Service-Checkout erreichen. Agency ist seit
// AP2 nicht mehr dabei: stillgelegt, führt auf die Preisseite zurück.
// Die Jahres-Keys sind hier nicht mehr dabei: fuer `starter_yearly` und
// `growth_yearly` ist in `public.products` kein echter Stripe-Preis
// verdrahtet, `stripe-checkout` weist sie mit PRICE_NOT_CONFIGURED ab. Die
// Checkout-Seite leitet sie deshalb auf den Monats-Checkout desselben Plans
// um — eigens geprueft statt hier ignoriert.
const CHECKOUT_PLAN_KEYS = [
  'starter',
  'growth',
];

const UNWIRED_YEARLY_REDIRECTS: Array<[string, string]> = [
  ['starter_yearly', 'starter'],
  ['growth_yearly', 'growth'],
];

test.describe('Pricing Flow', () => {
  test.describe('Pricing Overview (/pricing)', () => {
    test('should load pricing page and display pricing packages', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });

      const pricingCards = page.locator('[data-testid^="pricing-card-"]');
      await expect(pricingCards.first()).toBeVisible({ timeout: 10000 });
      const cardCount = await pricingCards.count();
      expect(cardCount).toBe(CARD_IDS.length);
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

    test('Jahres-Checkout ohne verdrahteten Preis leitet auf den Monats-Checkout', async ({ page }) => {
      for (const [yearlyKey, monthlyKey] of UNWIRED_YEARLY_REDIRECTS) {
        await page.goto(`${BASE_URL}/checkout/${yearlyKey}`);
        await page.waitForURL(new RegExp(`/checkout/${monthlyKey}`));
        expect(page.url()).toContain(`/checkout/${monthlyKey}`);
        expect(page.url()).not.toContain(yearlyKey);
      }
    });

    test('partner checkout should redirect to contact-sales', async ({ page }) => {
      for (const planKey of ['partner', 'partner_yearly']) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForURL(/\/contact-sales/);
        await expect(page).toHaveURL(/plan=partner/);
      }
    });

    test('free audit plan should redirect to audit page', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/free_audit`);
      await page.waitForURL(/\/audit/);
      await expect(page).toHaveURL(/\/audit/);
    });

    test('enterprise checkout should redirect to contact-sales', async ({ page }) => {
      // Seit AP2 (2026-08-24) ist Enterprise ein Vertrag, kein
      // Self-Service-Checkout: `purchaseMode: 'inquiry'`. Er darf damit auch
      // keinen Self-Service-Trial oeffnen. Bestehende Enterprise-Abos rechnen
      // unverändert weiter ab — betroffen ist allein der Neuabschluss.
      await page.goto(`${BASE_URL}/checkout/enterprise`);
      await page.waitForURL(/\/contact-sales/);
      await expect(page).toHaveURL(/plan=enterprise/);
      await expect(page).not.toHaveURL(/pilot=true/);
    });

    test('stillgelegte Pläne führen zurück auf die Preisseite', async ({ page }) => {
      // Agency und Partner sind seit AP2 aus dem Verkauf. Partner läuft über
      // `inquiry` in den Vertrieb (siehe oben); Agency behält seinen
      // Kaufmodus `checkout`, weil laufende Abos unverändert abrechnen — die
      // getippte URL darf trotzdem zu keinem Kauf mehr führen.
      for (const planKey of ['agency', 'agency_yearly']) {
        await page.goto(`${BASE_URL}/checkout/${planKey}`);
        await page.waitForURL(/\/pricing/);
        await expect(page).toHaveURL(/source=checkout-retired/);
      }
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
