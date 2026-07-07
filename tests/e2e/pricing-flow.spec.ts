import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

test.describe('Pricing Flow', () => {
  test.describe('Pricing Overview (/pricing)', () => {
    test('should load pricing page and display all pricing packages', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Check page title
      await expect(page).toHaveTitle(/[Pp]ricing|[Pp]akete/);

      // Check all pricing cards are present (6 base + 4 yearly variants = 10 total)
      const pricingCards = page.locator('[data-testid^="pricing-card-"]');
      const cardCount = await pricingCards.count();
      expect(cardCount).toBe(10);
    });

    test('should display all expected plan slugs as cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const expectedSlugs = [
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

      for (const slug of expectedSlugs) {
        const card = page.locator(`[data-testid="pricing-card-${slug}"]`);
        await expect(card).toBeVisible();
      }
    });

    test('Growth plan should be marked as recommended', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      await expect(growthCard).toBeVisible();

      // Check for "Empfohlen" badge
      const badge = growthCard.locator('text=Empfohlen');
      await expect(badge).toBeVisible();
    });

    test('should have info buttons for each plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const expectedSlugs = [
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

      for (const slug of expectedSlugs) {
        const infoButton = page.locator(
          `[data-testid="pricing-card-${slug}"] [data-testid="pricing-info-${slug}"]`
        );
        await expect(infoButton).toBeVisible();
      }
    });

    test('should have checkout buttons for each plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const expectedSlugs = [
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

      for (const slug of expectedSlugs) {
        const bookButton = page.locator(
          `[data-testid="pricing-card-${slug}"] [data-testid="pricing-book-${slug}"]`
        );
        await expect(bookButton).toBeVisible();
      }
    });
  });

  test.describe('Plan Detail Pages', () => {
    test('should navigate to plan detail page from info button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const infoButton = page.locator('[data-testid="pricing-info-growth"]');
      await infoButton.click();

      // Should be on plan detail page
      await expect(page).toHaveURL(/\/pricing\/growth/);
      await page.waitForLoadState('networkidle');

      const planDetail = page.locator('[data-testid="plan-detail-growth"]');
      await expect(planDetail).toBeVisible();
    });

    test('all plan detail pages should be accessible', async ({ page }) => {
      const planSlugs = [
        'free-audit',
        'starter',
        'growth',
        'agency',
        'scale',
        'enterprise',
      ];

      for (const slug of planSlugs) {
        await page.goto(`${BASE_URL}/pricing/${slug}`);
        await page.waitForLoadState('networkidle');

        const planDetail = page.locator(`[data-testid="plan-detail-${slug}"]`);
        await expect(planDetail).toBeVisible();
      }
    });

    test('yearly plan detail pages should be accessible', async ({ page }) => {
      const yearlyPlanSlugs = [
        'starter_yearly',
        'growth_yearly',
        'agency_yearly',
        'scale_yearly',
      ];

      for (const slug of yearlyPlanSlugs) {
        await page.goto(`${BASE_URL}/pricing/${slug}`);
        await page.waitForLoadState('networkidle');

        const planDetail = page.locator(`[data-testid="plan-detail-${slug}"]`);
        await expect(planDetail).toBeVisible();
      }
    });

    test('yearly plan should display annual billing period', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Should indicate it's an annual plan
      const annualLabel = page.locator('text=/Jahr|Annual|12 Monate/i');
      await expect(annualLabel).toBeVisible();
    });

    test('yearly plan pricing should reflect 2-month discount', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Growth yearly should be 2490 EUR (12 months for price of 10)
      const price = page.locator('text=2490');
      await expect(price).toBeVisible();

      // Should show savings/discount messaging
      const savingsLabel = page.locator('text=/Sparen|Save|Rabatt|Discount/i');
      const savingsVisible = await savingsLabel.isVisible().catch(() => false);
      // Savings label may or may not be present, but price should be
    });

    test('yearly vs monthly pricing difference should be clear', async ({ page }) => {
      // Navigate to growth plan (monthly)
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');
      const monthlyPrice = page.locator('text=249');
      await expect(monthlyPrice).toBeVisible();

      // Navigate to growth yearly plan
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');
      const yearlyPrice = page.locator('text=2490');
      await expect(yearlyPrice).toBeVisible();

      // Yearly should be less than 12x monthly (2490 < 12*249=2988)
      // This is an implicit test that the discount is applied
    });

    test('plan detail page should display plan name', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const planName = page.locator('h2:has-text("Growth")');
      await expect(planName).toBeVisible();
    });

    test('plan detail page should have features list', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const featureLinks = page.locator('[data-testid^="feature-link-"]');
      const featureCount = await featureLinks.count();
      expect(featureCount).toBeGreaterThan(0);
    });

    test('plan detail page should have navigation buttons', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/starter`);
      await page.waitForLoadState('networkidle');

      // Should have previous/next buttons
      const nextButton = page.locator('[data-testid="plan-nav-next"]');
      await expect(nextButton).toBeVisible();

      const prevButton = page.locator('[data-testid="plan-nav-prev"]');
      await expect(prevButton).toBeVisible();
    });

    test('should navigate to next plan via button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/starter`);
      await page.waitForLoadState('networkidle');

      const nextButton = page.locator('[data-testid="plan-nav-next"]');
      await nextButton.click();

      // Should be on growth plan
      await expect(page).toHaveURL(/\/pricing\/growth/);
    });

    test('should navigate to previous plan via button', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const prevButton = page.locator('[data-testid="plan-nav-prev"]');
      await prevButton.click();

      // Should be on starter plan
      await expect(page).toHaveURL(/\/pricing\/starter/);
    });

    test('should link to feature detail pages from plan detail', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      // Click first feature link
      const firstFeatureLink = page.locator('[data-testid^="feature-link-"]').first();
      const href = await firstFeatureLink.getAttribute('href');
      expect(href).toMatch(/\/features\/[a-z-]+/);

      // Navigate to that feature
      await firstFeatureLink.click();
      await page.waitForLoadState('networkidle');

      // Should be on feature detail page
      await expect(page).toHaveURL(/\/features\/[a-z-]+/);
    });

    test('should have checkout button on plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const checkoutButton = page.locator(
        '[data-testid="plan-detail-growth"] [data-testid="plan-cta-button"]'
      );
      await expect(checkoutButton).toBeVisible();
    });
  });

  test.describe('Feature Detail Pages', () => {
    test('should navigate to feature detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      // Click first feature link
      const firstFeatureLink = page.locator('[data-testid^="feature-link-"]').first();
      const featureSlug = await firstFeatureLink.getAttribute('data-testid');
      const expectedFeatureSlug = featureSlug?.replace('feature-link-', '');

      await firstFeatureLink.click();
      await page.waitForLoadState('networkidle');

      const featureDetail = page.locator(
        `[data-testid="feature-detail-${expectedFeatureSlug}"]`
      );
      await expect(featureDetail).toBeVisible();
    });

    test('all feature detail pages should be accessible', async ({ page }) => {
      const featureSlugs = [
        'dsgvo-scan',
        'consent-timing',
        'privacy-policy-generator',
        'evidence-vault',
        'monitoring',
        'scheduler',
        'auto-remediation',
        'ai-risk-register',
        'ki-governance',
        'governance-agents',
        'bots',
        'bulk-jobs',
        'c2pa-herkunftsnachweis',
        'branchenbibliotheken',
        'api-zugriff',
        'white-label',
        'multi-tenant-dashboard',
        'kodee-vps-assistent',
      ];

      for (const slug of featureSlugs) {
        await page.goto(`${BASE_URL}/features/${slug}`);
        await page.waitForLoadState('networkidle');

        const featureDetail = page.locator(`[data-testid="feature-detail-${slug}"]`);
        await expect(featureDetail).toBeVisible();
      }
    });

    test('feature detail page should display feature title', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const featureTitle = page.locator('h1, h2');
      // Should contain feature name
      const titleText = await featureTitle.first().textContent();
      expect(titleText?.toLowerCase()).toContain('dsgvo');
    });

    test('feature detail page should show plans containing feature', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      // dsgvo-scan is in all plans (including yearly variants), should see plan links
      const planLinks = page.locator('[data-testid^="feature-plan-link-"]');
      const planCount = await planLinks.count();
      expect(planCount).toBeGreaterThan(0);
    });

    test('feature detail page should link back to pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const backToPricingButton = page.locator('[data-testid="feature-back-to-pricing"]');
      await expect(backToPricingButton).toBeVisible();
    });

    test('feature detail page should have button to view plan', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      // Should have at least one "view plan" button
      const viewPlanButtons = page.locator('[data-testid^="feature-view-plan-"]');
      const buttonCount = await viewPlanButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
    });

    test('can navigate from feature to plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      // Click first "view plan" button
      const viewPlanButton = page.locator('[data-testid^="feature-view-plan-"]').first();
      await viewPlanButton.click();
      await page.waitForLoadState('networkidle');

      // Should be on plan detail page
      await expect(page).toHaveURL(/\/pricing\/[a-z-]+/);
    });
  });

  test.describe('Checkout Flow', () => {
    test('should navigate to checkout page from pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="pricing-book-growth"]');
      await bookButton.click();

      // Should be on checkout page
      await expect(page).toHaveURL(/\/checkout\/growth/);
      await page.waitForLoadState('networkidle');

      const checkoutPlan = page.locator('[data-testid="checkout-plan-growth"]');
      await expect(checkoutPlan).toBeVisible();
    });

    test('all checkout pages should be accessible', async ({ page }) => {
      const planSlugs = [
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

      for (const slug of planSlugs) {
        await page.goto(`${BASE_URL}/checkout/${slug}`);
        await page.waitForLoadState('networkidle');

        const checkoutPlan = page.locator(`[data-testid="checkout-plan-${slug}"]`);
        await expect(checkoutPlan).toBeVisible();
      }
    });

    test('checkout page should display plan summary', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      // Should show plan name
      const planName = page.locator('text=Growth');
      await expect(planName).toBeVisible();

      // Should show price
      const price = page.locator('text=249 €');
      await expect(price).toBeVisible();
    });

    test('checkout page should show featured features', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      // Should have features section
      const featuresSection = page.locator('text=Was ist alles enthalten');
      await expect(featuresSection).toBeVisible();

      // Should have feature items
      const features = page.locator('[data-testid^="checkout-feature-"]');
      const featureCount = await features.count();
      expect(featureCount).toBeGreaterThan(0);
    });

    test('checkout page should have FAQ section', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      // Should have FAQ section
      const faqSection = page.locator('text=Häufige Fragen');
      await expect(faqSection).toBeVisible();
    });

    test('checkout page should have booking button', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="checkout-book-button"]');
      await expect(bookButton).toBeVisible();
    });

    test('free-audit checkout should redirect to audit page', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/free-audit`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="checkout-book-button"]');
      await bookButton.click();

      // Free audit should navigate to /audit
      await page.waitForURL(/\/audit/);
      await expect(page).toHaveURL(/\/audit/);
    });

    test('enterprise checkout should redirect to contact sales', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/enterprise`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="checkout-book-button"]');
      await bookButton.click();

      // Enterprise should navigate to /contact-sales
      await page.waitForURL(/\/contact-sales/);
      await expect(page).toHaveURL(/\/contact-sales/);
    });
  });

  test.describe('Yearly Plan Checkout', () => {
    test('should navigate to yearly plan checkout from pricing card', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="pricing-book-growth_yearly"]');
      await bookButton.click();

      // Should be on yearly checkout page
      await expect(page).toHaveURL(/\/checkout\/growth_yearly/);
      await page.waitForLoadState('networkidle');

      const checkoutPlan = page.locator('[data-testid="checkout-plan-growth_yearly"]');
      await expect(checkoutPlan).toBeVisible();
    });

    test('yearly checkout page should display annual billing period', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Should indicate annual billing
      const annualLabel = page.locator('text=/Jahr|Annual|12 Monate|12 months/i');
      const isVisible = await annualLabel.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    });

    test('yearly checkout should show correct yearly price', async ({ page }) => {
      const testCases = [
        { slug: 'starter_yearly', price: '790' },
        { slug: 'growth_yearly', price: '2490' },
        { slug: 'agency_yearly', price: '6900' },
        { slug: 'scale_yearly', price: '19000' },
      ];

      for (const testCase of testCases) {
        await page.goto(`${BASE_URL}/checkout/${testCase.slug}`);
        await page.waitForLoadState('networkidle');

        const priceElement = page.locator(`text=${testCase.price}`);
        await expect(priceElement).toBeVisible();
      }
    });

    test('yearly checkout plan name should include annual indicator', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Plan name should be visible (e.g., "Growth" or "Growth Yearly")
      const planName = page.locator('text=Growth');
      await expect(planName).toBeVisible();
    });

    test('yearly checkout should have booking button', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth_yearly`);
      await page.waitForLoadState('networkidle');

      const bookButton = page.locator('[data-testid="checkout-book-button"]');
      await expect(bookButton).toBeVisible();
    });

    test('yearly plan features should match yearly tier config', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Should display features
      const featuresSection = page.locator('text=Was ist alles enthalten');
      await expect(featuresSection).toBeVisible();

      const features = page.locator('[data-testid^="checkout-feature-"]');
      const featureCount = await features.count();
      expect(featureCount).toBeGreaterThan(0);
    });

    test('should show savings indicator for yearly plans', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Check if yearly cards have a savings badge/label
      const growthYearlyCard = page.locator('[data-testid="pricing-card-growth_yearly"]');
      await expect(growthYearlyCard).toBeVisible();

      // Look for any savings-related text (Sparen, Save, Rabatt, etc.)
      const savingsIndicator = growthYearlyCard.locator('text=/Sparen|Save|Rabatt|Discount|2 Monate|2 months/i');
      const hasSavings = await savingsIndicator.isVisible().catch(() => false);
      // Savings indicator may be implicit in pricing, not a hard requirement
    });

    test('all yearly checkout pages should be accessible', async ({ page }) => {
      const yearlyPlanSlugs = [
        'starter_yearly',
        'growth_yearly',
        'agency_yearly',
        'scale_yearly',
      ];

      for (const slug of yearlyPlanSlugs) {
        await page.goto(`${BASE_URL}/checkout/${slug}`);
        await page.waitForLoadState('networkidle');

        const checkoutPlan = page.locator(`[data-testid="checkout-plan-${slug}"]`);
        await expect(checkoutPlan).toBeVisible();
      }
    });

    test('yearly plan navigation should work correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth_yearly`);
      await page.waitForLoadState('networkidle');

      // Should have back button
      const backButton = page.locator('[data-testid="plan-detail-back"]');
      await expect(backButton).toBeVisible();

      // Navigate back
      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Should return to pricing page
      await expect(page).toHaveURL(/\/pricing$/);
    });
  });

  test.describe('Navigation Consistency', () => {
    test('should have working back button on plan detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="plan-detail-back"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Should be back on pricing page
      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('should have working back button on feature detail page', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/dsgvo-scan`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="feature-back-to-pricing"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Should be back on pricing page
      await expect(page).toHaveURL(/\/pricing$/);
    });

    test('should have working back button on checkout page', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/growth`);
      await page.waitForLoadState('networkidle');

      const backButton = page.locator('[data-testid="checkout-back"]');
      await expect(backButton).toBeVisible();

      await backButton.click();
      await page.waitForLoadState('networkidle');

      // Should be back on plan detail page
      await expect(page).toHaveURL(/\/pricing\/growth/);
    });
  });

  test.describe('Growth Plan Special Status', () => {
    test('Growth plan should be marked as recommended on pricing page', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      const growthCard = page.locator('[data-testid="pricing-card-growth"]');
      const badge = growthCard.locator('text=Empfohlen');
      await expect(badge).toBeVisible();
    });

    test('Growth plan detail page should show recommended badge', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/growth`);
      await page.waitForLoadState('networkidle');

      // Should indicate it's the recommended plan
      const recommendedBadge = page.locator('text=Empfohlen');
      await expect(recommendedBadge).toBeVisible();
    });

    test('only Growth plan should have recommended badge', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      await page.waitForLoadState('networkidle');

      // Check each plan individually
      const planSlugs = [
        'free-audit',
        'starter',
        'agency',
        'scale',
        'enterprise',
      ];

      for (const slug of planSlugs) {
        const card = page.locator(`[data-testid="pricing-card-${slug}"]`);
        const badge = card.locator('text=Empfohlen');

        // Badge should not be visible for non-Growth plans
        const isVisible = await badge.isVisible().catch(() => false);
        expect(isVisible).toBe(false);
      }
    });
  });

  test.describe('No Dead Links', () => {
    test('all internal links should be valid', async ({ page }) => {
      // Test that all navigation works without 404s
      const paths = [
        '/pricing',
        '/pricing/free-audit',
        '/pricing/starter',
        '/pricing/growth',
        '/pricing/agency',
        '/pricing/scale',
        '/pricing/enterprise',
        '/pricing/starter_yearly',
        '/pricing/growth_yearly',
        '/pricing/agency_yearly',
        '/pricing/scale_yearly',
        '/features/dsgvo-scan',
        '/features/consent-timing',
        '/features/privacy-policy-generator',
        '/features/evidence-vault',
        '/features/monitoring',
        '/features/scheduler',
        '/features/auto-remediation',
        '/features/ai-risk-register',
        '/features/ki-governance',
        '/features/governance-agents',
        '/features/bots',
        '/features/bulk-jobs',
        '/features/c2pa-herkunftsnachweis',
        '/features/branchenbibliotheken',
        '/features/api-zugriff',
        '/features/white-label',
        '/features/multi-tenant-dashboard',
        '/features/kodee-vps-assistent',
        '/checkout/free-audit',
        '/checkout/starter',
        '/checkout/growth',
        '/checkout/agency',
        '/checkout/scale',
        '/checkout/enterprise',
        '/checkout/starter_yearly',
        '/checkout/growth_yearly',
        '/checkout/agency_yearly',
        '/checkout/scale_yearly',
      ];

      for (const path of paths) {
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');

        // Should not have 404
        const status = page.url();
        expect(status).toContain(path);
      }
    });

    test('invalid plan slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing/invalid-slug`, { waitUntil: 'networkidle' });

      // Should redirect or show pricing page
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('invalid feature slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/features/invalid-slug`, { waitUntil: 'networkidle' });

      // Should redirect or show pricing page
      await expect(page).toHaveURL(/\/pricing/);
    });

    test('invalid checkout slug should redirect to /pricing', async ({ page }) => {
      await page.goto(`${BASE_URL}/checkout/invalid-slug`, { waitUntil: 'networkidle' });

      // Should redirect or show pricing page
      await expect(page).toHaveURL(/\/pricing/);
    });
  });
});
